"""Customer-scoped reads and actions on staff-owned data, for the customer portal.

Every query is filtered by the signed-in customer's id. Records belonging to someone
else return 404, the same as missing ones.
"""

import uuid
from typing import Annotated, Literal

from fastapi import APIRouter, Query

from app.api.permissions import CustomerOnly
from app.db.session import DbSession
from app.models.invoice import InvoiceStatus
from app.schemas.common import DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, Page
from app.schemas.invoice import (
    InvoiceRead,
    InvoiceSummary,
    invoice_read,
    invoice_summary,
)
from app.schemas.subscription import (
    RejectQuotationRequest,
    SubscriptionRead,
    SubscriptionSummary,
    subscription_read,
    subscription_summary,
)
from app.services import clock, invoice_service, subscription_service
from app.services.errors import NotFoundError

router = APIRouter(tags=["portal (customer): subscriptions & invoices"])


@router.get("/subscriptions", response_model=Page[SubscriptionSummary])
def my_subscriptions(
    customer: CustomerOnly,
    db: DbSession,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=MAX_PAGE_SIZE)] = DEFAULT_PAGE_SIZE,
) -> Page[SubscriptionSummary]:
    """The customer's quotations and subscriptions. Drafts are not shown."""
    result = subscription_service.list_subscriptions(
        db,
        status=None,
        customer_id=customer.id,
        search=None,
        page=page,
        page_size=page_size,
        customer_visible_only=True,
    )
    return Page[SubscriptionSummary](
        items=[subscription_summary(s) for s in result.items],
        total=result.total,
        page=page,
        page_size=page_size,
    )


@router.get("/subscriptions/{subscription_id}", response_model=SubscriptionRead)
def my_subscription(
    subscription_id: uuid.UUID, customer: CustomerOnly, db: DbSession
) -> SubscriptionRead:
    sub = subscription_service.get_subscription(db, subscription_id)
    if (
        sub.customer_id != customer.id
        or sub.status not in subscription_service.CUSTOMER_VISIBLE
    ):
        raise NotFoundError(subscription_service.NOT_FOUND)
    return subscription_read(sub)


@router.post("/subscriptions/{subscription_id}/accept", response_model=SubscriptionRead)
def accept_quotation(
    subscription_id: uuid.UUID, customer: CustomerOnly, db: DbSession
) -> SubscriptionRead:
    """The customer accepts their quotation: QUOTATION -> CONFIRMED."""
    return subscription_read(
        subscription_service.confirm(db, subscription_id, customer_id=customer.id)
    )


@router.post("/subscriptions/{subscription_id}/pause", response_model=SubscriptionRead)
def pause_subscription(
    subscription_id: uuid.UUID, customer: CustomerOnly, db: DbSession
) -> SubscriptionRead:
    """Pauses billing, if the subscription's plan allows it."""
    return subscription_read(
        subscription_service.pause(db, subscription_id, customer_id=customer.id)
    )


@router.post("/subscriptions/{subscription_id}/resume", response_model=SubscriptionRead)
def resume_subscription(
    subscription_id: uuid.UUID, customer: CustomerOnly, db: DbSession
) -> SubscriptionRead:
    """Resumes a paused subscription."""
    return subscription_read(
        subscription_service.resume(db, subscription_id, customer_id=customer.id)
    )


@router.post("/subscriptions/{subscription_id}/renew", response_model=SubscriptionRead)
def renew_subscription(
    subscription_id: uuid.UUID, customer: CustomerOnly, db: DbSession
) -> SubscriptionRead:
    """Extends the expiry date by one more term, if the plan allows renewal."""
    return subscription_read(
        subscription_service.renew(db, subscription_id, customer_id=customer.id)
    )


@router.post("/subscriptions/{subscription_id}/close", response_model=SubscriptionRead)
def close_subscription(
    subscription_id: uuid.UUID, customer: CustomerOnly, db: DbSession
) -> SubscriptionRead:
    """Ends the subscription early, if the plan allows early closure."""
    return subscription_read(
        subscription_service.close_early(db, subscription_id, customer_id=customer.id)
    )


@router.post("/subscriptions/{subscription_id}/reject", response_model=SubscriptionRead)
def reject_quotation(
    subscription_id: uuid.UUID,
    payload: RejectQuotationRequest,
    customer: CustomerOnly,
    db: DbSession,
) -> SubscriptionRead:
    """The customer declines their quotation: QUOTATION -> CLOSED (marked rejected).

    An optional reason (up to 500 characters) is shown to staff.
    """
    return subscription_read(
        subscription_service.reject(
            db, subscription_id, customer_id=customer.id, reason=payload.reason
        )
    )


# What a customer can filter by. Drafts are never shown to customers.
PortalInvoiceStatus = Literal["CONFIRMED", "PAID", "CANCELLED"]


@router.get("/invoices", response_model=Page[InvoiceSummary])
def my_invoices(
    customer: CustomerOnly,
    db: DbSession,
    status_filter: Annotated[PortalInvoiceStatus | None, Query(alias="status")] = None,
    overdue: bool | None = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=MAX_PAGE_SIZE)] = DEFAULT_PAGE_SIZE,
) -> Page[InvoiceSummary]:
    """The customer's invoices with paid and outstanding amounts. Drafts are not shown.

    Filters: `status=CONFIRMED` (unpaid), `PAID` or `CANCELLED`; `overdue=true` for unpaid
    invoices past their due date.
    """
    result = invoice_service.list_invoices(
        db,
        status=InvoiceStatus(status_filter) if status_filter else None,
        overdue=overdue,
        customer_id=customer.id,
        subscription_id=None,
        search=None,
        page=page,
        page_size=page_size,
        customer_visible_only=True,
    )
    today = clock.today()
    return Page[InvoiceSummary](
        items=[invoice_summary(i, today) for i in result.items],
        total=result.total,
        page=page,
        page_size=page_size,
    )


@router.get("/invoices/{invoice_id}", response_model=InvoiceRead)
def my_invoice(
    invoice_id: uuid.UUID, customer: CustomerOnly, db: DbSession
) -> InvoiceRead:
    invoice = invoice_service.get_invoice(db, invoice_id, customer_id=customer.id)
    return invoice_read(invoice, clock.today())
