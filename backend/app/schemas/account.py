from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.schemas.auth import SIGNUP_PASSWORD_MIN_LENGTH, SignupRequest
from app.schemas.user import PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH


class PasswordChangeRequest(BaseModel):
    """A signed-in user changes their password by confirming the current one.

    The new password follows the signup rule: more than 8 characters, with an uppercase
    letter, a lowercase letter and a special character. It must differ from the current one.
    """

    model_config = ConfigDict(extra="forbid")

    current_password: str = Field(min_length=1, max_length=PASSWORD_MAX_LENGTH)
    new_password: str = Field(
        min_length=SIGNUP_PASSWORD_MIN_LENGTH, max_length=PASSWORD_MAX_LENGTH
    )

    @field_validator("new_password")
    @classmethod
    def new_password_strength(cls, value: str) -> str:
        return SignupRequest.password_strength(value)

    @model_validator(mode="after")
    def new_password_differs(self) -> "PasswordChangeRequest":
        if self.new_password == self.current_password:
            raise ValueError("New password must be different from the current password")
        return self


class StaffPasswordChangeRequest(PasswordChangeRequest):
    """Staff and admin: the signup rule plus the internal-account minimum of 12 characters
    (PASSWORD_MIN_LENGTH), so a password can't be changed to something weaker than what
    an admin is allowed to create."""

    new_password: str = Field(
        min_length=PASSWORD_MIN_LENGTH, max_length=PASSWORD_MAX_LENGTH
    )
