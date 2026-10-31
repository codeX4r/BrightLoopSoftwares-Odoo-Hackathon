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
from decimal import Decimal

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.models.catalog import (
    PlanStatus,
    Product,
    ProductStatus,
    ProductVariant,
    SubscriptionPlan,
)
from app.models.customer_profile import CustomerProfile
from app.models.subscription import Subscription, SubscriptionLine, SubscriptionStatus
from app.models.user import User, UserRole
from app.schemas.subscription import (
    SubscriptionCreate,
    SubscriptionLineIn,
    SubscriptionUpdate,
)
from app.services import billing_service, clock, tax_service
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
        selectinload(Subscription.lines),
        selectinload(Subscription.plan),
        selectinload(Subscription.customer).selectinload(User.profile),
    )


def _require_customer(db: Session, customer_id: uuid.UUID) -> User:
    user = db.get(User, customer_id)
    if user is None or user.role != UserRole.CUSTOMER:
        raise InvalidInputError("Customer not found")
    if not user.is_active:
        raise InvalidInputError("This customer account is deactivated")
    return user


def _offerable_plan(db: Session, plan_id: uuid.UUID) -> SubscriptionPlan:
    """An admin plan that can be offered today: ACTIVE and inside its availability window."""
    plan = db.get(SubscriptionPlan, plan_id)
    if plan is None:
        raise InvalidInputError("Subscription plan not found")
    today = clock.today()
    if (
        plan.status != PlanStatus.ACTIVE
        or plan.available_from > today
        or (plan.available_until is not None and plan.available_until < today)
    ):
        raise InvalidInputError(f"The plan {plan.name} isn't available to offer today")
    return plan


def _default_tax_rate(db: Session, product_id: uuid.UUID | None) -> Decimal:
    tax = tax_service.resolve_tax(db, product_id)
    return tax.rate if tax is not None else Decimal(0)


def build_lines(
    db: Session, lines: list[SubscriptionLineIn], plan: SubscriptionPlan | None
) -> list[SubscriptionLine]:
    """Turns line input into rows, filling prices, names and taxes from the catalog."""
    if sum(1 for line in lines if line.is_plan_line) > 1:
        raise InvalidInputError("A quotation can have only one plan line")
    built: list[SubscriptionLine] = []
    for index, line in enumerate(lines):
        product_id = variant_id = None
        if line.is_plan_line:
            if plan is None:
                raise InvalidInputError("Choose a subscription plan for the plan line")
            if line.quantity < plan.minimum_quantity:
                raise InvalidInputError(
                    f"{plan.name} needs a quantity of at least {plan.minimum_quantity}"
                )
            description, unit_price = plan.name, plan.price
            tax_rate = line.tax_rate
            if tax_rate is None:
                tax_rate = _default_tax_rate(db, None)
        elif line.product_id is not None:
            product = db.get(Product, line.product_id)
            if product is None or product.status != ProductStatus.ACTIVE:
                raise InvalidInputError("Product not found or archived")
            name, price = product.name, product.sales_price
            if line.variant_id is not None:
                variant = db.get(ProductVariant, line.variant_id)
                if (
                    variant is None
                    or variant.product_id != product.id
                    or variant.status != ProductStatus.ACTIVE
                ):
                    raise InvalidInputError(f"That variant isn't available for {name}")
                name, price = (
                    f"{name} ({variant.name})",
                    price + variant.additional_price,
                )
                variant_id = variant.id
            product_id = product.id
            description = line.description or name
            unit_price = line.unit_price if line.unit_price is not None else price
            tax_rate = line.tax_rate
            if tax_rate is None:
                tax_rate = _default_tax_rate(db, product.id)
        else:
            if not line.description or line.unit_price is None:
                raise InvalidInputError(
                    "Lines without a product need a description and a unit price"
                )
            description, unit_price = line.description, line.unit_price
            tax_rate = line.tax_rate
            if tax_rate is None:
                tax_rate = _default_tax_rate(db, None)
        built.append(
            SubscriptionLine(
                position=index,
                is_plan_line=line.is_plan_line,
                product_id=product_id,
                variant_id=variant_id,
                description=description,
                quantity=line.quantity,
                unit_price=unit_price,
                tax_rate=tax_rate,
            )
        )
    return built


def _check_plan_ready(sub: Subscription) -> None:
    """Before sending: a plan quotation must carry its plan line at the minimum quantity."""
    plan = sub.plan
    if plan is None:
        return
    plan_lines = [line for line in sub.lines if line.is_plan_line]
    if not plan_lines:
        raise BusinessRuleError(f"Add the {plan.name} plan line before sending")
    if plan_lines[0].quantity < plan.minimum_quantity:
        raise BusinessRuleError(
            f"{plan.name} needs a quantity of at least {plan.minimum_quantity}"
        )


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
        query = (
            query.join(User, User.id == Subscription.customer_id)
            .outerjoin(CustomerProfile, CustomerProfile.user_id == User.id)
            .where(
                or_(
                    Subscription.number.ilike(pattern),
                    Subscription.plan_name.ilike(pattern),
                    User.email.ilike(pattern),
                    CustomerProfile.full_name.ilike(pattern),
                    CustomerProfile.company_name.ilike(pattern),
                )
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
    plan = _offerable_plan(db, data.plan_id) if data.plan_id else None
    plan_name = plan.name if plan else data.plan_name
    frequency = plan.billing_frequency if plan else data.billing_frequency
    if not plan_name or frequency is None:
        raise InvalidInputError(
            "Choose a subscription plan, or enter a plan name and billing frequency"
        )
    sub = Subscription(
        number=next_number(db, SUBSCRIPTION_SEQUENCE),
        customer_id=data.customer_id,
        status=SubscriptionStatus.DRAFT,
        plan_id=plan.id if plan else None,
        plan_name=plan_name,
        billing_frequency=frequency,
        payment_terms_days=data.payment_terms_days,
        quotation_validity_days=data.quotation_validity_days,
        expiry_date=data.expiry_date,
        notes=data.notes or None,
        created_by_id=actor.id,
        lines=build_lines(db, data.lines, plan),
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
    plan = sub.plan
    if "plan_id" in changes:
        plan = _offerable_plan(db, data.plan_id) if data.plan_id else None
        sub.plan_id = plan.id if plan else None
        sub.plan = plan
        if plan is not None:
            sub.plan_name, sub.billing_frequency = plan.name, plan.billing_frequency
    for field in (
        "plan_name",
        "billing_frequency",
        "payment_terms_days",
        "quotation_validity_days",
    ):
        # A chosen plan decides its own name and frequency.
        if changes.get(field) is not None and not (
            plan is not None and field in ("plan_name", "billing_frequency")
        ):
            setattr(sub, field, changes[field])
    if "expiry_date" in changes:
        sub.expiry_date = data.expiry_date
    if "notes" in changes:
        sub.notes = data.notes or None
    if data.lines is not None:
        sub.lines = build_lines(db, data.lines, plan)
    elif "plan_id" in changes:
        for line in sub.lines:
            if not line.is_plan_line:
                continue
            if plan is None:
                # Detaching the plan turns its plan line into an ordinary line.
                line.is_plan_line = False
            else:
                # Switching plans re-prices the existing plan line from the new plan.
                line.description, line.unit_price = plan.name, plan.price

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
    db: Session, subscription_id: uuid.UUID, *, valid_days: int | None
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
    if sub.plan_id is not None:
        _offerable_plan(db, sub.plan_id)
    _check_plan_ready(sub)
    days = valid_days if valid_days is not None else sub.quotation_validity_days
    sub.quotation_validity_days = days
    sub.status = SubscriptionStatus.QUOTATION
    sub.quotation_valid_until = clock.today() + timedelta(days=days)
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


def reject(
    db: Session,
    subscription_id: uuid.UUID,
    *,
    customer_id: uuid.UUID,
    reason: str | None,
) -> Subscription:
    """The customer declines their quotation: QUOTATION -> CLOSED, marked as rejected.

    Allowed even after the validity date, so customers can clear expired offers.
    """
    sub = _transition(
        db,
        subscription_id,
        allowed_from=(SubscriptionStatus.QUOTATION,),
        action="reject",
        customer_id=customer_id,
    )
    now = clock.now_utc()
    sub.status = SubscriptionStatus.CLOSED
    sub.rejected_at = now
    sub.rejection_reason = reason or None
    sub.closed_at = now
    sub.next_billing_date = None
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
    sub.paused_at = None
    sub.closed_at = clock.now_utc()
    return _save(db, sub)


# --- Plan rules: pause, resume, renew, close early ----------------------------------
#
# The subscription's plan decides what is allowed. Customers are always held to the plan;
# staff are too, except on quotations without a plan, where staff decide.


def _plan_allows(sub: Subscription, flag: str, *, by_customer: bool) -> bool:
    if sub.plan is None:
        return not by_customer
    return bool(getattr(sub.plan, flag))


def _require_rule(sub: Subscription, flag: str, action: str, *, by_customer: bool):
    if not _plan_allows(sub, flag, by_customer=by_customer):
        if sub.plan is None:
            raise BusinessRuleError(
                f"Ask Brightloop staff to {action} this subscription"
            )
        raise BusinessRuleError(
            f"The {sub.plan.name} plan doesn't allow you to {action}"
        )


def pause(
    db: Session, subscription_id: uuid.UUID, *, customer_id: uuid.UUID | None = None
) -> Subscription:
    """Stops billing until resumed. Pass customer_id when the customer pauses."""
    sub = _transition(
        db,
        subscription_id,
        allowed_from=(SubscriptionStatus.ACTIVE,),
        action="pause",
        customer_id=customer_id,
    )
    if sub.paused_at is not None:
        raise BusinessRuleError("This subscription is already paused")
    _require_rule(sub, "allow_pause", "pause", by_customer=customer_id is not None)
    sub.paused_at = clock.now_utc()
    return _save(db, sub)


def resume(
    db: Session, subscription_id: uuid.UUID, *, customer_id: uuid.UUID | None = None
) -> Subscription:
    """Restarts billing. Periods that passed entirely while paused are skipped."""
    sub = _transition(
        db,
        subscription_id,
        allowed_from=(SubscriptionStatus.ACTIVE,),
        action="resume",
        customer_id=customer_id,
    )
    if sub.paused_at is None:
        raise BusinessRuleError("This subscription isn't paused")
    today = clock.today()
    if sub.next_billing_date is not None and sub.start_date is not None:
        anchor = sub.start_date.day
        next_date = sub.next_billing_date
        while next_date < today:
            following = billing_service.next_period_start(
                next_date, sub.billing_frequency, anchor
            )
            if following > today:
                break
            next_date = following
        sub.next_billing_date = next_date
        if sub.expiry_date is not None and next_date > sub.expiry_date:
            sub.next_billing_date = None
    sub.paused_at = None
    return _save(db, sub)


def renew(
    db: Session, subscription_id: uuid.UUID, *, customer_id: uuid.UUID | None = None
) -> Subscription:
    """Extends the expiry date by one more term (the original start-to-expiry length).

    Works on an ACTIVE subscription with an expiry date, or reopens one that closed
    because it expired.
    """
    sub = _transition(
        db,
        subscription_id,
        allowed_from=(SubscriptionStatus.ACTIVE, SubscriptionStatus.CLOSED),
        action="renew",
        customer_id=customer_id,
    )
    if sub.expiry_date is None or sub.start_date is None:
        raise BusinessRuleError("Only subscriptions with an expiry date can be renewed")
    if sub.status == SubscriptionStatus.CLOSED and (
        sub.rejected_at is not None or sub.activated_at is None
    ):
        raise BusinessRuleError(
            "Only subscriptions that ran until expiry can be renewed"
        )
    _require_rule(sub, "allow_renewal", "renew", by_customer=customer_id is not None)

    old_expiry = sub.expiry_date
    term = (old_expiry - sub.start_date).days + 1
    sub.expiry_date = old_expiry + timedelta(days=term)
    if sub.next_billing_date is None:
        # Billing had stopped at the old expiry: resume with the first period after it.
        anchor = sub.start_date.day
        next_date = sub.start_date
        while next_date <= old_expiry:
            next_date = billing_service.next_period_start(
                next_date, sub.billing_frequency, anchor
            )
        sub.next_billing_date = next_date
    sub.status = SubscriptionStatus.ACTIVE
    sub.closed_at = None
    sub.renewed_at = clock.now_utc()
    return _save(db, sub)


def close_early(
    db: Session, subscription_id: uuid.UUID, *, customer_id: uuid.UUID
) -> Subscription:
    """The customer ends their own subscription, if the plan allows early closure."""
    sub = _transition(
        db,
        subscription_id,
        allowed_from=(SubscriptionStatus.ACTIVE,),
        action="close",
        customer_id=customer_id,
    )
    _require_rule(sub, "allow_early_closure", "close early", by_customer=True)
    sub.status = SubscriptionStatus.CLOSED
    sub.next_billing_date = None
    sub.paused_at = None
    sub.closed_at = clock.now_utc()
    return _save(db, sub)


def list_customer_options(
    db: Session, *, search: str | None, limit: int
) -> Sequence[User]:
    """Active customers for the staff customer picker."""
    query = (
        select(User)
        .options(selectinload(User.profile))
        .outerjoin(CustomerProfile, CustomerProfile.user_id == User.id)
        .where(User.role == UserRole.CUSTOMER, User.is_active.is_(True))
    )
    if search:
        pattern = f"%{search.strip()}%"
        query = query.where(
            or_(
                User.email.ilike(pattern),
                CustomerProfile.full_name.ilike(pattern),
                CustomerProfile.company_name.ilike(pattern),
            )
        )
    return db.scalars(query.order_by(User.email).limit(limit)).all()
