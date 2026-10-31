"""Forgot-password flow: single-use, time-limited reset links.

- The token is 32 random bytes (URL-safe). Only its SHA-256 hash is stored.
- Requesting a reset never reveals whether the email has an account.
- A new request invalidates earlier unused links for that user.
- Using a link sets the password, marks the link used, invalidates every other link and
  signs the user out of every session.

Password rule on reset keeps each account's existing creation rule, so nothing is
weakened: customers use the signup rule (9+ characters with uppercase, lowercase and a
special character); staff and admins use the internal rule (12+ characters).
"""

import hashlib
import logging
import secrets
from datetime import UTC, datetime, timedelta
from urllib.parse import quote

from sqlalchemy import delete, select, update
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.email import EmailSender, OutgoingEmail
from app.core.security import hash_password
from app.models.auth_session import AuthSession
from app.models.password_reset import PasswordResetToken
from app.models.user import User, UserRole
from app.schemas.auth import _PASSWORD_RULES, SIGNUP_PASSWORD_MIN_LENGTH
from app.schemas.user import PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH
from app.services.errors import InvalidInputError
from app.services.user_service import get_user_by_email

logger = logging.getLogger("app.password_reset")

INVALID_LINK = "This reset link is invalid or has expired. Request a new one."


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def password_problems(role: UserRole, password: str) -> list[str]:
    """Problems with a new password for this role, empty when it's acceptable."""
    if len(password) > PASSWORD_MAX_LENGTH:
        return [f"Use at most {PASSWORD_MAX_LENGTH} characters"]
    if not password.strip():
        return ["Password must not be blank"]
    if role == UserRole.CUSTOMER:
        problems = []
        if len(password) < SIGNUP_PASSWORD_MIN_LENGTH:
            problems.append(f"Use at least {SIGNUP_PASSWORD_MIN_LENGTH} characters")
        missing = [
            label for pattern, label in _PASSWORD_RULES if not pattern.search(password)
        ]
        if missing:
            problems.append("Password must contain " + ", ".join(missing))
        return problems
    if len(password) < PASSWORD_MIN_LENGTH:
        return [f"Use at least {PASSWORD_MIN_LENGTH} characters"]
    return []


def request_reset(db: Session, email: str, send: EmailSender) -> None:
    """Emails a reset link if the email belongs to an active account. Always silent."""
    user = get_user_by_email(db, email)
    if user is None or not user.is_active:
        return

    settings = get_settings()
    now = datetime.now(UTC)
    # Earlier unused links stop working, and expired rows are cleaned up.
    db.execute(
        update(PasswordResetToken)
        .where(
            PasswordResetToken.user_id == user.id, PasswordResetToken.used_at.is_(None)
        )
        .values(used_at=now)
    )
    db.execute(delete(PasswordResetToken).where(PasswordResetToken.expires_at < now))

    token = secrets.token_urlsafe(32)
    db.add(
        PasswordResetToken(
            user_id=user.id,
            token_hash=hash_token(token),
            expires_at=now + timedelta(minutes=settings.password_reset_token_minutes),
        )
    )
    db.commit()

    link = f"{settings.frontend_url.rstrip('/')}/reset-password?token={quote(token)}"
    try:
        send(
            OutgoingEmail(
                to=user.email,
                subject="Reset your Brightloop password",
                body=(
                    "Someone asked to reset the password for this account.\n\n"
                    f"Open this link to choose a new password:\n{link}\n\n"
                    f"The link works once and expires in "
                    f"{settings.password_reset_token_minutes} minutes.\n"
                    "If you didn't ask for this, you can ignore this email."
                ),
            )
        )
    except Exception:  # Delivery failure must not reveal whether the account exists.
        logger.exception("Could not send password reset email")


def reset_password(db: Session, token: str, new_password: str) -> None:
    now = datetime.now(UTC)
    row = db.scalar(
        select(PasswordResetToken)
        .where(
            PasswordResetToken.token_hash == hash_token(token),
            PasswordResetToken.used_at.is_(None),
            PasswordResetToken.expires_at > now,
        )
        .with_for_update()
    )
    if row is None:
        raise InvalidInputError(INVALID_LINK)
    user = db.get(User, row.user_id)
    if user is None or not user.is_active:
        raise InvalidInputError(INVALID_LINK)

    problems = password_problems(user.role, new_password)
    if problems:
        raise InvalidInputError(". ".join(problems))

    user.password_hash = hash_password(new_password)
    db.execute(
        update(PasswordResetToken)
        .where(
            PasswordResetToken.user_id == user.id, PasswordResetToken.used_at.is_(None)
        )
        .values(used_at=now)
    )
    # Sign out everywhere: whoever had the old password loses access.
    db.execute(delete(AuthSession).where(AuthSession.user_id == user.id))
    db.commit()
