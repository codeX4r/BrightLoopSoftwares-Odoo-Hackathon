"""Quotations and subscriptions.

Lifecycle (one row moves through all of these):
    DRAFT --send--> QUOTATION --confirm--> CONFIRMED --activate--> ACTIVE --close--> CLOSED
    QUOTATION --revert--> DRAFT, and anything not yet CLOSED can be closed.

Only DRAFT rows can be edited, so a quotation the customer is looking at never changes
underneath them.
"""

import uuid
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import date, timedelta

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.models.subscription import Subscription, SubscriptionLine, SubscriptionStatus
from app.models.user import User, UserRole
from app.schemas.subscription import (
    SubscriptionCreate,
    SubscriptionLineIn,
    SubscriptionUpdate,
)
from app.services import clock
from app.services.errors import BusinessRuleError, InvalidInputError, NotFoundError
from app.services.numbering import SUBSCRIPTION_SEQUENCE, next_number

NOT_FOUND = "Subscription not found"
# Customers never see a subscription before it has been sent to them as a quotation.
CUSTOMER_VISIBLE = (
    SubscriptionStatus.QUOTATION,
    SubscriptionStatus.CONFIRMED,
    SubscriptionStatus.ACTIVE,
    SubscriptionStatus.CLOSED,
)


@dataclass(frozen=True)
class SubscriptionList:
    items: Sequence[Subscription]
    total: int


def _with_relations():
    return select(Subscription).options(
        selectinload(Subscription.lines), selectinload(Subscription.customer)
    )


def _require_customer(db: Session, customer_id: uuid.UUID) -> User:
    user = db.get(User, customer_id)
    if user is None or user.role != UserRole.CUSTOMER:
        raise InvalidInputError("Customer not found")
    if not user.is_active:
        raise InvalidInputError("This customer account is deactivated")
    return user


def _build_lines(lines: list[SubscriptionLineIn]) -> list[SubscriptionLine]:
    return [
        SubscriptionLine(
            position=index,
            description=line.description,
            quantity=line.quantity,
            unit_price=line.unit_price,
            tax_rate=line.tax_rate,
        )
        for index, line in enumerate(lines)
    ]


def _check_expiry(start: date | None, expiry: date | None) -> None:
    if start and expiry and expiry < start:
        raise InvalidInputError("Expiry date must be on or after the start date")


def list_subscriptions(
    db: Session,
    *,
    status: SubscriptionStatus | None,
    customer_id: uuid.UUID | None,
    search: str | None,
    page: int,
    page_size: int,
    customer_visible_only: bool = False,
) -> SubscriptionList:
    query = select(Subscription)
    if customer_visible_only:
        query = query.where(Subscription.status.in_(CUSTOMER_VISIBLE))
    if status is not None:
        query = query.where(Subscription.status == status)
    if customer_id is not None:
        query = query.where(Subscription.customer_id == customer_id)
    if search:
        pattern = f"%{search.strip()}%"
        query = query.join(User, User.id == Subscription.customer_id).where(
            or_(
                Subscription.number.ilike(pattern),
                Subscription.plan_name.ilike(pattern),
                User.email.ilike(pattern),
            )
        )

    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    ids = db.scalars(
        query.with_only_columns(Subscription.id)
        .order_by(Subscription.created_at.desc(), Subscription.number.desc())
        .limit(page_size)
        .offset((page - 1) * page_size)
    ).all()
    if not ids:
        return SubscriptionList(items=[], total=total)
    rows = {
        s.id: s for s in db.scalars(_with_relations().where(Subscription.id.in_(ids)))
    }
    return SubscriptionList(items=[rows[i] for i in ids], total=total)


def get_subscription(
    db: Session, subscription_id: uuid.UUID, *, for_update: bool = False
) -> Subscription:
    query = _with_relations().where(Subscription.id == subscription_id)
    if for_update:
        query = query.with_for_update(of=Subscription)
    sub = db.scalar(query)
    if sub is None:
        raise NotFoundError(NOT_FOUND)
    return sub


def create_subscription(
    db: Session, data: SubscriptionCreate, *, actor: User
) -> Subscription:
    _require_customer(db, data.customer_id)
    sub = Subscription(
        number=next_number(db, SUBSCRIPTION_SEQUENCE),
        customer_id=data.customer_id,
        status=SubscriptionStatus.DRAFT,
        plan_name=data.plan_name,
        billing_frequency=data.billing_frequency,
        payment_terms_days=data.payment_terms_days,
        expiry_date=data.expiry_date,
        notes=data.notes or None,
        created_by_id=actor.id,
        lines=_build_lines(data.lines),
    )
    db.add(sub)
    db.commit()
    return get_subscription(db, sub.id)


def update_subscription(
    db: Session, subscription_id: uuid.UUID, data: SubscriptionUpdate
) -> Subscription:
    sub = get_subscription(db, subscription_id, for_update=True)
    if sub.status != SubscriptionStatus.DRAFT:
        raise BusinessRuleError(
            "Only drafts can be edited. Move the quotation back to draft first."
        )
    changes = data.model_dump(exclude_unset=True)

    if changes.get("customer_id") is not None:
        _require_customer(db, data.customer_id)
        sub.customer_id = data.customer_id
    for field in ("plan_name", "billing_frequency", "payment_terms_days"):
        if changes.get(field) is not None:
            setattr(sub, field, changes[field])
    if "expiry_date" in changes:
        sub.expiry_date = data.expiry_date
    if "notes" in changes:
        sub.notes = data.notes or None
    if data.lines is not None:
        sub.lines = _build_lines(data.lines)

    db.commit()
    db.expire(sub)
    return get_subscription(db, sub.id)


def _transition(
    db: Session,
    subscription_id: uuid.UUID,
    *,
    allowed_from: tuple[SubscriptionStatus, ...],
    action: str,
    customer_id: uuid.UUID | None = None,
) -> Subscription:
    sub = get_subscription(db, subscription_id, for_update=True)
    if customer_id is not None and (
        sub.customer_id != customer_id or sub.status not in CUSTOMER_VISIBLE
    ):
        # Same answer as a missing row, so customers can't probe other customers' ids.
        raise NotFoundError(NOT_FOUND)
    if sub.status not in allowed_from:
        raise BusinessRuleError(
            f"Cannot {action} a subscription in {sub.status} status"
        )
    return sub


def _save(db: Session, sub: Subscription) -> Subscription:
    db.commit()
    db.expire(sub)
    return get_subscription(db, sub.id)


def send_quotation(
    db: Session, subscription_id: uuid.UUID, *, valid_days: int
) -> Subscription:
    sub = _transition(
        db,
        subscription_id,
        allowed_from=(SubscriptionStatus.DRAFT,),
        action="send as a quotation",
    )
    if not sub.lines:
        raise BusinessRuleError("Add at least one line before sending the quotation")
    _require_customer(db, sub.customer_id)
    sub.status = SubscriptionStatus.QUOTATION
    sub.quotation_valid_until = clock.today() + timedelta(days=valid_days)
    sub.quotation_sent_at = clock.now_utc()
    return _save(db, sub)


def revert_to_draft(db: Session, subscription_id: uuid.UUID) -> Subscription:
    sub = _transition(
        db,
        subscription_id,
        allowed_from=(SubscriptionStatus.QUOTATION,),
        action="move back to draft",
    )
    sub.status = SubscriptionStatus.DRAFT
    sub.quotation_valid_until = None
    sub.quotation_sent_at = None
    return _save(db, sub)


def confirm(
    db: Session, subscription_id: uuid.UUID, *, customer_id: uuid.UUID | None = None
) -> Subscription:
    """Records the customer's acceptance. Pass customer_id when the customer accepts."""
    sub = _transition(
        db,
        subscription_id,
        allowed_from=(SubscriptionStatus.QUOTATION,),
        action="confirm",
        customer_id=customer_id,
    )
    if sub.quotation_valid_until and clock.today() > sub.quotation_valid_until:
        raise BusinessRuleError(
            f"This quotation expired on {sub.quotation_valid_until.isoformat()}"
        )
    sub.status = SubscriptionStatus.CONFIRMED
    sub.confirmed_at = clock.now_utc()
    return _save(db, sub)


def activate(
    db: Session,
    subscription_id: uuid.UUID,
    *,
    start_date: date | None,
    expiry_date: date | None,
) -> Subscription:
    sub = _transition(
        db,
        subscription_id,
        allowed_from=(SubscriptionStatus.CONFIRMED,),
        action="activate",
    )
    start = start_date or clock.today()
    expiry = expiry_date if expiry_date is not None else sub.expiry_date
    _check_expiry(start, expiry)
    sub.status = SubscriptionStatus.ACTIVE
    sub.start_date = start
    sub.expiry_date = expiry
    # Billed in advance: the first invoice is due on the start date.
    sub.next_billing_date = start
    sub.activated_at = clock.now_utc()
    return _save(db, sub)


def close(db: Session, subscription_id: uuid.UUID) -> Subscription:
    """Ends the subscription. Invoices already issued are kept as they are."""
    sub = _transition(
        db,
        subscription_id,
        allowed_from=(
            SubscriptionStatus.DRAFT,
            SubscriptionStatus.QUOTATION,
            SubscriptionStatus.CONFIRMED,
            SubscriptionStatus.ACTIVE,
        ),
        action="close",
    )
    sub.status = SubscriptionStatus.CLOSED
    sub.next_billing_date = None
    sub.closed_at = clock.now_utc()
    return _save(db, sub)


def list_customer_options(
    db: Session, *, search: str | None, limit: int
) -> Sequence[User]:
    """Active customers for the staff customer picker."""
    query = select(User).where(User.role == UserRole.CUSTOMER, User.is_active.is_(True))
    if search:
        query = query.where(User.email.ilike(f"%{search.strip()}%"))
    return db.scalars(query.order_by(User.email).limit(limit)).all()
