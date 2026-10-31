"""Staff dashboard totals, computed with aggregate queries so they stay fast at scale."""

from datetime import date

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.models.invoice import Invoice, InvoiceStatus
from app.models.payment import Payment
from app.models.subscription import Subscription, SubscriptionStatus
from app.models.user import User, UserRole
from app.schemas.dashboard import ActivityItem, StaffDashboard
from app.services import clock
from app.services.invoice_service import overdue_condition
from app.services.money import ZERO

RECENT_ACTIVITY_LIMIT = 12

# (timestamp column, kind, message template) for each subscription event.
SUBSCRIPTION_EVENTS = (
    (Subscription.created_at, "subscription_created", "{number} drafted for {email}"),
    (
        Subscription.quotation_sent_at,
        "quotation_sent",
        "Quotation {number} sent to {email}",
    ),
    (Subscription.confirmed_at, "quotation_accepted", "Quotation {number} accepted"),
    (Subscription.activated_at, "subscription_activated", "{number} activated"),
    (Subscription.closed_at, "subscription_closed", "{number} closed"),
)
INVOICE_EVENTS = (
    (Invoice.created_at, "invoice_generated", "Invoice {number} generated for {email}"),
    (Invoice.confirmed_at, "invoice_confirmed", "Invoice {number} confirmed"),
    (Invoice.paid_at, "invoice_paid", "Invoice {number} fully paid"),
    (Invoice.cancelled_at, "invoice_cancelled", "Invoice {number} cancelled"),
)


def _recent_activity(db: Session, limit: int) -> list[ActivityItem]:
    """Merges the newest events of each kind. There is no separate audit table: events
    come from the lifecycle timestamps already stored on each record."""
    items: list[ActivityItem] = []

    for column, kind, template in SUBSCRIPTION_EVENTS:
        rows = db.scalars(
            select(Subscription)
            .options(selectinload(Subscription.customer))
            .where(column.is_not(None))
            .order_by(column.desc())
            .limit(limit)
        ).all()
        for sub in rows:
            items.append(
                ActivityItem(
                    at=getattr(sub, column.key),
                    kind=kind,
                    message=template.format(
                        number=sub.number, email=sub.customer.email
                    ),
                    target="subscription",
                    target_id=sub.id,
                )
            )

    for column, kind, template in INVOICE_EVENTS:
        rows = db.scalars(
            select(Invoice)
            .options(selectinload(Invoice.customer))
            .where(column.is_not(None))
            .order_by(column.desc())
            .limit(limit)
        ).all()
        for invoice in rows:
            items.append(
                ActivityItem(
                    at=getattr(invoice, column.key),
                    kind=kind,
                    message=template.format(
                        number=invoice.number, email=invoice.customer.email
                    ),
                    target="invoice",
                    target_id=invoice.id,
                )
            )

    payments = db.scalars(
        select(Payment)
        .options(selectinload(Payment.invoice))
        .order_by(Payment.created_at.desc())
        .limit(limit)
    ).all()
    for payment in payments:
        items.append(
            ActivityItem(
                at=payment.created_at,
                kind="payment_recorded",
                message=f"Payment of ₹{payment.amount:,.2f} recorded on {payment.invoice.number}",
                target="invoice",
                target_id=payment.invoice_id,
            )
        )

    items.sort(key=lambda item: item.at, reverse=True)
    return items[:limit]


def staff_dashboard(
    db: Session, *, date_from: date | None, date_to: date | None
) -> StaffDashboard:
    today = clock.today()

    total_customers, active_customers = db.execute(
        select(
            func.count(User.id),
            func.count(User.id).filter(User.is_active.is_(True)),
        ).where(User.role == UserRole.CUSTOMER)
    ).one()

    status_counts = dict(
        db.execute(
            select(Subscription.status, func.count()).group_by(Subscription.status)
        ).all()
    )

    payments = select(
        func.coalesce(func.sum(Payment.amount), 0), func.count(Payment.id)
    )
    if date_from is not None:
        payments = payments.where(Payment.paid_on >= date_from)
    if date_to is not None:
        payments = payments.where(Payment.paid_on <= date_to)
    revenue, payments_count = db.execute(payments).one()

    balance = func.coalesce(func.sum(Invoice.total - Invoice.amount_paid), 0)
    outstanding_count, outstanding_amount = db.execute(
        select(func.count(Invoice.id), balance).where(
            Invoice.status == InvoiceStatus.CONFIRMED
        )
    ).one()
    overdue_count, overdue_amount = db.execute(
        select(func.count(Invoice.id), balance).where(overdue_condition(today))
    ).one()
    draft_invoices = db.scalar(
        select(func.count(Invoice.id)).where(Invoice.status == InvoiceStatus.DRAFT)
    )

    return StaffDashboard(
        as_of=today,
        date_from=date_from,
        date_to=date_to,
        total_customers=total_customers,
        active_customers=active_customers,
        active_subscriptions=status_counts.get(SubscriptionStatus.ACTIVE, 0),
        open_quotations=status_counts.get(SubscriptionStatus.QUOTATION, 0),
        awaiting_activation=status_counts.get(SubscriptionStatus.CONFIRMED, 0),
        revenue_received=revenue or ZERO,
        payments_count=payments_count,
        outstanding_invoices=outstanding_count,
        outstanding_amount=outstanding_amount or ZERO,
        overdue_invoices=overdue_count,
        overdue_amount=overdue_amount or ZERO,
        draft_invoices=draft_invoices or 0,
        recent_activity=_recent_activity(db, RECENT_ACTIVITY_LIMIT),
    )
