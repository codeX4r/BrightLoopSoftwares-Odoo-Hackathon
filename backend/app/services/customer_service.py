"""Customer management for staff: list, search, create, edit and per-customer totals.

A customer is a users row with role CUSTOMER plus its optional customer_profiles row.
"""

import uuid
from collections.abc import Sequence
from dataclasses import dataclass
from decimal import Decimal

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.models.customer_profile import CustomerProfile
from app.models.invoice import Invoice, InvoiceStatus
from app.models.subscription import Subscription, SubscriptionStatus
from app.models.user import User, UserRole
from app.schemas.customer import (
    StaffCustomerCreate,
    StaffCustomerDetail,
    StaffCustomerRow,
)
from app.schemas.profile import CustomerProfileUpdate
from app.services import clock, profile_service, user_service
from app.services.errors import BusinessRuleError, NotFoundError
from app.services.invoice_service import overdue_condition
from app.services.money import ZERO

NOT_FOUND = "Customer not found"


@dataclass(frozen=True)
class CustomerList:
    items: list[StaffCustomerRow]
    total: int


def _customers():
    return (
        select(User)
        .outerjoin(CustomerProfile, CustomerProfile.user_id == User.id)
        .where(User.role == UserRole.CUSTOMER)
    )


def _row_fields(user: User, active: int, outstanding: Decimal) -> dict:
    profile = user.profile
    return {
        "id": user.id,
        "email": user.email,
        "is_active": user.is_active,
        "full_name": profile.full_name if profile else None,
        "company_name": profile.company_name if profile else None,
        "phone": profile.phone if profile else None,
        "created_at": user.created_at,
        "active_subscriptions": active,
        "outstanding_amount": outstanding,
    }


def _active_counts(db: Session, ids: Sequence[uuid.UUID]) -> dict[uuid.UUID, int]:
    return dict(
        db.execute(
            select(Subscription.customer_id, func.count())
            .where(
                Subscription.customer_id.in_(ids),
                Subscription.status == SubscriptionStatus.ACTIVE,
            )
            .group_by(Subscription.customer_id)
        ).all()
    )


def _outstanding(db: Session, ids: Sequence[uuid.UUID]) -> dict[uuid.UUID, Decimal]:
    return dict(
        db.execute(
            select(Invoice.customer_id, func.sum(Invoice.total - Invoice.amount_paid))
            .where(
                Invoice.customer_id.in_(ids),
                Invoice.status == InvoiceStatus.CONFIRMED,
            )
            .group_by(Invoice.customer_id)
        ).all()
    )


def list_customers(
    db: Session,
    *,
    search: str | None,
    is_active: bool | None,
    page: int,
    page_size: int,
) -> CustomerList:
    query = _customers()
    if search:
        pattern = f"%{search.strip()}%"
        query = query.where(
            or_(
                User.email.ilike(pattern),
                CustomerProfile.full_name.ilike(pattern),
                CustomerProfile.company_name.ilike(pattern),
                CustomerProfile.phone.ilike(pattern),
            )
        )
    if is_active is not None:
        query = query.where(User.is_active.is_(is_active))

    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    users = db.scalars(
        query.options(selectinload(User.profile))
        .order_by(User.created_at.desc(), User.email)
        .limit(page_size)
        .offset((page - 1) * page_size)
    ).all()
    ids = [u.id for u in users]
    active = _active_counts(db, ids) if ids else {}
    outstanding = _outstanding(db, ids) if ids else {}
    return CustomerList(
        items=[
            StaffCustomerRow(
                **_row_fields(u, active.get(u.id, 0), outstanding.get(u.id) or ZERO)
            )
            for u in users
        ],
        total=total,
    )


def _get_customer_user(db: Session, customer_id: uuid.UUID) -> User:
    user = db.scalar(
        select(User)
        .options(selectinload(User.profile))
        .where(User.id == customer_id, User.role == UserRole.CUSTOMER)
    )
    if user is None:
        raise NotFoundError(NOT_FOUND)
    return user


def get_customer(db: Session, customer_id: uuid.UUID) -> StaffCustomerDetail:
    user = _get_customer_user(db, customer_id)
    status_counts = dict(
        db.execute(
            select(Subscription.status, func.count())
            .where(Subscription.customer_id == user.id)
            .group_by(Subscription.status)
        ).all()
    )
    invoiced, paid = db.execute(
        select(
            func.coalesce(func.sum(Invoice.total), 0),
            func.coalesce(func.sum(Invoice.amount_paid), 0),
        ).where(
            Invoice.customer_id == user.id,
            Invoice.status.in_((InvoiceStatus.CONFIRMED, InvoiceStatus.PAID)),
        )
    ).one()
    outstanding = _outstanding(db, [user.id]).get(user.id) or ZERO
    overdue = db.scalar(
        select(func.coalesce(func.sum(Invoice.total - Invoice.amount_paid), 0)).where(
            Invoice.customer_id == user.id, overdue_condition(clock.today())
        )
    )
    profile = user.profile
    return StaffCustomerDetail(
        **_row_fields(
            user, status_counts.get(SubscriptionStatus.ACTIVE, 0), outstanding
        ),
        address=profile.address if profile else None,
        profile_updated_at=profile.updated_at if profile else None,
        subscriptions_total=sum(
            count
            for status, count in status_counts.items()
            if status != SubscriptionStatus.DRAFT
        ),
        open_quotations=status_counts.get(SubscriptionStatus.QUOTATION, 0),
        invoiced_total=Decimal(invoiced or 0),
        paid_total=Decimal(paid or 0),
        overdue_amount=Decimal(overdue or 0),
    )


def create_customer(db: Session, data: StaffCustomerCreate) -> StaffCustomerDetail:
    try:
        user = user_service.create_user(
            db, email=data.email, password=data.password, role=UserRole.CUSTOMER
        )
    except user_service.EmailAlreadyExistsError:
        raise BusinessRuleError("An account with this email already exists") from None
    profile_service.update_profile(
        db,
        user,
        CustomerProfileUpdate(
            full_name=data.full_name,
            company_name=data.company_name,
            phone=data.phone,
            address=data.address,
        ),
    )
    return get_customer(db, user.id)


def update_customer(
    db: Session, customer_id: uuid.UUID, data: CustomerProfileUpdate
) -> StaffCustomerDetail:
    user = _get_customer_user(db, customer_id)
    profile_service.update_profile(db, user, data)
    return get_customer(db, user.id)
