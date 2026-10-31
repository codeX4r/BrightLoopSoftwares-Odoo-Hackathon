from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, EmailStr, StringConstraints

ProfileName = Annotated[
    str | None, StringConstraints(strip_whitespace=True, max_length=200)
]
ProfilePhone = Annotated[
    str | None,
    # Digits with optional +, spaces, brackets and dashes, e.g. +91 98765 43210.
    StringConstraints(
        strip_whitespace=True, max_length=32, pattern=r"^(\+?[0-9][0-9 ()\-]{5,31})?$"
    ),
]
ProfileAddress = Annotated[
    str | None, StringConstraints(strip_whitespace=True, max_length=1000)
]


class CustomerProfileRead(BaseModel):
    """The signed-in customer's contact details. Fields are null until they're saved."""

    email: EmailStr
    full_name: str | None
    company_name: str | None
    phone: str | None
    address: str | None
    updated_at: datetime | None


class CustomerProfileUpdate(BaseModel):
    """Partial update: omitted fields stay as they are; "" or null clears a field.

    Email is not editable here because it's the login.
    """

    model_config = ConfigDict(extra="forbid")

    full_name: ProfileName = None
    company_name: ProfileName = None
    phone: ProfilePhone = None
    address: ProfileAddress = None
