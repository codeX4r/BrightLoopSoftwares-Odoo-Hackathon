from fastapi import APIRouter

from app.api.permissions import CustomerOnly
from app.db.session import DbSession
from app.schemas.profile import CustomerProfileRead, CustomerProfileUpdate
from app.services import profile_service

router = APIRouter(prefix="/profile", tags=["portal (customer): profile"])


@router.get("", response_model=CustomerProfileRead)
def get_my_profile(customer: CustomerOnly) -> CustomerProfileRead:
    """The signed-in customer's contact details. Empty until first saved."""
    return profile_service.profile_read(customer)


@router.patch("", response_model=CustomerProfileRead)
def update_my_profile(
    payload: CustomerProfileUpdate, customer: CustomerOnly, db: DbSession
) -> CustomerProfileRead:
    """Updates name, company, phone and address. Send only the fields to change."""
    return profile_service.update_profile(db, customer, payload)
