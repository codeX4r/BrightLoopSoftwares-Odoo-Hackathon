"""User persistence and account rules. Routes and the CLI go through here."""

import uuid
from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models.user import User, UserRole


class EmailAlreadyExistsError(Exception):
    pass


def normalize_email(email: str) -> str:
    return email.strip().lower()


def get_user_by_id(db: Session, user_id: uuid.UUID) -> User | None:
    return db.get(User, user_id)


def get_user_by_email(db: Session, email: str) -> User | None:
    return db.scalar(select(User).where(User.email == normalize_email(email)))


def create_user(db: Session, *, email: str, password: str, role: UserRole) -> User:
    """Creates an account with a hashed password. Raises EmailAlreadyExistsError."""
    email = normalize_email(email)
    if get_user_by_email(db, email) is not None:
        raise EmailAlreadyExistsError(email)

    user = User(email=email, password_hash=hash_password(password), role=role)
    db.add(user)
    try:
        db.commit()
    except IntegrityError as exc:
        # A concurrent request inserted the same email after our check.
        db.rollback()
        raise EmailAlreadyExistsError(email) from exc
    db.refresh(user)
    return user


def list_users_by_role(db: Session, role: UserRole) -> Sequence[User]:
    return db.scalars(
        select(User).where(User.role == role).order_by(User.created_at, User.email)
    ).all()


def set_user_active(db: Session, user: User, *, is_active: bool) -> User:
    user.is_active = is_active
    db.commit()
    db.refresh(user)
    return user


def can_view_user(actor: User, target: User) -> bool:
    """Object-level access rule for user profiles.

    Admins see everyone, staff see themselves and customers, customers only themselves.
    """
    if actor.id == target.id:
        return True
    if actor.role == UserRole.ADMIN:
        return True
    if actor.role == UserRole.STAFF:
        return target.role == UserRole.CUSTOMER
    return False
