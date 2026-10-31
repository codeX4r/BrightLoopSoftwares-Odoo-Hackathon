"""Customer contact details (customer_profiles)."""

from sqlalchemy.orm import Session

from app.models.customer_profile import CustomerProfile
from app.models.user import User
from app.schemas.profile import CustomerProfileRead, CustomerProfileUpdate

PROFILE_FIELDS = ("full_name", "company_name", "phone", "address")


def profile_read(user: User) -> CustomerProfileRead:
    profile = user.profile
    return CustomerProfileRead(
        email=user.email,
        full_name=profile.full_name if profile else None,
        company_name=profile.company_name if profile else None,
        phone=profile.phone if profile else None,
        address=profile.address if profile else None,
        updated_at=profile.updated_at if profile else None,
    )


def update_profile(
    db: Session, user: User, data: CustomerProfileUpdate
) -> CustomerProfileRead:
    """Creates the profile on first save, then applies only the fields that were sent."""
    changes = data.model_dump(exclude_unset=True)
    profile = user.profile
    if profile is None:
        profile = CustomerProfile(user_id=user.id)
        db.add(profile)
        user.profile = profile
    for field in PROFILE_FIELDS:
        if field in changes:
            # Blank strings are stored as NULL so "not provided" has one representation.
            setattr(profile, field, changes[field] or None)
    db.commit()
    db.refresh(profile)
    return profile_read(user)
