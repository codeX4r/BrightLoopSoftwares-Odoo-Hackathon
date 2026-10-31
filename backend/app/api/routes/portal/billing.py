"""Customer-scoped reads and actions on staff-owned data, for the customer portal.

Every query is filtered by the signed-in customer's id. Records belonging to someone
else return 404, the same as missing ones.
"""

import uuid
from typing import Annotated

from fastapi import APIRouter, Query

from app.api.permissions import CustomerOnly
from app.db.session import DbSession
from app.schemas.common import DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, Page
from app.schemas.invoice import (
    InvoiceRead,
    InvoiceSummary,
    invoice_read,
    invoice_summary,
)
from app.schemas.subscription import (
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


@router.get("/invoices", response_model=Page[InvoiceSummary])
def my_invoices(
    customer: CustomerOnly,
    db: DbSession,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=MAX_PAGE_SIZE)] = DEFAULT_PAGE_SIZE,
) -> Page[InvoiceSummary]:
    """The customer's invoices with paid and outstanding amounts. Drafts are not shown."""
    result = invoice_service.list_invoices(
        db,
        status=None,
        overdue=None,
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
