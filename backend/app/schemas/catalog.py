import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.catalog import BillingFrequency, PlanStatus, ProductStatus

NAME_MAX = 200
DESCRIPTION_MAX = 2000

Money = Annotated[Decimal, Field(ge=0, max_digits=12, decimal_places=2)]


def _strip_required(value: str) -> str:
    stripped = value.strip()
    if not stripped:
        raise ValueError("must not be blank")
    return stripped


# --- Pagination --------------------------------------------------------------


class Page[T](BaseModel):
    items: list[T]
    total: int
    limit: int
    offset: int


# --- Product types -----------------------------------------------------------


class ProductTypeCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=100)

    @field_validator("name")
    @classmethod
    def name_not_blank(cls, value: str) -> str:
        return _strip_required(value)


class ProductTypeRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str


# --- Products ----------------------------------------------------------------


class ProductCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=NAME_MAX)
    product_type_id: uuid.UUID
    sales_price: Money
    cost_price: Money
    description: str | None = Field(default=None, max_length=DESCRIPTION_MAX)
    status: ProductStatus = ProductStatus.ACTIVE

    @field_validator("name")
    @classmethod
    def name_not_blank(cls, value: str) -> str:
        return _strip_required(value)


class ProductUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(default=None, min_length=1, max_length=NAME_MAX)
    product_type_id: uuid.UUID | None = None
    sales_price: Money | None = None
    cost_price: Money | None = None
    description: str | None = Field(default=None, max_length=DESCRIPTION_MAX)
    status: ProductStatus | None = None

    @field_validator("name")
    @classmethod
    def name_not_blank(cls, value: str | None) -> str | None:
        return None if value is None else _strip_required(value)


class ProductRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    product_type: ProductTypeRead
    sales_price: Decimal
    cost_price: Decimal
    description: str | None
    status: ProductStatus
    created_at: datetime
    updated_at: datetime


# --- Variants ----------------------------------------------------------------


class VariantCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=100)
    additional_price: Money = Decimal("0.00")
    description: str | None = Field(default=None, max_length=DESCRIPTION_MAX)
    status: ProductStatus = ProductStatus.ACTIVE

    @field_validator("name")
    @classmethod
    def name_not_blank(cls, value: str) -> str:
        return _strip_required(value)


class VariantUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(default=None, min_length=1, max_length=100)
    additional_price: Money | None = None
    description: str | None = Field(default=None, max_length=DESCRIPTION_MAX)
    status: ProductStatus | None = None

    @field_validator("name")
    @classmethod
    def name_not_blank(cls, value: str | None) -> str | None:
        return None if value is None else _strip_required(value)


class VariantRead(BaseModel):
    id: uuid.UUID
    product_id: uuid.UUID
    name: str
    additional_price: Decimal
    # Calculated on the backend: product sales price plus this variant's additional price.
    final_price: Decimal
    description: str | None
    status: ProductStatus


# --- Plans -------------------------------------------------------------------


class PlanCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=NAME_MAX)
    description: str | None = Field(default=None, max_length=DESCRIPTION_MAX)
    product_ids: list[uuid.UUID] = Field(min_length=1)
    price: Money
    billing_frequency: BillingFrequency
    minimum_quantity: int = Field(default=1, ge=1, le=1_000_000)
    available_from: date
    available_until: date | None = None
    auto_close_on_expiry: bool = False
    allow_early_closure: bool = False
    allow_pause: bool = False
    allow_renewal: bool = False
    status: PlanStatus = PlanStatus.ACTIVE

    @field_validator("name")
    @classmethod
    def name_not_blank(cls, value: str) -> str:
        return _strip_required(value)


class PlanUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(default=None, min_length=1, max_length=NAME_MAX)
    description: str | None = Field(default=None, max_length=DESCRIPTION_MAX)
    product_ids: list[uuid.UUID] | None = Field(default=None, min_length=1)
    price: Money | None = None
    billing_frequency: BillingFrequency | None = None
    minimum_quantity: int | None = Field(default=None, ge=1, le=1_000_000)
    available_from: date | None = None
    available_until: date | None = None
    auto_close_on_expiry: bool | None = None
    allow_early_closure: bool | None = None
    allow_pause: bool | None = None
    allow_renewal: bool | None = None
    status: PlanStatus | None = None

    @field_validator("name")
    @classmethod
    def name_not_blank(cls, value: str | None) -> str | None:
        return None if value is None else _strip_required(value)


class PlanRead(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None
    price: Decimal
    billing_frequency: BillingFrequency
    minimum_quantity: int
    available_from: date
    available_until: date | None
    auto_close_on_expiry: bool
    allow_early_closure: bool
    allow_pause: bool
    allow_renewal: bool
    status: PlanStatus
    product_ids: list[uuid.UUID]
    # True when new customers can subscribe today (active, inside the availability window).
    is_offerable: bool
