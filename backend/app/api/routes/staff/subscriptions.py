import uuid
from typing import Annotated

from fastapi import APIRouter, Query, status

from app.api.permissions import StaffOrAdmin
from app.db.session import DbSession
from app.models.subscription import SubscriptionStatus
from app.schemas.common import (
    DEFAULT_PAGE_SIZE,
    MAX_PAGE_SIZE,
    CustomerSummary,
    Page,
    customer_summary,
)
from app.schemas.subscription import (
    ActivateRequest,
    SendQuotationRequest,
    SubscriptionCreate,
    SubscriptionRead,
    SubscriptionSummary,
    SubscriptionUpdate,
    subscription_read,
    subscription_summary,
)
from app.services import subscription_service

router = APIRouter(prefix="/subscriptions", tags=["staff: quotations & subscriptions"])


@router.get("", response_model=Page[SubscriptionSummary])
def list_subscriptions(
    _actor: StaffOrAdmin,
    db: DbSession,
    status_filter: Annotated[SubscriptionStatus | None, Query(alias="status")] = None,
    customer_id: uuid.UUID | None = None,
    search: Annotated[str | None, Query(max_length=100)] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=MAX_PAGE_SIZE)] = DEFAULT_PAGE_SIZE,
) -> Page[SubscriptionSummary]:
    """Lists quotations and subscriptions, newest first."""
    result = subscription_service.list_subscriptions(
        db,
        status=status_filter,
        customer_id=customer_id,
        search=search,
        page=page,
        page_size=page_size,
    )
    return Page[SubscriptionSummary](
        items=[subscription_summary(s) for s in result.items],
        total=result.total,
        page=page,
        page_size=page_size,
    )


@router.get("/customer-options", response_model=list[CustomerSummary])
def customer_options(
    _actor: StaffOrAdmin,
    db: DbSession,
    search: Annotated[str | None, Query(max_length=100)] = None,
    limit: Annotated[int, Query(ge=1, le=50)] = 20,
) -> list[CustomerSummary]:
    """Active customers to pick from when creating a quotation."""
    return [
        customer_summary(u)
        for u in subscription_service.list_customer_options(
            db, search=search, limit=limit
        )
    ]


@router.post("", response_model=SubscriptionRead, status_code=status.HTTP_201_CREATED)
def create_subscription(
    payload: SubscriptionCreate, actor: StaffOrAdmin, db: DbSession
) -> SubscriptionRead:
    """Creates a DRAFT with a new SUB- number."""
    return subscription_read(
        subscription_service.create_subscription(db, payload, actor=actor)
    )


@router.get("/{subscription_id}", response_model=SubscriptionRead)
def get_subscription(
    subscription_id: uuid.UUID, _actor: StaffOrAdmin, db: DbSession
) -> SubscriptionRead:
    return subscription_read(subscription_service.get_subscription(db, subscription_id))


@router.patch("/{subscription_id}", response_model=SubscriptionRead)
def update_subscription(
    subscription_id: uuid.UUID,
    payload: SubscriptionUpdate,
    _actor: StaffOrAdmin,
    db: DbSession,
) -> SubscriptionRead:
    """Edits a DRAFT. Sending `lines` replaces all existing lines."""
    return subscription_read(
        subscription_service.update_subscription(db, subscription_id, payload)
    )


@router.post("/{subscription_id}/send-quotation", response_model=SubscriptionRead)
def send_quotation(
    subscription_id: uuid.UUID,
    payload: SendQuotationRequest,
    _actor: StaffOrAdmin,
    db: DbSession,
) -> SubscriptionRead:
    """DRAFT -> QUOTATION. Sets the validity period (default 15 days)."""
    return subscription_read(
        subscription_service.send_quotation(
            db, subscription_id, valid_days=payload.valid_days
        )
    )


@router.post("/{subscription_id}/revert-to-draft", response_model=SubscriptionRead)
def revert_to_draft(
    subscription_id: uuid.UUID, _actor: StaffOrAdmin, db: DbSession
) -> SubscriptionRead:
    """QUOTATION -> DRAFT, so the offer can be edited."""
    return subscription_read(subscription_service.revert_to_draft(db, subscription_id))


@router.post("/{subscription_id}/confirm", response_model=SubscriptionRead)
def confirm(
    subscription_id: uuid.UUID, _actor: StaffOrAdmin, db: DbSession
) -> SubscriptionRead:
    """QUOTATION -> CONFIRMED, when the customer accepted outside the portal."""
    return subscription_read(subscription_service.confirm(db, subscription_id))


@router.post("/{subscription_id}/activate", response_model=SubscriptionRead)
def activate(
    subscription_id: uuid.UUID,
    payload: ActivateRequest,
    _actor: StaffOrAdmin,
    db: DbSession,
) -> SubscriptionRead:
    """CONFIRMED -> ACTIVE. Billing starts on the start date."""
    return subscription_read(
        subscription_service.activate(
            db,
            subscription_id,
            start_date=payload.start_date,
            expiry_date=payload.expiry_date,
        )
    )


@router.post("/{subscription_id}/close", response_model=SubscriptionRead)
def close(
    subscription_id: uuid.UUID, _actor: StaffOrAdmin, db: DbSession
) -> SubscriptionRead:
    """Ends the subscription and stops future billing."""
    return subscription_read(subscription_service.close(db, subscription_id))


@router.post("/{subscription_id}/pause", response_model=SubscriptionRead)
def pause(
    subscription_id: uuid.UUID, _actor: StaffOrAdmin, db: DbSession
) -> SubscriptionRead:
    """Stops billing until resumed, if the plan allows pausing."""
    return subscription_read(subscription_service.pause(db, subscription_id))


@router.post("/{subscription_id}/resume", response_model=SubscriptionRead)
def resume(
    subscription_id: uuid.UUID, _actor: StaffOrAdmin, db: DbSession
) -> SubscriptionRead:
    """Restarts billing; periods that passed while paused are not billed."""
    return subscription_read(subscription_service.resume(db, subscription_id))


@router.post("/{subscription_id}/renew", response_model=SubscriptionRead)
def renew(
    subscription_id: uuid.UUID, _actor: StaffOrAdmin, db: DbSession
) -> SubscriptionRead:
    """Extends the expiry date by one more term, if the plan allows renewal."""
    return subscription_read(subscription_service.renew(db, subscription_id))
