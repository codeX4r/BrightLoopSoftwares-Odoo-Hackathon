import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, EmailStr

from app.models.invoice import Invoice, InvoiceStatus
from app.models.payment import Payment, PaymentMethod
from app.models.subscription import SubscriptionStatus
from app.schemas.common import CustomerSummary, customer_summary


class InvoiceLineRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    description: str
    quantity: int
    unit_price: Decimal
    tax_rate: Decimal
    subtotal: Decimal
    discount_amount: Decimal
    tax_amount: Decimal
    total: Decimal


class InvoicePaymentRead(BaseModel):
    id: uuid.UUID
    amount: Decimal
    method: PaymentMethod
    paid_on: date
    reference: str | None
    notes: str | None
    recorded_by: EmailStr | None
    created_at: datetime


class InvoiceSubscriptionRef(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    number: str
    plan_name: str
    status: SubscriptionStatus


class InvoiceSummary(BaseModel):
    id: uuid.UUID
    number: str
    status: InvoiceStatus
    customer: CustomerSummary
    subscription: InvoiceSubscriptionRef
    invoice_date: date
    due_date: date
    period_start: date
    period_end: date
    # total = subtotal - discount_total + tax_total (tax is charged after the discount).
    subtotal: Decimal
    discount_total: Decimal
    discount_name: str | None
    tax_total: Decimal
    total: Decimal
    amount_paid: Decimal
    amount_due: Decimal
    is_overdue: bool
    sent_at: datetime | None


class InvoiceRead(InvoiceSummary):
    confirmed_at: datetime | None
    paid_at: datetime | None
    cancelled_at: datetime | None
    created_at: datetime
    lines: list[InvoiceLineRead]
    payments: list[InvoicePaymentRead]


class BillingRunRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    # Bill everything due on or before this date. Defaults to today; future dates are refused.
    as_of: date | None = None


class BillingRunResult(BaseModel):
    as_of: date
    subscriptions_billed: int
    invoices_created: int
    invoice_numbers: list[str]
    # Subscriptions closed because they expired and their plan auto-closes.
    auto_closed: list[str] = []


def is_overdue(invoice: Invoice, today: date) -> bool:
    return invoice.status == InvoiceStatus.CONFIRMED and invoice.due_date < today


def payment_line(payment: Payment) -> InvoicePaymentRead:
    return InvoicePaymentRead(
        id=payment.id,
        amount=payment.amount,
        method=payment.method,
        paid_on=payment.paid_on,
        reference=payment.reference,
        notes=payment.notes,
        recorded_by=payment.recorded_by.email if payment.recorded_by else None,
        created_at=payment.created_at,
    )


def _summary_fields(invoice: Invoice, today: date) -> dict:
    return {
        "id": invoice.id,
        "number": invoice.number,
        "status": invoice.status,
        "customer": customer_summary(invoice.customer),
        "subscription": InvoiceSubscriptionRef.model_validate(invoice.subscription),
        "invoice_date": invoice.invoice_date,
        "due_date": invoice.due_date,
        "period_start": invoice.period_start,
        "period_end": invoice.period_end,
        "subtotal": invoice.subtotal,
        "discount_total": invoice.discount_total,
        "discount_name": invoice.discount_name,
        "tax_total": invoice.tax_total,
        "total": invoice.total,
        "amount_paid": invoice.amount_paid,
        "amount_due": invoice.amount_due,
        "is_overdue": is_overdue(invoice, today),
        "sent_at": invoice.sent_at,
    }


def invoice_summary(invoice: Invoice, today: date) -> InvoiceSummary:
    return InvoiceSummary(**_summary_fields(invoice, today))


def invoice_read(invoice: Invoice, today: date) -> InvoiceRead:
    return InvoiceRead(
        **_summary_fields(invoice, today),
        confirmed_at=invoice.confirmed_at,
        paid_at=invoice.paid_at,
        cancelled_at=invoice.cancelled_at,
        created_at=invoice.created_at,
        lines=[InvoiceLineRead.model_validate(line) for line in invoice.lines],
        payments=[payment_line(p) for p in invoice.payments],
    )
