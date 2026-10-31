"""Admin APIs for customer and staff accounts, under /api/admin.

Every route requires an ADMIN. These add list, search and detail views with figures
from the billing tables. Existing endpoints are reused, not duplicated:

- POST /api/users/staff            creates a staff account (unchanged)
- PATCH /api/users/{id}/status     activates or deactivates any account (unchanged)
- /api/staff/subscriptions?customer_id=, /api/staff/invoices?customer_id=,
  /api/staff/payments              customer history (Sahil's staff API, admin allowed)
"""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.deps import require_roles
from app.db.session import DbSession
from app.models.user import UserRole
from app.schemas.catalog import Page
from app.schemas.people import (
    CustomerDetailRead,
    CustomerRow,
    StaffDetailRead,
    StaffRow,
    customer_row,
    payment_brief,
    staff_row,
)
from app.schemas.user import UserCreate
from app.services import clock, people_service, profile_service, user_service

router = APIRouter(
    prefix="/api/admin",
    tags=["admin: customers & staff"],
    dependencies=[Depends(require_roles(UserRole.ADMIN))],
)

Limit = Annotated[int, Query(ge=1, le=100)]
Offset = Annotated[int, Query(ge=0)]
Search = Annotated[str | None, Query(max_length=100)]


# --- Customers ---------------------------------------------------------------


@router.get("/customers", response_model=Page[CustomerRow])
def list_customers(
    db: DbSession,
    q: Search = None,
    is_active: bool | None = None,
    limit: Limit = 20,
    offset: Offset = 0,
) -> Page[CustomerRow]:
    """Customer accounts with subscription, invoice and payment figures."""
    page = people_service.list_customers(
        db, q=q, is_active=is_active, limit=limit, offset=offset
    )
    figures = people_service.customer_figures(
        db, [u.id for u in page.items], clock.today()
    )
    profiles = profile_service.customer_profiles(db, [u.id for u in page.items])
    return Page[CustomerRow](
        items=[customer_row(u, figures[u.id], profiles.get(u.id)) for u in page.items],
        total=page.total,
        limit=limit,
        offset=offset,
    )


@router.post(
    "/customers", response_model=CustomerRow, status_code=status.HTTP_201_CREATED
)
def create_customer(payload: UserCreate, db: DbSession) -> CustomerRow:
    """Creates a CUSTOMER account internally, with the same rules as staff creation."""
    try:
        user = user_service.create_user(
            db, email=payload.email, password=payload.password, role=UserRole.CUSTOMER
        )
    except user_service.EmailAlreadyExistsError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists",
        ) from None
    figures = people_service.customer_figures(db, [user.id], clock.today())
    return customer_row(user, figures[user.id])


@router.get("/customers/{customer_id}", response_model=CustomerDetailRead)
def get_customer(customer_id: uuid.UUID, db: DbSession) -> CustomerDetailRead:
    detail = people_service.get_customer_detail(db, customer_id, clock.today())
    profiles = profile_service.customer_profiles(db, [detail.user.id])
    row = customer_row(detail.user, detail.figures, profiles.get(detail.user.id))
    return CustomerDetailRead(
        **row.model_dump(),
        recent_payments=[payment_brief(p) for p in detail.recent_payments],
    )


# --- Staff -------------------------------------------------------------------


@router.get("/staff", response_model=Page[StaffRow])
def list_staff(
    db: DbSession,
    q: Search = None,
    is_active: bool | None = None,
    limit: Limit = 20,
    offset: Offset = 0,
) -> Page[StaffRow]:
    """Staff accounts with the work they have recorded."""
    page = people_service.list_staff(
        db, q=q, is_active=is_active, limit=limit, offset=offset
    )
    figures = people_service.staff_figures(db, [u.id for u in page.items])
    profiles = profile_service.staff_profiles(db, [u.id for u in page.items])
    return Page[StaffRow](
        items=[staff_row(u, figures[u.id], profiles.get(u.id)) for u in page.items],
        total=page.total,
        limit=limit,
        offset=offset,
    )


@router.get("/staff/{staff_id}", response_model=StaffDetailRead)
def get_staff(staff_id: uuid.UUID, db: DbSession) -> StaffDetailRead:
    detail = people_service.get_staff_detail(db, staff_id)
    profiles = profile_service.staff_profiles(db, [detail.user.id])
    row = staff_row(detail.user, detail.figures, profiles.get(detail.user.id))
    return StaffDetailRead(
        **row.model_dump(),
        recent_payments=[payment_brief(p) for p in detail.recent_payments],
    )
