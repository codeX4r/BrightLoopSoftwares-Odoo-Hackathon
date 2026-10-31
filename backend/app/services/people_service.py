"""Admin views of customer and staff accounts, with figures from the billing tables.

Reads only: accounts are created and (de)activated through user_service, and
subscriptions, invoices and payments are owned by the staff services. Every figure here
is an aggregate query, so a page of accounts costs a fixed number of queries.
"""

import uuid
from collections.abc import Sequence
from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal

from sqlalchemy import case, func, select
from sqlalchemy.orm import Session, selectinload

from app.models.invoice import Invoice, InvoiceStatus
from app.models.payment import Payment
from app.models.subscription import Subscription, SubscriptionStatus
from app.models.user import User, UserRole
from app.services.errors import NotFoundError
from app.services.invoice_service import overdue_condition
from app.services.money import ZERO, round_money

# Invoices that count as billed: confirmed (owed) or paid. Drafts are internal and
# cancelled invoices are void, so neither counts.
BILLED_STATUSES = (InvoiceStatus.CONFIRMED, InvoiceStatus.PAID)


@dataclass(frozen=True)
class CustomerFigures:
    subscriptions_total: int = 0
    active_subscriptions: int = 0
    invoices_total: int = 0
    invoiced_amount: Decimal = ZERO
    paid_amount: Decimal = ZERO
    outstanding_amount: Decimal = ZERO
    overdue_invoices: int = 0


@dataclass(frozen=True)
class StaffFigures:
    subscriptions_created: int = 0
    payments_recorded: int = 0
    payments_amount: Decimal = ZERO


@dataclass(frozen=True)
class AccountPage:
    items: Sequence[User]
    total: int


@dataclass(frozen=True)
class CustomerDetail:
    user: User
    figures: CustomerFigures
    recent_payments: Sequence[Payment] = field(default_factory=list)


@dataclass(frozen=True)
class StaffDetail:
    user: User
    figures: StaffFigures
    recent_payments: Sequence[Payment] = field(default_factory=list)


def _list_accounts(
    db: Session,
    role: UserRole,
    *,
    q: str | None,
    is_active: bool | None,
    limit: int,
    offset: int,
) -> AccountPage:
    query = select(User).where(User.role == role)
    if q:
        query = query.where(User.email.ilike(f"%{q.strip()}%"))
    if is_active is not None:
        query = query.where(User.is_active.is_(is_active))
    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    items = db.scalars(
        query.order_by(User.created_at.desc(), User.email).limit(limit).offset(offset)
    ).all()
    return AccountPage(items=items, total=total)


def _get_account(db: Session, user_id: uuid.UUID, role: UserRole, label: str) -> User:
    user = db.get(User, user_id)
    if user is None or user.role != role:
        raise NotFoundError(f"{label} not found.")
    return user


# --- Customers ---------------------------------------------------------------


def list_customers(
    db: Session, *, q: str | None, is_active: bool | None, limit: int, offset: int
) -> AccountPage:
    return _list_accounts(
        db, UserRole.CUSTOMER, q=q, is_active=is_active, limit=limit, offset=offset
    )


def customer_figures(
    db: Session, customer_ids: Sequence[uuid.UUID], today: date
) -> dict[uuid.UUID, CustomerFigures]:
    """Figures for many customers in three grouped queries (no per-row queries)."""
    if not customer_ids:
        return {}
    ids = list(customer_ids)

    subs = {
        row.customer_id: row
        for row in db.execute(
            select(
                Subscription.customer_id,
                func.count(Subscription.id).label("total"),
                func.count(Subscription.id)
                .filter(Subscription.status == SubscriptionStatus.ACTIVE)
                .label("active"),
            )
            .where(Subscription.customer_id.in_(ids))
            .group_by(Subscription.customer_id)
        )
    }

    billed = Invoice.status.in_(BILLED_STATUSES)
    invoices = {
        row.customer_id: row
        for row in db.execute(
            select(
                Invoice.customer_id,
                func.count(Invoice.id).filter(billed).label("total"),
                func.coalesce(
                    func.sum(case((billed, Invoice.total), else_=0)), 0
                ).label("invoiced"),
                func.coalesce(
                    func.sum(
                        case(
                            (
                                Invoice.status == InvoiceStatus.CONFIRMED,
                                Invoice.total - Invoice.amount_paid,
                            ),
                            else_=0,
                        )
                    ),
                    0,
                ).label("outstanding"),
                func.count(Invoice.id)
                .filter(overdue_condition(today))
                .label("overdue"),
            )
            .where(Invoice.customer_id.in_(ids))
            .group_by(Invoice.customer_id)
        )
    }

    paid = dict(
        db.execute(
            select(Invoice.customer_id, func.coalesce(func.sum(Payment.amount), 0))
            .join(Payment, Payment.invoice_id == Invoice.id)
            .where(Invoice.customer_id.in_(ids))
            .group_by(Invoice.customer_id)
        ).all()
    )

    result: dict[uuid.UUID, CustomerFigures] = {}
    for customer_id in ids:
        sub = subs.get(customer_id)
        inv = invoices.get(customer_id)
        result[customer_id] = CustomerFigures(
            subscriptions_total=sub.total if sub else 0,
            active_subscriptions=sub.active if sub else 0,
            invoices_total=inv.total if inv else 0,
            invoiced_amount=round_money(Decimal(inv.invoiced)) if inv else ZERO,
            paid_amount=round_money(Decimal(paid.get(customer_id, 0))),
            outstanding_amount=round_money(Decimal(inv.outstanding)) if inv else ZERO,
            overdue_invoices=inv.overdue if inv else 0,
        )
    return result


def _recent_payments(db: Session, condition, limit: int) -> Sequence[Payment]:
    return db.scalars(
        select(Payment)
        .options(selectinload(Payment.invoice).selectinload(Invoice.customer))
        .join(Invoice, Invoice.id == Payment.invoice_id)
        .where(condition)
        .order_by(Payment.paid_on.desc(), Payment.created_at.desc())
        .limit(limit)
    ).all()


def get_customer_detail(
    db: Session, customer_id: uuid.UUID, today: date, *, payments_limit: int = 10
) -> CustomerDetail:
    user = _get_account(db, customer_id, UserRole.CUSTOMER, "Customer")
    return CustomerDetail(
        user=user,
        figures=customer_figures(db, [user.id], today)[user.id],
        recent_payments=_recent_payments(
            db, Invoice.customer_id == user.id, payments_limit
        ),
    )


# --- Staff -------------------------------------------------------------------


def list_staff(
    db: Session, *, q: str | None, is_active: bool | None, limit: int, offset: int
) -> AccountPage:
    return _list_accounts(
        db, UserRole.STAFF, q=q, is_active=is_active, limit=limit, offset=offset
    )


def staff_figures(
    db: Session, staff_ids: Sequence[uuid.UUID]
) -> dict[uuid.UUID, StaffFigures]:
    """Work each staff member has done: subscriptions created and payments recorded."""
    if not staff_ids:
        return {}
    ids = list(staff_ids)
    created = dict(
        db.execute(
            select(Subscription.created_by_id, func.count(Subscription.id))
            .where(Subscription.created_by_id.in_(ids))
            .group_by(Subscription.created_by_id)
        ).all()
    )
    payments = {
        row.recorded_by_id: row
        for row in db.execute(
            select(
                Payment.recorded_by_id,
                func.count(Payment.id).label("count"),
                func.coalesce(func.sum(Payment.amount), 0).label("amount"),
            )
            .where(Payment.recorded_by_id.in_(ids))
            .group_by(Payment.recorded_by_id)
        )
    }
    return {
        staff_id: StaffFigures(
            subscriptions_created=created.get(staff_id, 0),
            payments_recorded=payments[staff_id].count if staff_id in payments else 0,
            payments_amount=round_money(Decimal(payments[staff_id].amount))
            if staff_id in payments
            else ZERO,
        )
        for staff_id in ids
    }


def get_staff_detail(
    db: Session, staff_id: uuid.UUID, *, payments_limit: int = 10
) -> StaffDetail:
    user = _get_account(db, staff_id, UserRole.STAFF, "Staff member")
    return StaffDetail(
        user=user,
        figures=staff_figures(db, [user.id])[user.id],
        recent_payments=_recent_payments(
            db, Payment.recorded_by_id == user.id, payments_limit
        ),
    )
