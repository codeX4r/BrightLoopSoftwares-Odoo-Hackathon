"""Customer and staff profiles (name, company, phone, address).

Access rules reuse the existing user rules (user_service.can_view_user):
- Admin: read and edit every customer and staff profile.
- Staff: read customer profiles (staff can already view customers); no editing.
- Customer: read and edit only their own profile.
Anything a caller may not see returns 404, the same as a missing record.
"""

import uuid
from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.profiles import CustomerProfile, StaffProfile
from app.models.user import User, UserRole
from app.services import user_service
from app.services.errors import ConflictError, NotFoundError, PermissionDeniedError

CUSTOMER_FIELDS = ("full_name", "company_name", "phone", "address")
STAFF_FIELDS = ("full_name", "phone")


def _clean(changes: dict, fields: Sequence[str]) -> dict:
    """Trims text; empty strings clear the field."""
    cleaned = {}
    for field_name in fields:
        if field_name in changes:
            value = changes[field_name]
            if isinstance(value, str):
                value = value.strip() or None
            cleaned[field_name] = value
    return cleaned


def _customer(db: Session, actor: User, customer_id: uuid.UUID) -> User:
    target = db.get(User, customer_id)
    if (
        target is None
        or target.role != UserRole.CUSTOMER
        or not user_service.can_view_user(actor, target)
    ):
        raise NotFoundError("Customer not found.")
    return target


def get_customer_profile(
    db: Session, actor: User, customer_id: uuid.UUID
) -> tuple[User, CustomerProfile | None]:
    target = _customer(db, actor, customer_id)
    return target, db.get(CustomerProfile, target.id)


def update_customer_profile(
    db: Session, actor: User, customer_id: uuid.UUID, changes: dict
) -> tuple[User, CustomerProfile]:
    target = _customer(db, actor, customer_id)
    if actor.role != UserRole.ADMIN and actor.id != target.id:
        raise PermissionDeniedError(
            "Only an admin or the customer can edit this profile."
        )
    profile = db.get(CustomerProfile, target.id)
    if profile is None:
        profile = CustomerProfile(user_id=target.id)
        db.add(profile)
    for field_name, value in _clean(changes, CUSTOMER_FIELDS).items():
        setattr(profile, field_name, value)
    db.commit()
    db.refresh(profile)
    return target, profile


def customer_profiles(
    db: Session, customer_ids: Sequence[uuid.UUID]
) -> dict[uuid.UUID, CustomerProfile]:
    if not customer_ids:
        return {}
    rows = db.scalars(
        select(CustomerProfile).where(CustomerProfile.user_id.in_(list(customer_ids)))
    )
    return {p.user_id: p for p in rows}


def staff_profiles(
    db: Session, staff_ids: Sequence[uuid.UUID]
) -> dict[uuid.UUID, StaffProfile]:
    if not staff_ids:
        return {}
    rows = db.scalars(
        select(StaffProfile).where(StaffProfile.user_id.in_(list(staff_ids)))
    )
    return {p.user_id: p for p in rows}


def get_staff_profile(
    db: Session, staff_id: uuid.UUID
) -> tuple[User, StaffProfile | None]:
    user = db.get(User, staff_id)
    if user is None or user.role != UserRole.STAFF:
        raise NotFoundError("Staff member not found.")
    return user, db.get(StaffProfile, user.id)


def update_staff(
    db: Session, staff_id: uuid.UUID, changes: dict
) -> tuple[User, StaffProfile]:
    """Admin edit of a staff member's email and profile. Role and status are untouched."""
    user = db.get(User, staff_id)
    if user is None or user.role != UserRole.STAFF:
        raise NotFoundError("Staff member not found.")

    if changes.get("email") is not None:
        email = user_service.normalize_email(changes["email"])
        if email != user.email:
            if user_service.get_user_by_email(db, email) is not None:
                raise ConflictError("An account with this email already exists.")
            user.email = email

    profile = db.get(StaffProfile, user.id)
    if profile is None:
        profile = StaffProfile(user_id=user.id)
        db.add(profile)
    for field_name, value in _clean(changes, STAFF_FIELDS).items():
        setattr(profile, field_name, value)
    db.commit()
    db.refresh(user)
    db.refresh(profile)
    return user, profile
