import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Annotated

from pydantic import BaseModel, ConfigDict, EmailStr, StringConstraints

from app.models.payment import Payment, PaymentMethod
from app.schemas.common import OptionalNotes, PositiveMoney


class PaymentCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    invoice_id: uuid.UUID
    amount: PositiveMoney
    method: PaymentMethod
    # Defaults to today. Future dates are refused.
    paid_on: date | None = None
    reference: Annotated[
        str | None, StringConstraints(strip_whitespace=True, max_length=100)
    ] = None
    notes: OptionalNotes = None


class PaymentRead(BaseModel):
    id: uuid.UUID
    invoice_id: uuid.UUID
    invoice_number: str
    customer_email: EmailStr
    amount: Decimal
    method: PaymentMethod
    paid_on: date
    reference: str | None
    notes: str | None
    recorded_by: EmailStr | None
    created_at: datetime


def payment_read(payment: Payment) -> PaymentRead:
    return PaymentRead(
        id=payment.id,
        invoice_id=payment.invoice_id,
        invoice_number=payment.invoice.number,
        customer_email=payment.invoice.customer.email,
        amount=payment.amount,
        method=payment.method,
        paid_on=payment.paid_on,
        reference=payment.reference,
        notes=payment.notes,
        recorded_by=payment.recorded_by.email if payment.recorded_by else None,
        created_at=payment.created_at,
    )
