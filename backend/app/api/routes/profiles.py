"""Profiles, staff editing, tax options for staff, and the forgot-password flow.

- GET/PATCH /api/customers/{id}/profile  one shared endpoint for admin, staff and portal.
  Admin: any customer. Staff: read customers. Customer: only their own (use /me for the id).
- PATCH /api/admin/staff/{id}             admin edits a staff member's email, name, phone.
- GET  /api/staff/taxes, /api/staff/taxes/resolve  active tax rules for the quotation form.
- POST /api/auth/password-reset/request|confirm   forgot-password (public).
"""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status

from app.api.deps import AdminUser, CurrentUser
from app.api.permissions import StaffOrAdmin
from app.core.email import EmailSender, get_email_sender
from app.core.rate_limit import LoginRateLimiter, get_password_reset_rate_limiter
from app.db.session import DbSession
from app.models.profiles import CustomerProfile
from app.models.tax import Tax
from app.models.user import User
from app.schemas.admin_modules import (
    CustomerProfileRead,
    CustomerProfileUpdate,
    PasswordResetConfirm,
    PasswordResetRequest,
    ResolvedTax,
    StaffProfileRead,
    StaffUpdate,
    TaxOption,
)
from app.services import password_reset_service, profile_service, tax_service
from app.services.user_service import normalize_email

router = APIRouter(tags=["profiles, staff editing, tax options, password reset"])


def customer_profile_read(
    user: User, profile: CustomerProfile | None
) -> CustomerProfileRead:
    return CustomerProfileRead(
        user_id=user.id,
        email=user.email,
        full_name=profile.full_name if profile else None,
        company_name=profile.company_name if profile else None,
        phone=profile.phone if profile else None,
        address=profile.address if profile else None,
        updated_at=profile.updated_at if profile else None,
    )


@router.get("/api/customers/{customer_id}/profile", response_model=CustomerProfileRead)
def get_customer_profile(
    customer_id: uuid.UUID, actor: CurrentUser, db: DbSession
) -> CustomerProfileRead:
    user, profile = profile_service.get_customer_profile(db, actor, customer_id)
    return customer_profile_read(user, profile)


@router.patch(
    "/api/customers/{customer_id}/profile", response_model=CustomerProfileRead
)
def update_customer_profile(
    customer_id: uuid.UUID,
    payload: CustomerProfileUpdate,
    actor: CurrentUser,
    db: DbSession,
) -> CustomerProfileRead:
    user, profile = profile_service.update_customer_profile(
        db, actor, customer_id, payload.model_dump(exclude_unset=True)
    )
    return customer_profile_read(user, profile)


@router.get("/api/admin/staff/{staff_id}/profile", response_model=StaffProfileRead)
def get_staff_profile(
    staff_id: uuid.UUID, _admin: AdminUser, db: DbSession
) -> StaffProfileRead:
    user, profile = profile_service.get_staff_profile(db, staff_id)
    return StaffProfileRead(
        user_id=user.id,
        email=user.email,
        full_name=profile.full_name if profile else None,
        phone=profile.phone if profile else None,
    )


@router.patch("/api/admin/staff/{staff_id}", response_model=StaffProfileRead)
def update_staff(
    staff_id: uuid.UUID, payload: StaffUpdate, _admin: AdminUser, db: DbSession
) -> StaffProfileRead:
    """Edits email, name and phone. Role and active status are not changed here."""
    user, profile = profile_service.update_staff(
        db, staff_id, payload.model_dump(exclude_unset=True)
    )
    return StaffProfileRead(
        user_id=user.id,
        email=user.email,
        full_name=profile.full_name,
        phone=profile.phone,
    )


def tax_option(tax: Tax) -> TaxOption:
    return TaxOption(id=tax.id, name=tax.name, rate=tax.rate, is_default=tax.is_default)


@router.get("/api/staff/taxes", response_model=list[TaxOption])
def staff_tax_options(_actor: StaffOrAdmin, db: DbSession) -> list[TaxOption]:
    """Active taxes for the quotation form, default first."""
    return [tax_option(t) for t in tax_service.active_taxes(db)]


@router.get("/api/staff/taxes/resolve", response_model=ResolvedTax)
def resolve_tax(
    _actor: StaffOrAdmin, db: DbSession, product_id: uuid.UUID | None = None
) -> ResolvedTax:
    """The tax that applies to a product (product > product type > default)."""
    tax = tax_service.resolve_tax(db, product_id)
    return ResolvedTax(product_id=product_id, tax=tax_option(tax) if tax else None)


def _client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


@router.post("/api/auth/password-reset/request", status_code=status.HTTP_202_ACCEPTED)
def request_password_reset(
    payload: PasswordResetRequest,
    request: Request,
    db: DbSession,
    limiter: Annotated[LoginRateLimiter, Depends(get_password_reset_rate_limiter)],
    send: Annotated[EmailSender, Depends(get_email_sender)],
) -> dict[str, str]:
    """Always answers the same way, whether or not the email has an account."""
    email = normalize_email(payload.email)
    ip = _client_ip(request)
    retry_after = limiter.retry_after(email, ip)
    if retry_after is not None:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many reset requests. Try again later.",
            headers={"Retry-After": str(retry_after)},
        )
    limiter.record_failure(email, ip)  # every request counts toward the limit
    password_reset_service.request_reset(db, email, send)
    return {
        "detail": "If an account exists for this email, a reset link is on its way."
    }


@router.post("/api/auth/password-reset/confirm", status_code=status.HTTP_204_NO_CONTENT)
def confirm_password_reset(payload: PasswordResetConfirm, db: DbSession) -> Response:
    password_reset_service.reset_password(db, payload.token, payload.new_password)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
