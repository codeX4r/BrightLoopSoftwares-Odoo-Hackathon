"""Credential checks and server-side session management."""

from datetime import UTC, datetime, timedelta

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import (
    create_session_token,
    hash_password,
    password_needs_rehash,
    verify_dummy_password,
    verify_password,
)
from app.models.auth_session import AuthSession
from app.models.user import User
from app.services.user_service import get_user_by_email


def authenticate(db: Session, email: str, password: str) -> User | None:
    """Returns the user if the credentials are valid and the account is active.

    Every failure returns None so callers can't tell an unknown email from a wrong
    password or a deactivated account.
    """
    user = get_user_by_email(db, email)
    if user is None:
        verify_dummy_password(password)
        return None
    if not verify_password(password, user.password_hash):
        return None
    if not user.is_active:
        return None

    if password_needs_rehash(user.password_hash):
        user.password_hash = hash_password(password)
        db.commit()
    return user


def create_session(db: Session, user: User) -> AuthSession:
    """Starts a session for the user. Lifetime comes from ACCESS_TOKEN_EXPIRE_MINUTES."""
    settings = get_settings()
    now = datetime.now(UTC)
    # Remove sessions that have already expired so the table doesn't grow forever.
    db.execute(delete(AuthSession).where(AuthSession.expires_at < now))
    session = AuthSession(
        token=create_session_token(),
        user_id=user.id,
        expires_at=now + timedelta(minutes=settings.access_token_expire_minutes),
    )
    db.add(session)
    db.commit()
    return session


def get_active_session(db: Session, token: str) -> AuthSession | None:
    """Returns the session for this token if it exists and has not expired."""
    return db.scalar(
        select(AuthSession).where(
            AuthSession.token == token,
            AuthSession.expires_at > datetime.now(UTC),
        )
    )


def delete_session(db: Session, token: str) -> None:
    db.execute(delete(AuthSession).where(AuthSession.token == token))
    db.commit()
