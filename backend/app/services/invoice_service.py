"""Invoice lifecycle: DRAFT -> CONFIRMED -> PAID, or CANCELLED before any payment.

Invoices are created only by billing_service. PAID is set by payment_service when the
recorded payments reach the invoice total.
"""

import uuid
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import date

from sqlalchemy import func, or_, select, update
from sqlalchemy.orm import Session, selectinload

from app.models.customer_profile import CustomerProfile
from app.models.discount import Discount, DiscountRedemption
from app.models.invoice import Invoice, InvoiceStatus
from app.models.payment import Payment
from app.models.user import User
from app.services import clock, discount_service
from app.services.errors import BusinessRuleError, ConflictError, NotFoundError
from app.services.money import ZERO

NOT_FOUND = "Invoice not found"
# Drafts are internal until staff confirm them.
CUSTOMER_VISIBLE = (
    InvoiceStatus.CONFIRMED,
    InvoiceStatus.PAID,
    InvoiceStatus.CANCELLED,
)


@dataclass(frozen=True)
class InvoiceList:
    items: Sequence[Invoice]
    total: int


def overdue_condition(today: date):
    return (Invoice.status == InvoiceStatus.CONFIRMED) & (Invoice.due_date < today)


def _with_relations(*, include_detail: bool):
    options = [
        selectinload(Invoice.customer).selectinload(User.profile),
        selectinload(Invoice.subscription),
    ]
    if include_detail:
        options += [
            selectinload(Invoice.lines),
            selectinload(Invoice.payments).selectinload(Payment.recorded_by),
        ]
    return select(Invoice).options(*options)


def list_invoices(
    db: Session,
    *,
    status: InvoiceStatus | None,
    overdue: bool | None,
    customer_id: uuid.UUID | None,
    subscription_id: uuid.UUID | None,
    search: str | None,
    page: int,
    page_size: int,
    customer_visible_only: bool = False,
) -> InvoiceList:
    today = clock.today()
    query = select(Invoice)
    if customer_visible_only:
        query = query.where(Invoice.status.in_(CUSTOMER_VISIBLE))
    if status is not None:
        query = query.where(Invoice.status == status)
    if overdue is True:
        query = query.where(overdue_condition(today))
    elif overdue is False:
        query = query.where(~overdue_condition(today))
    if customer_id is not None:
        query = query.where(Invoice.customer_id == customer_id)
    if subscription_id is not None:
        query = query.where(Invoice.subscription_id == subscription_id)
    if search:
        pattern = f"%{search.strip()}%"
        query = (
            query.join(User, User.id == Invoice.customer_id)
            .outerjoin(CustomerProfile, CustomerProfile.user_id == User.id)
            .where(
                or_(
                    Invoice.number.ilike(pattern),
                    User.email.ilike(pattern),
                    CustomerProfile.full_name.ilike(pattern),
                    CustomerProfile.company_name.ilike(pattern),
                )
            )
        )

    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    ids = db.scalars(
        query.with_only_columns(Invoice.id)
        .order_by(Invoice.invoice_date.desc(), Invoice.number.desc())
        .limit(page_size)
        .offset((page - 1) * page_size)
    ).all()
    if not ids:
        return InvoiceList(items=[], total=total)
    rows = {
        i.id: i
        for i in db.scalars(
            _with_relations(include_detail=False).where(Invoice.id.in_(ids))
        )
    }
    return InvoiceList(items=[rows[i] for i in ids], total=total)


def get_invoice(
    db: Session,
    invoice_id: uuid.UUID,
    *,
    for_update: bool = False,
    customer_id: uuid.UUID | None = None,
) -> Invoice:
    query = _with_relations(include_detail=True).where(Invoice.id == invoice_id)
    if for_update:
        query = query.with_for_update(of=Invoice)
    invoice = db.scalar(query)
    if invoice is None or (
        customer_id is not None
        and (
            invoice.customer_id != customer_id or invoice.status not in CUSTOMER_VISIBLE
        )
    ):
        raise NotFoundError(NOT_FOUND)
    return invoice


def _save(db: Session, invoice: Invoice) -> Invoice:
    db.commit()
    db.expire(invoice)
    return get_invoice(db, invoice.id)


def _drop_discount(invoice: Invoice) -> None:
    """Re-prices the invoice without its discount (used when it can no longer be counted)."""
    from app.services.billing_service import price_lines

    priced = price_lines(
        [(None, ln.quantity, ln.unit_price, ln.tax_rate) for ln in invoice.lines], None
    )
    for line, p in zip(invoice.lines, priced, strict=True):
        line.discount_amount = p.discount
        line.tax_amount = p.tax
        line.total = p.total
    invoice.discount_id = None
    invoice.discount_name = None
    invoice.discount_total = sum((p.discount for p in priced), ZERO)
    invoice.tax_total = sum((p.tax for p in priced), ZERO)
    invoice.total = invoice.subtotal - invoice.discount_total + invoice.tax_total


def confirm(db: Session, invoice_id: uuid.UUID) -> Invoice:
    invoice = get_invoice(db, invoice_id, for_update=True)
    if invoice.status != InvoiceStatus.DRAFT:
        raise BusinessRuleError(f"Cannot confirm an invoice in {invoice.status} status")
    if invoice.discount_id is not None:
        # A discount use is counted when the invoice is confirmed. If the discount ran out
        # or expired since the draft was made, the invoice is confirmed without it.
        try:
            with db.begin_nested():
                discount_service.redeem(
                    db,
                    discount_id=invoice.discount_id,
                    invoice_id=invoice.id,
                    amount=invoice.discount_total,
                    as_of=invoice.invoice_date,
                )
        except ConflictError:
            _drop_discount(invoice)
    now = clock.now_utc()
    invoice.confirmed_at = now
    if invoice.total == 0:
        # Nothing to collect.
        invoice.status = InvoiceStatus.PAID
        invoice.paid_at = now
    else:
        invoice.status = InvoiceStatus.CONFIRMED
    return _save(db, invoice)


def cancel(db: Session, invoice_id: uuid.UUID) -> Invoice:
    """Cancels an unpaid invoice. Its billing period is not re-billed automatically."""
    invoice = get_invoice(db, invoice_id, for_update=True)
    if invoice.status not in (InvoiceStatus.DRAFT, InvoiceStatus.CONFIRMED):
        raise BusinessRuleError(f"Cannot cancel an invoice in {invoice.status} status")
    if invoice.amount_paid > 0:
        raise BusinessRuleError("Cannot cancel an invoice that has payments recorded")
    # Give the discount use back, so a cancelled invoice doesn't count toward its limit.
    redemption = db.scalar(
        select(DiscountRedemption).where(DiscountRedemption.invoice_id == invoice.id)
    )
    if redemption is not None:
        db.execute(
            update(Discount)
            .where(Discount.id == redemption.discount_id, Discount.usage_count > 0)
            .values(usage_count=Discount.usage_count - 1)
            .execution_options(synchronize_session=False)
        )
        db.delete(redemption)
    invoice.status = InvoiceStatus.CANCELLED
    invoice.cancelled_at = clock.now_utc()
    return _save(db, invoice)


def mark_sent(db: Session, invoice_id: uuid.UUID) -> Invoice:
    """Records that the invoice was sent. No email provider is configured yet."""
    invoice = get_invoice(db, invoice_id, for_update=True)
    if invoice.status not in (InvoiceStatus.CONFIRMED, InvoiceStatus.PAID):
        raise BusinessRuleError("Confirm the invoice before sending it")
    invoice.sent_at = clock.now_utc()
    return _save(db, invoice)
