import uuid
from typing import Annotated

from fastapi import APIRouter, Query, status

from app.api.permissions import StaffOrAdmin
from app.db.session import DbSession
from app.schemas.common import DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, Page
from app.schemas.customer import (
    StaffCustomerCreate,
    StaffCustomerDetail,
    StaffCustomerRow,
)
from app.schemas.profile import CustomerProfileUpdate
from app.services import customer_service

router = APIRouter(prefix="/customers", tags=["staff: customers"])


@router.get("", response_model=Page[StaffCustomerRow])
def list_customers(
    _actor: StaffOrAdmin,
    db: DbSession,
    search: Annotated[str | None, Query(max_length=100)] = None,
    is_active: bool | None = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=MAX_PAGE_SIZE)] = DEFAULT_PAGE_SIZE,
) -> Page[StaffCustomerRow]:
    """Customers, newest first. Searches email, name, company and phone."""
    result = customer_service.list_customers(
        db, search=search, is_active=is_active, page=page, page_size=page_size
    )
    return Page[StaffCustomerRow](
        items=result.items, total=result.total, page=page, page_size=page_size
    )


@router.post(
    "", response_model=StaffCustomerDetail, status_code=status.HTTP_201_CREATED
)
def create_customer(
    payload: StaffCustomerCreate, _actor: StaffOrAdmin, db: DbSession
) -> StaffCustomerDetail:
    """Creates a CUSTOMER login with contact details. Share the password with them."""
    return customer_service.create_customer(db, payload)


@router.get("/{customer_id}", response_model=StaffCustomerDetail)
def get_customer(
    customer_id: uuid.UUID, _actor: StaffOrAdmin, db: DbSession
) -> StaffCustomerDetail:
    """Contact details plus subscription and billing totals for one customer."""
    return customer_service.get_customer(db, customer_id)


@router.patch("/{customer_id}", response_model=StaffCustomerDetail)
def update_customer(
    customer_id: uuid.UUID,
    payload: CustomerProfileUpdate,
    _actor: StaffOrAdmin,
    db: DbSession,
) -> StaffCustomerDetail:
    """Edits name, company, phone and address. Email and password are not changed here."""
    return customer_service.update_customer(db, customer_id, payload)
