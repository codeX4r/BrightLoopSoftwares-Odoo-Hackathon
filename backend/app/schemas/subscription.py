import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

from app.models.subscription import (
    BillingFrequency,
    Subscription,
    SubscriptionLine,
    SubscriptionStatus,
)
from app.schemas.common import (
    CustomerSummary,
    Money,
    OptionalNotes,
    ShortText,
    TaxRate,
    customer_summary,
)
from app.services.money import ZERO, line_amounts

MAX_LINES = 100

OptionalReason = Annotated[
    str | None, StringConstraints(strip_whitespace=True, max_length=500)
]


class SubscriptionLineIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    description: ShortText
    quantity: int = Field(ge=1, le=1_000_000)
    unit_price: Money
    tax_rate: TaxRate = Decimal(0)


class SubscriptionCreate(BaseModel):
    """Starts a subscription in DRAFT status. Lines can be added now or later."""

    model_config = ConfigDict(extra="forbid")

    customer_id: uuid.UUID
    plan_name: ShortText
    billing_frequency: BillingFrequency
    payment_terms_days: int = Field(default=0, ge=0, le=365)
    expiry_date: date | None = None
    notes: OptionalNotes = None
    lines: list[SubscriptionLineIn] = Field(default_factory=list, max_length=MAX_LINES)


class SubscriptionUpdate(BaseModel):
    """Edits a DRAFT. Omitted fields stay unchanged; `lines`, if given, replaces all lines."""

    model_config = ConfigDict(extra="forbid")

    customer_id: uuid.UUID | None = None
    plan_name: ShortText | None = None
    billing_frequency: BillingFrequency | None = None
    payment_terms_days: int | None = Field(default=None, ge=0, le=365)
    expiry_date: date | None = None
    notes: OptionalNotes = None
    lines: list[SubscriptionLineIn] | None = Field(default=None, max_length=MAX_LINES)


class SendQuotationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    valid_days: int = Field(default=15, ge=1, le=365)


class RejectQuotationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    reason: OptionalReason = None


class ActivateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    # Defaults to today. The first invoice covers the period starting on this date.
    start_date: date | None = None
    expiry_date: date | None = None


class SubscriptionLineRead(BaseModel):
    id: uuid.UUID
    description: str
    quantity: int
    unit_price: Decimal
    tax_rate: Decimal
    subtotal: Decimal
    tax_amount: Decimal
    total: Decimal


class SubscriptionSummary(BaseModel):
    id: uuid.UUID
    number: str
    status: SubscriptionStatus
    customer: CustomerSummary
    plan_name: str
    billing_frequency: BillingFrequency
    start_date: date | None
    expiry_date: date | None
    next_billing_date: date | None
    quotation_valid_until: date | None
    # Set when the customer declined the quotation (status is then CLOSED).
    rejected_at: datetime | None
    subtotal: Decimal
    tax_total: Decimal
    total: Decimal
    created_at: datetime


class SubscriptionRead(SubscriptionSummary):
    payment_terms_days: int
    notes: str | None
    quotation_sent_at: datetime | None
    confirmed_at: datetime | None
    activated_at: datetime | None
    closed_at: datetime | None
    rejection_reason: str | None
    updated_at: datetime
    lines: list[SubscriptionLineRead]


def _line_read(line: SubscriptionLine) -> SubscriptionLineRead:
    amounts = line_amounts(line.quantity, line.unit_price, line.tax_rate)
    return SubscriptionLineRead(
        id=line.id,
        description=line.description,
        quantity=line.quantity,
        unit_price=line.unit_price,
        tax_rate=line.tax_rate,
        subtotal=amounts.subtotal,
        tax_amount=amounts.tax,
        total=amounts.total,
    )


def _summary_fields(sub: Subscription, lines: list[SubscriptionLineRead]) -> dict:
    subtotal = sum((line.subtotal for line in lines), ZERO)
    tax_total = sum((line.tax_amount for line in lines), ZERO)
    return {
        "id": sub.id,
        "number": sub.number,
        "status": sub.status,
        "customer": customer_summary(sub.customer),
        "plan_name": sub.plan_name,
        "billing_frequency": sub.billing_frequency,
        "start_date": sub.start_date,
        "expiry_date": sub.expiry_date,
        "next_billing_date": sub.next_billing_date,
        "quotation_valid_until": sub.quotation_valid_until,
        "rejected_at": sub.rejected_at,
        "subtotal": subtotal,
        "tax_total": tax_total,
        "total": subtotal + tax_total,
        "created_at": sub.created_at,
    }


def subscription_summary(sub: Subscription) -> SubscriptionSummary:
    lines = [_line_read(line) for line in sub.lines]
    return SubscriptionSummary(**_summary_fields(sub, lines))


def subscription_read(sub: Subscription) -> SubscriptionRead:
    lines = [_line_read(line) for line in sub.lines]
    return SubscriptionRead(
        **_summary_fields(sub, lines),
        payment_terms_days=sub.payment_terms_days,
        notes=sub.notes,
        quotation_sent_at=sub.quotation_sent_at,
        confirmed_at=sub.confirmed_at,
        activated_at=sub.activated_at,
        closed_at=sub.closed_at,
        rejection_reason=sub.rejection_reason,
        updated_at=sub.updated_at,
        lines=lines,
    )
