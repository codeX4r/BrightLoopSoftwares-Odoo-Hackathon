"""The demo-data command builds a consistent data set and removes only its own rows."""

from datetime import date

import pytest
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.jobs import demo_data
from app.models.invoice import Invoice, InvoiceStatus
from app.models.subscription import Subscription, SubscriptionStatus
from app.models.user import User, UserRole
from app.services import clock


@pytest.fixture(autouse=True)
def fixed_today(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(clock, "today", lambda: date(2026, 10, 31))


def _count(db: Session, model, *where) -> int:
    return db.scalar(select(func.count()).select_from(model).where(*where)) or 0


def test_create_and_remove(db: Session, make_user) -> None:
    keep = make_user("real.customer@example.com", UserRole.CUSTOMER)

    demo_data.create(db)
    db.expire_all()

    statuses = dict(
        db.execute(
            select(Subscription.status, func.count()).group_by(Subscription.status)
        ).all()
    )
    assert statuses[SubscriptionStatus.ACTIVE] == 2  # Aarav, Kabir
    assert statuses[SubscriptionStatus.QUOTATION] == 1  # Priya
    assert statuses[SubscriptionStatus.DRAFT] == 1  # Priya's alternative
    assert statuses[SubscriptionStatus.CONFIRMED] == 1  # Rohan
    assert statuses[SubscriptionStatus.CLOSED] == 2  # Neha (declined), Ananya
    assert _count(db, Subscription, Subscription.rejected_at.is_not(None)) == 1

    assert _count(db, Invoice, Invoice.status == InvoiceStatus.PAID) >= 5
    assert _count(db, Invoice, Invoice.status == InvoiceStatus.DRAFT) >= 1
    # Aarav has a part-paid invoice and an overdue one.
    assert (
        _count(
            db,
            Invoice,
            Invoice.status == InvoiceStatus.CONFIRMED,
            Invoice.amount_paid > 0,
        )
        == 1
    )
    assert (
        _count(
            db,
            Invoice,
            Invoice.status == InvoiceStatus.CONFIRMED,
            Invoice.due_date < clock.today(),
        )
        >= 1
    )

    removed = demo_data.remove(db)
    assert (
        removed == 1 + len(demo_data.CUSTOMERS) + 1
    )  # staff + customers + new customer
    db.expire_all()
    assert _count(db, Subscription) == 0
    assert _count(db, Invoice) == 0
    assert db.get(User, keep.id) is not None


def test_bulk_history_is_consistent(db: Session) -> None:
    """The bulk generator's invoices, payments and balances must add up."""
    from app.jobs.demo_bulk import create_bulk
    from app.models.payment import Payment

    demo_data.create(db)
    staff = db.scalar(select(User).where(User.email == demo_data.STAFF_EMAIL))
    create_bulk(
        db,
        staff,
        25,
        domain=demo_data.DEMO_DOMAIN,
        password=demo_data.CUSTOMER_PASSWORD,
    )
    db.expire_all()

    customers = _count(db, User, User.role == UserRole.CUSTOMER)
    assert customers == len(demo_data.CUSTOMERS) + 1 + 25
    assert _count(db, Invoice) > 50

    # Every invoice's amount_paid equals the sum of its payments, never over the total,
    # and PAID exactly when fully paid.
    paid_sums = dict(
        db.execute(
            select(Payment.invoice_id, func.sum(Payment.amount)).group_by(
                Payment.invoice_id
            )
        ).all()
    )
    for invoice in db.scalars(select(Invoice)):
        assert invoice.amount_paid == (paid_sums.get(invoice.id) or 0), invoice.number
        assert invoice.amount_paid <= invoice.total
        assert (invoice.status == InvoiceStatus.PAID) == (
            invoice.amount_paid == invoice.total and invoice.total > 0
        ), invoice.number
        if invoice.status == InvoiceStatus.DRAFT:
            assert invoice.amount_paid == 0

    # No payment is dated in the future and none on a draft or cancelled invoice.
    assert _count(db, Payment, Payment.paid_on > clock.today()) == 0
    # No billing period is duplicated (also enforced by the database).
    pairs = db.execute(select(Invoice.subscription_id, Invoice.period_start)).all()
    assert len(pairs) == len(set(pairs))
    # Every ACTIVE subscription is billed up to date.
    assert (
        _count(
            db,
            Subscription,
            Subscription.status == SubscriptionStatus.ACTIVE,
            Subscription.next_billing_date <= clock.today(),
        )
        == 0
    )

    removed = demo_data.remove(db)
    assert removed == customers + 1
    db.expire_all()
    assert _count(db, Invoice) == 0
