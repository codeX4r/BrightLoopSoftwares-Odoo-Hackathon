import uuid
from decimal import Decimal
from typing import Annotated

from pydantic import BaseModel, EmailStr, Field, StringConstraints

from app.models.user import User

# Money in rupees with paise, serialized as a string ("1180.00") so no precision is lost.
Money = Annotated[Decimal, Field(ge=0, max_digits=12, decimal_places=2)]
PositiveMoney = Annotated[Decimal, Field(gt=0, max_digits=12, decimal_places=2)]
TaxRate = Annotated[Decimal, Field(ge=0, le=100, max_digits=5, decimal_places=2)]

ShortText = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)
]
OptionalNotes = Annotated[
    str | None, StringConstraints(strip_whitespace=True, max_length=2000)
]

DEFAULT_PAGE_SIZE = 20
MAX_PAGE_SIZE = 100


class Page[T](BaseModel):
    items: list[T]
    total: int
    page: int
    page_size: int


class CustomerSummary(BaseModel):
    """The customer as quotation, invoice and payment screens show it.

    Name and company come from the customer's profile and are null until they've
    filled it in, so screens should fall back to the email.
    """

    id: uuid.UUID
    email: EmailStr
    full_name: str | None = None
    company_name: str | None = None


def customer_summary(user: User) -> CustomerSummary:
    profile = user.profile
    return CustomerSummary(
        id=user.id,
        email=user.email,
        full_name=profile.full_name if profile else None,
        company_name=profile.company_name if profile else None,
    )
