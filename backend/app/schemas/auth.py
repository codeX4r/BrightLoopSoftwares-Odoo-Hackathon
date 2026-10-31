import uuid
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.user import UserRole
from app.schemas.user import PASSWORD_MAX_LENGTH


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
