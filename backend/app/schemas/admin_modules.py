"""Request and response shapes for profiles, taxes, discounts, reports and settings."""

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Annotated, Literal

from pydantic import (
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    StringConstraints,
    field_validator,
)

from app.models.discount import DiscountScope, DiscountType

Money = Annotated[Decimal, Field(ge=0, max_digits=12, decimal_places=2)]
Rate = Annotated[Decimal, Field(ge=0, le=100, max_digits=5, decimal_places=2)]
Name = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)
]
OptionalText = Annotated[str | None, StringConstraints(max_length=2000)]
Phone = Annotated[
    str | None,
    StringConstraints(
        strip_whitespace=True, max_length=32, pattern=r"^$|^[0-9+()\-. ]{6,32}$"
    ),
]
PersonName = Annotated[
    str | None, StringConstraints(strip_whitespace=True, max_length=200)
]


# --- Profiles ----------------------------------------------------------------


class CustomerProfileUpdate(BaseModel):
    """Omitted fields stay unchanged; an empty string clears a field."""

    model_config = ConfigDict(extra="forbid")

    full_name: PersonName = None
    company_name: PersonName = None
    phone: Phone = None
    address: OptionalText = None


class CustomerProfileRead(BaseModel):
    user_id: uuid.UUID
    email: EmailStr
    full_name: str | None
    company_name: str | None
    phone: str | None
    address: str | None
    updated_at: datetime | None


class StaffUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: EmailStr | None = Field(default=None, max_length=320)
    full_name: PersonName = None
    phone: Phone = None


class StaffProfileRead(BaseModel):
    user_id: uuid.UUID
    email: EmailStr
    full_name: str | None
    phone: str | None


# --- Taxes -------------------------------------------------------------------


class TaxCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: Name
    rate: Rate
    tax_type: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=1, max_length=50)
    ]
    description: OptionalText = None
    is_active: bool = True
    is_default: bool = False
    product_ids: list[uuid.UUID] = Field(default_factory=list)
    product_type_ids: list[uuid.UUID] = Field(default_factory=list)


class TaxUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: Name | None = None
    rate: Rate | None = None
    tax_type: (
        Annotated[
            str, StringConstraints(strip_whitespace=True, min_length=1, max_length=50)
        ]
        | None
    ) = None
    description: OptionalText = None
    is_active: bool | None = None
    is_default: bool | None = None
    product_ids: list[uuid.UUID] | None = None
    product_type_ids: list[uuid.UUID] | None = None


class NamedRef(BaseModel):
    id: uuid.UUID
    name: str


class TaxRead(BaseModel):
    id: uuid.UUID
    name: str
    rate: Decimal
    tax_type: str
    description: str | None
    is_active: bool
    is_default: bool
    products: list[NamedRef]
    product_types: list[NamedRef]
    created_at: datetime
    updated_at: datetime


class TaxOption(BaseModel):
    """What the staff quotation form needs to offer a tax."""

    id: uuid.UUID
    name: str
    rate: Decimal
    is_default: bool


class ResolvedTax(BaseModel):
    product_id: uuid.UUID | None
    tax: TaxOption | None


# --- Discounts ---------------------------------------------------------------


class DiscountBase(BaseModel):
    model_config = ConfigDict(extra="forbid")

    description: OptionalText = None
    min_purchase_amount: Money | None = None
    min_quantity: int | None = Field(default=None, ge=1, le=1_000_000)
    end_date: date | None = None
    usage_limit: int | None = Field(default=None, ge=1, le=10_000_000)


class DiscountCreate(DiscountBase):
    name: Name
    discount_type: DiscountType
    value: Annotated[Decimal, Field(gt=0, max_digits=12, decimal_places=2)]
    start_date: date
    scope: DiscountScope = DiscountScope.ENTIRE_SUBSCRIPTION
    product_ids: list[uuid.UUID] = Field(default_factory=list)
    is_active: bool = True

    @field_validator("product_ids")
    @classmethod
    def unique_products(cls, value: list[uuid.UUID]) -> list[uuid.UUID]:
        return list(dict.fromkeys(value))


class DiscountUpdate(DiscountBase):
    name: Name | None = None
    discount_type: DiscountType | None = None
    value: Annotated[Decimal, Field(gt=0, max_digits=12, decimal_places=2)] | None = (
        None
    )
    start_date: date | None = None
    scope: DiscountScope | None = None
    product_ids: list[uuid.UUID] | None = None
    is_active: bool | None = None


class DiscountRead(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None
    discount_type: DiscountType
    value: Decimal
    min_purchase_amount: Decimal | None
    min_quantity: int | None
    start_date: date
    end_date: date | None
    usage_limit: int | None
    usage_count: int
    scope: DiscountScope
    products: list[NamedRef]
    is_active: bool
    # True when it can be applied today (active, inside its dates, uses left).
    is_valid_today: bool
    created_at: datetime
    updated_at: datetime


class PreviewLine(BaseModel):
    model_config = ConfigDict(extra="forbid")

    product_id: uuid.UUID | None = None
    quantity: int = Field(ge=1, le=1_000_000)
    unit_price: Money


class DiscountPreviewRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    lines: list[PreviewLine] = Field(min_length=1, max_length=100)
    as_of: date | None = None


class DiscountPreview(BaseModel):
    as_of: date
    subtotal: Decimal
    discount: NamedRef | None
    discount_amount: Decimal
    subtotal_after_discount: Decimal


# --- Settings ----------------------------------------------------------------


class SettingsRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    company_name: str
    company_address: str | None
    company_email: str | None
    company_phone: str | None
    currency: str
    timezone: str
    invoice_prefix: str
    updated_at: datetime
    supported_currencies: list[str]
    supported_timezones: list[str]


class SettingsUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    company_name: Annotated[str, StringConstraints(max_length=200)] | None = None
    company_address: OptionalText = None
    company_email: EmailStr | Literal[""] | None = None
    company_phone: Phone = None
    currency: Annotated[str, StringConstraints(min_length=3, max_length=3)] | None = (
        None
    )
    timezone: Annotated[str, StringConstraints(min_length=1, max_length=64)] | None = (
        None
    )
    invoice_prefix: (
        Annotated[str, StringConstraints(min_length=1, max_length=10)] | None
    ) = None


# --- Reports -----------------------------------------------------------------


class RevenuePeriod(BaseModel):
    year: int
    month: int | None
    invoiced: Decimal
    invoices_count: int
    received: Decimal
    payments_count: int


class RevenueReportRead(BaseModel):
    date_from: date
    date_to: date
    group_by: Literal["month", "year"]
    invoiced: Decimal
    invoices_count: int
    received: Decimal
    payments_count: int
    outstanding: Decimal
    outstanding_count: int
    overdue: Decimal
    overdue_count: int
    periods: list[RevenuePeriod]


class SubscriptionReportRead(BaseModel):
    date_from: date
    date_to: date
    new_subscriptions: int
    closed_subscriptions: int
    expired_subscriptions: int
    active_subscriptions: int
    open_quotations: int
    awaiting_activation: int
    renewed_subscriptions: int | None
    status_counts: dict[str, int]
    recurring_revenue_monthly: Decimal
    recurring_by_frequency: dict[str, Decimal]
    recurring_revenue_definition: str


# --- Password reset ----------------------------------------------------------


class PasswordResetRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: EmailStr = Field(max_length=320)


class PasswordResetConfirm(BaseModel):
    model_config = ConfigDict(extra="forbid")

    token: Annotated[str, StringConstraints(min_length=20, max_length=200)]
    new_password: Annotated[str, StringConstraints(min_length=1, max_length=128)]
