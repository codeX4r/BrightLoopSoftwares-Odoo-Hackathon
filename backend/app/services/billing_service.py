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

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.models.invoice import Invoice, InvoiceLine, InvoiceStatus
from app.models.subscription import BillingFrequency, Subscription, SubscriptionStatus
from app.services.money import ZERO, line_amounts
from app.services.numbering import INVOICE_SEQUENCE, next_number

# A daily subscription left unbilled for years would otherwise create thousands of
# invoices in one transaction. The remainder is picked up by the next run.
MAX_PERIODS_PER_RUN = 366


@dataclass
class BillingRun:
    as_of: date
    subscriptions_billed: int = 0
    invoice_numbers: list[str] = field(default_factory=list)


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


def _build_invoice(sub: Subscription, number: str, start: date, end: date) -> Invoice:
    lines: list[InvoiceLine] = []
    subtotal = tax_total = ZERO
    for line in sub.lines:
        amounts = line_amounts(line.quantity, line.unit_price, line.tax_rate)
        subtotal += amounts.subtotal
        tax_total += amounts.tax
        lines.append(
            InvoiceLine(
                position=line.position,
                description=line.description,
                quantity=line.quantity,
                unit_price=line.unit_price,
                tax_rate=line.tax_rate,
                subtotal=amounts.subtotal,
                tax_amount=amounts.tax,
                total=amounts.total,
            )
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
        tax_total=tax_total,
        total=subtotal + tax_total,
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
        invoice = _build_invoice(sub, next_number(db, INVOICE_SEQUENCE), start, end)
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
    return run
