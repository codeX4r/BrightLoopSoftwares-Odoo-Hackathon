"""Customer management by staff (/api/staff/customers)."""

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Annotated

from pydantic import (
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    StringConstraints,
    field_validator,
)

from app.schemas.auth import check_customer_password
from app.schemas.profile import ProfileAddress, ProfileName, ProfilePhone
from app.schemas.user import PASSWORD_MAX_LENGTH

RequiredName = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)
]


class StaffCustomerCreate(BaseModel):
    """A customer account created by staff, with an initial password to share with them.

    Uses the same password rule as self signup. The account is always a CUSTOMER.
    """

    model_config = ConfigDict(extra="forbid")

    email: EmailStr = Field(max_length=320)
    password: str = Field(min_length=1, max_length=PASSWORD_MAX_LENGTH)
    full_name: RequiredName
    company_name: ProfileName = None
    phone: ProfilePhone = None
    address: ProfileAddress = None

    @field_validator("password")
    @classmethod
    def password_strength(cls, value: str) -> str:
        return check_customer_password(value)


class StaffCustomerRow(BaseModel):
    id: uuid.UUID
    email: EmailStr
    is_active: bool
    full_name: str | None
    company_name: str | None
    phone: str | None
    created_at: datetime
    active_subscriptions: int
    outstanding_amount: Decimal


class StaffCustomerDetail(StaffCustomerRow):
    address: str | None
    profile_updated_at: datetime | None
    subscriptions_total: int
    open_quotations: int
    invoiced_total: Decimal
    paid_total: Decimal
    overdue_amount: Decimal
