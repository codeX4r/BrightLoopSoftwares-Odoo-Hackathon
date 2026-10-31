"""Payments recorded by staff against confirmed invoices."""

import uuid
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import date

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.models.invoice import Invoice, InvoiceStatus
from app.models.payment import Payment, PaymentMethod
from app.models.user import User
from app.schemas.payment import PaymentCreate
from app.services import clock
from app.services.errors import BusinessRuleError, InvalidInputError, NotFoundError


@dataclass(frozen=True)
class PaymentList:
    items: Sequence[Payment]
    total: int


def _with_relations():
    return select(Payment).options(
        selectinload(Payment.invoice).selectinload(Invoice.customer),
        selectinload(Payment.recorded_by),
    )


def record_payment(db: Session, data: PaymentCreate, *, actor: User) -> Payment:
    paid_on = data.paid_on or clock.today()
    if paid_on > clock.today():
        raise InvalidInputError("Payment date cannot be in the future")

    # Lock the invoice so two payments recorded at once can't both pass the balance check.
    invoice = db.scalar(
        select(Invoice).where(Invoice.id == data.invoice_id).with_for_update()
    )
    if invoice is None:
        raise NotFoundError("Invoice not found")
    if invoice.status != InvoiceStatus.CONFIRMED:
        raise BusinessRuleError(
            {
                InvoiceStatus.DRAFT: "Confirm the invoice before recording a payment",
                InvoiceStatus.PAID: "This invoice is already fully paid",
                InvoiceStatus.CANCELLED: "Cannot record a payment on a cancelled invoice",
            }[invoice.status]
        )
    amount_due = invoice.total - invoice.amount_paid
    if data.amount > amount_due:
        raise InvalidInputError(
            f"Amount exceeds the outstanding balance of {amount_due:.2f}"
        )

    payment = Payment(
        invoice_id=invoice.id,
        amount=data.amount,
        method=data.method,
        paid_on=paid_on,
        reference=data.reference or None,
        notes=data.notes or None,
        recorded_by_id=actor.id,
    )
    db.add(payment)
    invoice.amount_paid = invoice.amount_paid + data.amount
    if invoice.amount_paid == invoice.total:
        invoice.status = InvoiceStatus.PAID
        invoice.paid_at = clock.now_utc()
    db.commit()
    return db.scalar(_with_relations().where(Payment.id == payment.id))


def list_payments(
    db: Session,
    *,
    invoice_id: uuid.UUID | None,
    method: PaymentMethod | None,
    date_from: date | None,
    date_to: date | None,
    page: int,
    page_size: int,
) -> PaymentList:
    query = select(Payment)
    if invoice_id is not None:
        query = query.where(Payment.invoice_id == invoice_id)
    if method is not None:
        query = query.where(Payment.method == method)
    if date_from is not None:
        query = query.where(Payment.paid_on >= date_from)
    if date_to is not None:
        query = query.where(Payment.paid_on <= date_to)

    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    ids = db.scalars(
        query.with_only_columns(Payment.id)
        .order_by(Payment.paid_on.desc(), Payment.created_at.desc())
        .limit(page_size)
        .offset((page - 1) * page_size)
    ).all()
    if not ids:
        return PaymentList(items=[], total=total)
    rows = {p.id: p for p in db.scalars(_with_relations().where(Payment.id.in_(ids)))}
    return PaymentList(items=[rows[i] for i in ids], total=total)
