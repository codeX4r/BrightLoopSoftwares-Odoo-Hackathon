"""Credential checks and access-token revocation."""

from datetime import UTC, datetime

from sqlalchemy import delete
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.security import (
    hash_password,
    password_needs_rehash,
    verify_dummy_password,
    verify_password,
)
from app.models.revoked_token import RevokedToken
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


def revoke_token(db: Session, *, jti: str, expires_at: datetime) -> None:
    now = datetime.now(UTC)
    # Opportunistic cleanup: expired tokens are rejected by signature checks anyway.
    db.execute(delete(RevokedToken).where(RevokedToken.expires_at < now))
    if db.get(RevokedToken, jti) is None:
        db.add(RevokedToken(jti=jti, expires_at=expires_at))
    try:
        db.commit()
    except IntegrityError:
        # A concurrent logout already revoked this token.
        db.rollback()


def is_token_revoked(db: Session, jti: str) -> bool:
    return db.get(RevokedToken, jti) is not None
