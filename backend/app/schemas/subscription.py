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
    """A quotation line. Three kinds:

    - Plan line (`is_plan_line`): description and price come from the subscription plan;
      quantity must reach the plan's minimum. At most one per quotation.
    - Catalog line (`product_id`, optional `variant_id`): description and price default
      to the product (plus variant), tax to the rate that applies to the product.
    - Free-text line: description and unit_price are required.

    tax_rate left empty means "use the tax that applies": the product's tax, otherwise
    the admin default tax, otherwise 0%.
    """

    model_config = ConfigDict(extra="forbid")

    is_plan_line: bool = False
    product_id: uuid.UUID | None = None
    variant_id: uuid.UUID | None = None
    description: ShortText | None = None
    quantity: int = Field(ge=1, le=1_000_000)
    unit_price: Money | None = None
    tax_rate: TaxRate | None = None


ValidityDays = Annotated[int, Field(ge=1, le=365)]


class SubscriptionCreate(BaseModel):
    """Starts a subscription in DRAFT status. Lines can be added now or later.

    With `plan_id`, the plan's name and billing frequency are used and its rules (pause,
    renew, early close, auto-close) apply. Without it, plan_name and billing_frequency
    are required.
    """

    model_config = ConfigDict(extra="forbid")

    customer_id: uuid.UUID
    plan_id: uuid.UUID | None = None
    plan_name: ShortText | None = None
    billing_frequency: BillingFrequency | None = None
    payment_terms_days: int = Field(default=0, ge=0, le=365)
    quotation_validity_days: ValidityDays = 15
    expiry_date: date | None = None
    notes: OptionalNotes = None
    lines: list[SubscriptionLineIn] = Field(default_factory=list, max_length=MAX_LINES)


class SubscriptionUpdate(BaseModel):
    """Edits a DRAFT. Omitted fields stay unchanged; `lines`, if given, replaces all lines.

    Send `plan_id: null` to detach the plan (plan_name and billing_frequency stay)."""

    model_config = ConfigDict(extra="forbid")

    customer_id: uuid.UUID | None = None
    plan_id: uuid.UUID | None = None
    plan_name: ShortText | None = None
    billing_frequency: BillingFrequency | None = None
    payment_terms_days: int | None = Field(default=None, ge=0, le=365)
    quotation_validity_days: ValidityDays | None = None
    expiry_date: date | None = None
    notes: OptionalNotes = None
    lines: list[SubscriptionLineIn] | None = Field(default=None, max_length=MAX_LINES)


class SendQuotationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    # Defaults to the quotation's own validity (15 days unless a template set another).
    valid_days: ValidityDays | None = None


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
    is_plan_line: bool
    product_id: uuid.UUID | None
    variant_id: uuid.UUID | None
    description: str
    quantity: int
    unit_price: Decimal
    tax_rate: Decimal
    subtotal: Decimal
    tax_amount: Decimal
    total: Decimal


class PlanRules(BaseModel):
    """What the subscription's plan allows. None for quotations without a plan."""

    plan_id: uuid.UUID
    minimum_quantity: int
    allow_pause: bool
    allow_renewal: bool
    allow_early_closure: bool
    auto_close_on_expiry: bool


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
    plan_id: uuid.UUID | None
    # Set while an ACTIVE subscription is paused (no invoices are generated).
    paused_at: datetime | None
    subtotal: Decimal
    tax_total: Decimal
    total: Decimal
    created_at: datetime


class SubscriptionRead(SubscriptionSummary):
    payment_terms_days: int
    quotation_validity_days: int
    notes: str | None
    quotation_sent_at: datetime | None
    confirmed_at: datetime | None
    activated_at: datetime | None
    closed_at: datetime | None
    renewed_at: datetime | None
    rejection_reason: str | None
    updated_at: datetime
    plan_rules: PlanRules | None
    lines: list[SubscriptionLineRead]


def _line_read(line: SubscriptionLine) -> SubscriptionLineRead:
    amounts = line_amounts(line.quantity, line.unit_price, line.tax_rate)
    return SubscriptionLineRead(
        id=line.id,
        is_plan_line=line.is_plan_line,
        product_id=line.product_id,
        variant_id=line.variant_id,
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
        "plan_id": sub.plan_id,
        "paused_at": sub.paused_at,
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
    plan = sub.plan
    return SubscriptionRead(
        **_summary_fields(sub, lines),
        payment_terms_days=sub.payment_terms_days,
        quotation_validity_days=sub.quotation_validity_days,
        notes=sub.notes,
        quotation_sent_at=sub.quotation_sent_at,
        confirmed_at=sub.confirmed_at,
        activated_at=sub.activated_at,
        closed_at=sub.closed_at,
        renewed_at=sub.renewed_at,
        rejection_reason=sub.rejection_reason,
        updated_at=sub.updated_at,
        plan_rules=(
            PlanRules(
                plan_id=plan.id,
                minimum_quantity=plan.minimum_quantity,
                allow_pause=plan.allow_pause,
                allow_renewal=plan.allow_renewal,
                allow_early_closure=plan.allow_early_closure,
                auto_close_on_expiry=plan.auto_close_on_expiry,
            )
            if plan is not None
            else None
        ),
        lines=lines,
    )
