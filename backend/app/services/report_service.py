"""Admin reports. Every figure is a database aggregate; no rows are loaded into Python.

Definitions (kept separate on purpose; they are different numbers):
- Invoiced: totals of invoices issued (CONFIRMED or PAID), dated by invoice_date. Drafts are
  internal and CANCELLED invoices are void, so neither counts.
- Received (cash collected): sum of recorded payments, dated by paid_on.
- Outstanding: unpaid balance of CONFIRMED invoices (total - amount paid), as of today.
- Overdue: the part of Outstanding whose due date has passed.
- Recurring revenue (PROPOSED, pending approval): monthly-equivalent pre-tax value of
  ACTIVE subscriptions. Each subscription's line subtotal is scaled by its billing
  frequency: daily x 365/12, weekly x 52/12, monthly x 1, yearly / 12.
"""

from dataclasses import dataclass, field
from datetime import UTC, date, datetime, time, timedelta
from decimal import Decimal

from sqlalchemy import extract, func, select
from sqlalchemy.orm import Session

from app.models.invoice import Invoice, InvoiceStatus
from app.models.payment import Payment
from app.models.subscription import (
    BillingFrequency,
    Subscription,
    SubscriptionLine,
    SubscriptionStatus,
)
from app.services import clock
from app.services.invoice_service import overdue_condition
from app.services.money import ZERO, round_money

ISSUED = (InvoiceStatus.CONFIRMED, InvoiceStatus.PAID)
MONTHLY_FACTOR = {
    BillingFrequency.DAILY: Decimal(365) / Decimal(12),
    BillingFrequency.WEEKLY: Decimal(52) / Decimal(12),
    BillingFrequency.MONTHLY: Decimal(1),
    BillingFrequency.YEARLY: Decimal(1) / Decimal(12),
}


def _money(value) -> Decimal:
    return round_money(Decimal(value or 0))


@dataclass(frozen=True)
class PeriodRow:
    year: int
    month: int | None
    invoiced: Decimal
    invoices_count: int
    received: Decimal
    payments_count: int


@dataclass(frozen=True)
class RevenueReport:
    date_from: date
    date_to: date
    group_by: str
    invoiced: Decimal
    invoices_count: int
    received: Decimal
    payments_count: int
    outstanding: Decimal
    outstanding_count: int
    overdue: Decimal
    overdue_count: int
    periods: list[PeriodRow] = field(default_factory=list)


def revenue_report(
    db: Session, *, date_from: date, date_to: date, group_by: str, today: date
) -> RevenueReport:
    in_range_inv = (
        Invoice.status.in_(ISSUED),
        Invoice.invoice_date >= date_from,
        Invoice.invoice_date <= date_to,
    )
    in_range_pay = (Payment.paid_on >= date_from, Payment.paid_on <= date_to)

    invoiced, invoices_count = db.execute(
        select(func.coalesce(func.sum(Invoice.total), 0), func.count(Invoice.id)).where(
            *in_range_inv
        )
    ).one()
    received, payments_count = db.execute(
        select(
            func.coalesce(func.sum(Payment.amount), 0), func.count(Payment.id)
        ).where(*in_range_pay)
    ).one()
    balance = func.coalesce(func.sum(Invoice.total - Invoice.amount_paid), 0)
    outstanding, outstanding_count = db.execute(
        select(balance, func.count(Invoice.id)).where(
            Invoice.status == InvoiceStatus.CONFIRMED
        )
    ).one()
    overdue, overdue_count = db.execute(
        select(balance, func.count(Invoice.id)).where(overdue_condition(today))
    ).one()

    inv_year = extract("year", Invoice.invoice_date)
    pay_year = extract("year", Payment.paid_on)
    if group_by == "month":
        inv_keys = (inv_year, extract("month", Invoice.invoice_date))
        pay_keys = (pay_year, extract("month", Payment.paid_on))
    else:
        inv_keys = (inv_year,)
        pay_keys = (pay_year,)

    buckets: dict[tuple[int, int | None], dict] = {}

    def bucket(key) -> dict:
        year = int(key[0])
        month = int(key[1]) if len(key) > 1 else None
        return buckets.setdefault(
            (year, month),
            {
                "invoiced": ZERO,
                "invoices_count": 0,
                "received": ZERO,
                "payments_count": 0,
            },
        )

    for *key, total, count in db.execute(
        select(
            *inv_keys, func.coalesce(func.sum(Invoice.total), 0), func.count(Invoice.id)
        )
        .where(*in_range_inv)
        .group_by(*inv_keys)
    ):
        b = bucket(key)
        b["invoiced"], b["invoices_count"] = _money(total), count
    for *key, total, count in db.execute(
        select(
            *pay_keys,
            func.coalesce(func.sum(Payment.amount), 0),
            func.count(Payment.id),
        )
        .where(*in_range_pay)
        .group_by(*pay_keys)
    ):
        b = bucket(key)
        b["received"], b["payments_count"] = _money(total), count

    periods = [
        PeriodRow(year=y, month=m, **values)
        for (y, m), values in sorted(
            buckets.items(), key=lambda kv: (kv[0][0], kv[0][1] or 0)
        )
    ]
    return RevenueReport(
        date_from=date_from,
        date_to=date_to,
        group_by=group_by,
        invoiced=_money(invoiced),
        invoices_count=invoices_count,
        received=_money(received),
        payments_count=payments_count,
        outstanding=_money(outstanding),
        outstanding_count=outstanding_count,
        overdue=_money(overdue),
        overdue_count=overdue_count,
        periods=periods,
    )


@dataclass(frozen=True)
class SubscriptionReport:
    date_from: date
    date_to: date
    new_subscriptions: int
    closed_subscriptions: int
    expired_subscriptions: int
    active_subscriptions: int
    open_quotations: int
    awaiting_activation: int
    # No renewal feature exists yet, so renewals are not tracked (always None).
    renewed_subscriptions: int | None
    status_counts: dict[str, int]
    recurring_revenue_monthly: Decimal
    recurring_by_frequency: dict[str, Decimal]


def subscription_report(
    db: Session, *, date_from: date, date_to: date, today: date
) -> SubscriptionReport:
    # Timestamps are bucketed by the business (India) day, not the database session's zone.
    # Bounds are passed as UTC because SQLite stores the UTC wall-clock value without offset.
    start = datetime.combine(date_from, time.min, clock.BUSINESS_TIMEZONE).astimezone(
        UTC
    )
    end = datetime.combine(
        date_to + timedelta(days=1), time.min, clock.BUSINESS_TIMEZONE
    ).astimezone(UTC)
    counts = db.execute(
        select(
            func.count(Subscription.id).filter(
                Subscription.activated_at >= start, Subscription.activated_at < end
            ),
            func.count(Subscription.id).filter(
                Subscription.closed_at >= start, Subscription.closed_at < end
            ),
            # Reached its expiry date inside the range (billing stops after expiry).
            func.count(Subscription.id).filter(
                Subscription.expiry_date.is_not(None),
                Subscription.expiry_date >= date_from,
                Subscription.expiry_date <= date_to,
                Subscription.expiry_date < today,
            ),
        )
    ).one()
    status_counts = {
        str(status): count
        for status, count in db.execute(
            select(Subscription.status, func.count()).group_by(Subscription.status)
        )
    }

    line_subtotal = func.round(
        SubscriptionLine.quantity * SubscriptionLine.unit_price, 2
    )
    by_frequency = {
        str(freq): _money(total)
        for freq, total in db.execute(
            select(
                Subscription.billing_frequency,
                func.coalesce(func.sum(line_subtotal), 0),
            )
            .join(SubscriptionLine, SubscriptionLine.subscription_id == Subscription.id)
            .where(
                Subscription.status == SubscriptionStatus.ACTIVE,
                (Subscription.expiry_date.is_(None))
                | (Subscription.expiry_date >= today),
            )
            .group_by(Subscription.billing_frequency)
        )
    }
    # Monthly scaling happens on the grouped totals (at most four rows).
    monthly = round_money(
        sum(
            (
                Decimal(total) * MONTHLY_FACTOR[BillingFrequency(freq)]
                for freq, total in by_frequency.items()
            ),
            ZERO,
        )
    )

    return SubscriptionReport(
        date_from=date_from,
        date_to=date_to,
        new_subscriptions=counts[0],
        closed_subscriptions=counts[1],
        expired_subscriptions=counts[2],
        active_subscriptions=status_counts.get(SubscriptionStatus.ACTIVE.value, 0),
        open_quotations=status_counts.get(SubscriptionStatus.QUOTATION.value, 0),
        awaiting_activation=status_counts.get(SubscriptionStatus.CONFIRMED.value, 0),
        renewed_subscriptions=None,
        status_counts=status_counts,
        recurring_revenue_monthly=monthly,
        recurring_by_frequency=by_frequency,
    )
