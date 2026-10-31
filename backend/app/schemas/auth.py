import re
import uuid
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.models.user import UserRole
from app.schemas.user import PASSWORD_MAX_LENGTH

# Customer password rule from the problem statement: longer than 8 characters, with at
# least one uppercase letter, one lowercase letter and one special character.
SIGNUP_PASSWORD_MIN_LENGTH = 9
_PASSWORD_RULES = (
    (re.compile(r"[A-Z]"), "an uppercase letter"),
    (re.compile(r"[a-z]"), "a lowercase letter"),
    (re.compile(r"[^A-Za-z0-9\s]"), "a special character"),
)


def check_customer_password(value: str) -> str:
    """Applies the customer password rule. Raises ValueError listing what's missing."""
    if len(value) < SIGNUP_PASSWORD_MIN_LENGTH:
        raise ValueError(
            f"Password must be at least {SIGNUP_PASSWORD_MIN_LENGTH} characters"
        )
    missing = [label for pattern, label in _PASSWORD_RULES if not pattern.search(value)]
    if missing:
        raise ValueError("Password must contain " + ", ".join(missing))
    return value


class SignupRequest(BaseModel):
    """Public self-registration. It always creates a CUSTOMER account.

    There is deliberately no role field, and extra fields are rejected, so sending
    "role": "ADMIN" fails with 422 instead of being silently ignored. Admin and staff
    accounts are created only by an admin.
    """

    model_config = ConfigDict(extra="forbid")

    email: EmailStr = Field(max_length=320)
    password: str = Field(
        min_length=SIGNUP_PASSWORD_MIN_LENGTH, max_length=PASSWORD_MAX_LENGTH
    )

    @field_validator("password")
    @classmethod
    def password_strength(cls, value: str) -> str:
        return check_customer_password(value)


class LoginRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: EmailStr = Field(max_length=320)
    # No strength rules here: login only checks the password, it never sets one.
    password: str = Field(min_length=1, max_length=PASSWORD_MAX_LENGTH)
    # Role picked on the login page. Optional for API clients. It is only checked against
    # the role stored in the database and never grants a role by itself.
    role: UserRole | None = None


class LoginResponse(BaseModel):
    access_token: str
    token_type: Literal["bearer"] = "bearer"
    expires_in: int
    user_id: uuid.UUID
    email: EmailStr
    role: UserRole
