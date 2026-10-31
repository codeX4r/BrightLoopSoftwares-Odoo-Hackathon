import uuid
from decimal import Decimal
from typing import Annotated

from pydantic import BaseModel, ConfigDict, EmailStr, Field, StringConstraints

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
    """The customer as staff screens show it.

    Only the email for now: names and companies come from the customer-profile work
    owned by another developer.
    """

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: EmailStr
