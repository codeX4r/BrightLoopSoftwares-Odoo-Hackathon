"""Automatic invoice generation.

Every ACTIVE subscription whose next_billing_date is on or before `as_of` gets one invoice
per billing period it has not been billed for yet, then next_billing_date moves forward.

Guarantees:
- No duplicates: invoices are unique on (subscription_id, period_start) in the database,
  and the subscription row is locked while it is billed, so overlapping runs are safe.
- Nothing skipped: if the job didn't run for a few days, the next run catches up on every
  missed period, up to MAX_PERIODS_PER_RUN per subscription per run.
"""

import calendar
import uuid
from dataclasses import dataclass, field
from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.models.catalog import SubscriptionPlan
from app.models.discount import DiscountScope
from app.models.invoice import Invoice, InvoiceLine, InvoiceStatus
from app.models.subscription import BillingFrequency, Subscription, SubscriptionStatus
from app.services import clock, discount_service
from app.services.discount_service import DiscountResult, LineInput
from app.services.money import ZERO, allocate, round_money
from app.services.numbering import INVOICE_SEQUENCE, next_number

# A daily subscription left unbilled for years would otherwise create thousands of
# invoices in one transaction. The remainder is picked up by the next run.
MAX_PERIODS_PER_RUN = 366


@dataclass
class BillingRun:
    as_of: date
    subscriptions_billed: int = 0
    invoice_numbers: list[str] = field(default_factory=list)
    # Subscriptions closed because they expired and their plan auto-closes.
    auto_closed: list[str] = field(default_factory=list)


def add_months(value: date, months: int, anchor_day: int) -> date:
    """Moves by whole months, keeping the anchor day where the month allows it.

    With anchor 31: 31 Jan -> 28 Feb (29 in leap years) -> 31 Mar.
    """
    month_index = value.month - 1 + months
    year = value.year + month_index // 12
    month = month_index % 12 + 1
    return date(year, month, min(anchor_day, calendar.monthrange(year, month)[1]))


def next_period_start(
    current: date, frequency: BillingFrequency, anchor_day: int
) -> date:
    if frequency == BillingFrequency.DAILY:
        return current + timedelta(days=1)
    if frequency == BillingFrequency.WEEKLY:
        return current + timedelta(days=7)
    if frequency == BillingFrequency.MONTHLY:
        return add_months(current, 1, anchor_day)
    return add_months(current, 12, anchor_day)


@dataclass(frozen=True)
class PricedLine:
    """One invoice line's numbers after the discount: tax is on (subtotal - discount)."""

    subtotal: Decimal
    discount: Decimal
    tax: Decimal

    @property
    def total(self) -> Decimal:
        return self.subtotal - self.discount + self.tax


def price_lines(
    lines: list[tuple[uuid.UUID | None, int, Decimal, Decimal]],
    discount: DiscountResult | None,
) -> list[PricedLine]:
    """Prices (product_id, quantity, unit_price, tax_rate) lines with an optional discount.

    The discount is split across the lines it covers (all lines, or only the discount's
    products) in proportion to their subtotals, then tax is charged on what remains.
    """
    subtotals = [round_money(Decimal(qty) * price) for _pid, qty, price, _rate in lines]
    shares = [ZERO] * len(lines)
    if discount is not None:
        covered = {p.id for p in discount.discount.products}
        weights = [
            sub
            if discount.discount.scope != DiscountScope.SPECIFIC_PRODUCTS
            or pid in covered
            else ZERO
            for (pid, _qty, _price, _rate), sub in zip(lines, subtotals, strict=True)
        ]
        shares = allocate(discount.amount, weights)
    priced = []
    for (_pid, _qty, _price, rate), sub, share in zip(
        lines, subtotals, shares, strict=True
    ):
        tax = round_money((sub - share) * rate / Decimal(100))
        priced.append(PricedLine(subtotal=sub, discount=share, tax=tax))
    return priced


def best_discount(db: Session, sub: Subscription, on: date) -> DiscountResult | None:
    """The admin discount this subscription qualifies for on `on` (largest wins)."""
    inputs = [
        LineInput(
            product_id=line.product_id,
            quantity=line.quantity,
            subtotal=round_money(Decimal(line.quantity) * line.unit_price),
        )
        for line in sub.lines
    ]
    if not inputs:
        return None
    return discount_service.evaluate(db, inputs, on)


def build_invoice_lines(
    sub_lines, discount: DiscountResult | None
) -> tuple[list[InvoiceLine], Decimal, Decimal, Decimal]:
    """Invoice lines plus (subtotal, discount_total, tax_total) for the given lines."""
    priced = price_lines(
        [(ln.product_id, ln.quantity, ln.unit_price, ln.tax_rate) for ln in sub_lines],
        discount,
    )
    lines = [
        InvoiceLine(
            position=line.position,
            description=line.description,
            quantity=line.quantity,
            unit_price=line.unit_price,
            tax_rate=line.tax_rate,
            subtotal=p.subtotal,
            discount_amount=p.discount,
            tax_amount=p.tax,
            total=p.total,
        )
        for line, p in zip(sub_lines, priced, strict=True)
    ]
    return (
        lines,
        sum((p.subtotal for p in priced), ZERO),
        sum((p.discount for p in priced), ZERO),
        sum((p.tax for p in priced), ZERO),
    )


def _build_invoice(
    db: Session, sub: Subscription, number: str, start: date, end: date
) -> Invoice:
    discount = best_discount(db, sub, start)
    lines, subtotal, discount_total, tax_total = build_invoice_lines(
        sub.lines, discount
    )
    return Invoice(
        number=number,
        subscription_id=sub.id,
        customer_id=sub.customer_id,
        status=InvoiceStatus.DRAFT,
        invoice_date=start,
        due_date=start + timedelta(days=sub.payment_terms_days),
        period_start=start,
        period_end=end,
        subtotal=subtotal,
        discount_total=discount_total,
        discount_id=discount.discount.id if discount else None,
        discount_name=discount.discount.name if discount else None,
        tax_total=tax_total,
        total=subtotal - discount_total + tax_total,
        amount_paid=ZERO,
        lines=lines,
    )


def bill_subscription(
    db: Session, subscription_id: uuid.UUID, as_of: date
) -> list[str]:
    """Bills one subscription in its own transaction. Returns the new invoice numbers."""
    sub = db.scalar(
        select(Subscription)
        .options(selectinload(Subscription.lines))
        .where(Subscription.id == subscription_id)
        # A concurrent run already holds this subscription: let it finish the work.
        .with_for_update(of=Subscription, skip_locked=True)
    )
    # Re-check under the lock: another run may have billed it since we listed it.
    if (
        sub is None
        or sub.status != SubscriptionStatus.ACTIVE
        or sub.paused_at is not None
        or sub.next_billing_date is None
        or sub.next_billing_date > as_of
        or sub.start_date is None
    ):
        db.rollback()
        return []

    anchor_day = sub.start_date.day
    created: list[Invoice] = []
    while (
        sub.next_billing_date is not None
        and sub.next_billing_date <= as_of
        and len(created) < MAX_PERIODS_PER_RUN
    ):
        start = sub.next_billing_date
        if sub.expiry_date is not None and start > sub.expiry_date:
            sub.next_billing_date = None
            break
        following = next_period_start(start, sub.billing_frequency, anchor_day)
        end = following - timedelta(days=1)
        if sub.expiry_date is not None and end > sub.expiry_date:
            end = sub.expiry_date
        invoice = _build_invoice(db, sub, next_number(db, INVOICE_SEQUENCE), start, end)
        db.add(invoice)
        created.append(invoice)
        sub.next_billing_date = following

    # Stop scheduling once the subscription has run past its expiry date.
    if (
        sub.expiry_date is not None
        and sub.next_billing_date is not None
        and sub.next_billing_date > sub.expiry_date
    ):
        sub.next_billing_date = None

    try:
        db.commit()
    except IntegrityError:
        # The unique (subscription_id, period_start) constraint fired: the period was
        # billed by another run. Roll back so nothing is double-billed.
        db.rollback()
        return []
    return [invoice.number for invoice in created]


def generate_due_invoices(db: Session, as_of: date) -> BillingRun:
    run = BillingRun(as_of=as_of)
    due_ids = db.scalars(
        select(Subscription.id)
        .where(
            Subscription.status == SubscriptionStatus.ACTIVE,
            Subscription.paused_at.is_(None),
            Subscription.next_billing_date.is_not(None),
            Subscription.next_billing_date <= as_of,
        )
        .order_by(Subscription.next_billing_date, Subscription.number)
    ).all()
    db.rollback()  # End the read transaction; each subscription gets its own.

    for subscription_id in due_ids:
        numbers = bill_subscription(db, subscription_id, as_of)
        if numbers:
            run.subscriptions_billed += 1
            run.invoice_numbers.extend(numbers)
    run.auto_closed = close_expired(db, as_of)
    return run


def close_expired(db: Session, as_of: date) -> list[str]:
    """Closes ACTIVE subscriptions past their expiry date whose plan says auto-close.

    Runs after billing, so the last period up to the expiry date is always invoiced first.
    """
    expired = db.scalars(
        select(Subscription)
        .join(SubscriptionPlan, SubscriptionPlan.id == Subscription.plan_id)
        .where(
            Subscription.status == SubscriptionStatus.ACTIVE,
            Subscription.expiry_date.is_not(None),
            Subscription.expiry_date < as_of,
            SubscriptionPlan.auto_close_on_expiry.is_(True),
        )
        .with_for_update(of=Subscription, skip_locked=True)
    ).all()
    now = clock.now_utc()
    for sub in expired:
        sub.status = SubscriptionStatus.CLOSED
        sub.next_billing_date = None
        sub.paused_at = None
        sub.closed_at = now
    db.commit()
    return [sub.number for sub in expired]
