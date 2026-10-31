import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel


class ActivityItem(BaseModel):
    """One event for the "recent activity" feed, derived from record timestamps."""

    at: datetime
    kind: Literal[
        "subscription_created",
        "quotation_sent",
        "quotation_accepted",
        "quotation_rejected",
        "subscription_activated",
        "subscription_closed",
        "invoice_generated",
        "invoice_confirmed",
        "invoice_paid",
        "invoice_cancelled",
        "payment_recorded",
    ]
    message: str
    # What the event links to in the staff panel.
    target: Literal["subscription", "invoice"]
    target_id: uuid.UUID


class StaffDashboard(BaseModel):
    """Totals for the staff dashboard.

    Subscription, customer and invoice figures are current. Revenue and payment counts
    cover payments dated between date_from and date_to (inclusive); both None means all
    time.
    """

    as_of: date
    date_from: date | None
    date_to: date | None

    total_customers: int
    active_customers: int

    active_subscriptions: int
    open_quotations: int
    awaiting_activation: int

    revenue_received: Decimal
    payments_count: int

    outstanding_invoices: int
    outstanding_amount: Decimal
    overdue_invoices: int
    overdue_amount: Decimal
    draft_invoices: int

    recent_activity: list[ActivityItem]
