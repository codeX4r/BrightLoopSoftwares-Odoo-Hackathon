"""Recurring invoice generation and the invoice lifecycle."""

import threading
import uuid
from datetime import date, timedelta
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.invoice import Invoice, InvoiceStatus
from app.models.subscription import BillingFrequency
from app.models.user import User, UserRole
from app.services import billing_service
from app.services.billing_service import add_months, next_period_start
from tests.conftest import TEST_DATABASE_URL, TestingSessionLocal, bearer_headers
from tests.staff_helpers import (
    STAFF_API,
    action,
    activate_subscription,
    confirm_invoice,
    create_subscription,
    freeze_today,
    list_invoices,
    record_payment,
    run_billing,
)

TODAY = date(2026, 10, 31)


@pytest.fixture
def staff_headers(client: TestClient, staff: User) -> dict[str, str]:
    return bearer_headers(client, staff.email)


@pytest.fixture
def customer_headers(client: TestClient, customer: User) -> dict[str, str]:
    return bearer_headers(client, customer.email)


@pytest.fixture(autouse=True)
def fixed_today(monkeypatch: pytest.MonkeyPatch) -> None:
    freeze_today(monkeypatch, TODAY)


# --- Period arithmetic -------------------------------------------------------


@pytest.mark.parametrize(
    ("frequency", "start", "expected"),
    [
        (BillingFrequency.DAILY, date(2026, 10, 31), date(2026, 11, 1)),
        (BillingFrequency.WEEKLY, date(2026, 10, 31), date(2026, 11, 7)),
        (BillingFrequency.MONTHLY, date(2026, 10, 15), date(2026, 11, 15)),
        (BillingFrequency.YEARLY, date(2026, 10, 15), date(2027, 10, 15)),
    ],
)
def test_next_period_for_each_frequency(
    frequency: BillingFrequency, start: date, expected: date
) -> None:
    assert next_period_start(start, frequency, start.day) == expected


def test_month_end_anchor_is_kept() -> None:
    # Anchored on the 31st: Jan 31 -> Feb 28 -> Mar 31, never drifting to the 28th.
    feb = add_months(date(2027, 1, 31), 1, 31)
    mar = add_months(feb, 1, 31)
    assert (feb, mar) == (date(2027, 2, 28), date(2027, 3, 31))
    assert add_months(date(2028, 1, 31), 1, 31) == date(2028, 2, 29)  # leap year


def test_yearly_leap_day_start() -> None:
    assert add_months(date(2028, 2, 29), 12, 29) == date(2029, 2, 28)


# --- Generating invoices -----------------------------------------------------


def test_billing_creates_invoice_with_copied_lines_and_totals(
    client: TestClient, staff_headers: dict, customer: User
) -> None:
    sub = activate_subscription(
        client, staff_headers, str(customer.id), start_date=TODAY
    )

    run = run_billing(client, staff_headers, TODAY)

    assert run["invoices_created"] == 1
    invoice = client.get(
        f"{STAFF_API}/invoices/{list_invoices(client, staff_headers)[0]['id']}",
        headers=staff_headers,
    ).json()
    assert invoice["status"] == "DRAFT"
    assert invoice["subscription"]["id"] == sub["id"]
    assert (invoice["period_start"], invoice["period_end"]) == (
        "2026-10-31",
        "2026-11-29",
    )
    assert invoice["invoice_date"] == "2026-10-31"
    assert invoice["due_date"] == "2026-11-15"  # 15 days payment terms
    assert (invoice["subtotal"], invoice["tax_total"], invoice["total"]) == (
        "1099.98",
        "55.00",
        "1154.98",
    )
    assert [
        (line["description"], line["quantity"], line["unit_price"], line["tax_rate"])
        for line in invoice["lines"]
    ] == [("Seat licence", 3, "333.33", "5.00"), ("Odoo add-on", 1, "99.99", "5.00")]

    after = client.get(f"{STAFF_API}/subscriptions/{sub['id']}", headers=staff_headers)
    assert after.json()["next_billing_date"] == "2026-11-30"


def test_billing_is_idempotent(
    client: TestClient, staff_headers: dict, customer: User
) -> None:
    activate_subscription(client, staff_headers, str(customer.id), start_date=TODAY)

    first = run_billing(client, staff_headers, TODAY)
    second = run_billing(client, staff_headers, TODAY)

    assert first["invoices_created"] == 1
    assert second["invoices_created"] == 0
    assert len(list_invoices(client, staff_headers)) == 1


def test_billing_catches_up_on_missed_periods(
    client: TestClient, staff_headers: dict, customer: User
) -> None:
    activate_subscription(
        client, staff_headers, str(customer.id), start_date=date(2026, 7, 31)
    )

    run = run_billing(client, staff_headers, TODAY)

    periods = sorted(i["period_start"] for i in list_invoices(client, staff_headers))
    assert run["invoices_created"] == 4
    assert periods == ["2026-07-31", "2026-08-31", "2026-09-30", "2026-10-31"]


def test_nothing_is_billed_before_its_date(
    client: TestClient, staff_headers: dict, customer: User
) -> None:
    activate_subscription(
        client, staff_headers, str(customer.id), start_date=TODAY + timedelta(days=1)
    )

    assert run_billing(client, staff_headers, TODAY)["invoices_created"] == 0


def test_billing_stops_at_expiry_and_clamps_last_period(
    client: TestClient, staff_headers: dict, customer: User
) -> None:
    sub = activate_subscription(
        client,
        staff_headers,
        str(customer.id),
        start_date=date(2026, 9, 1),
        expiry_date=date(2026, 10, 15),
    )

    run_billing(client, staff_headers, TODAY)

    periods = sorted(
        (i["period_start"], i["period_end"])
        for i in list_invoices(client, staff_headers)
    )
    assert periods == [("2026-09-01", "2026-09-30"), ("2026-10-01", "2026-10-15")]
    after = client.get(f"{STAFF_API}/subscriptions/{sub['id']}", headers=staff_headers)
    assert after.json()["next_billing_date"] is None


@pytest.mark.parametrize("frequency", ["DAILY", "WEEKLY", "MONTHLY", "YEARLY"])
def test_each_frequency_bills_its_own_period(
    client: TestClient, staff_headers: dict, customer: User, frequency: str
) -> None:
    activate_subscription(
        client,
        staff_headers,
        str(customer.id),
        start_date=TODAY,
        billing_frequency=frequency,
    )

    run_billing(client, staff_headers, TODAY)

    invoice = list_invoices(client, staff_headers)[0]
    expected_end = {
        "DAILY": "2026-10-31",
        "WEEKLY": "2026-11-06",
        "MONTHLY": "2026-11-29",
        "YEARLY": "2027-10-30",
    }[frequency]
    assert invoice["period_end"] == expected_end


def test_closed_and_unactivated_subscriptions_are_not_billed(
    client: TestClient, staff_headers: dict, customer: User
) -> None:
    create_subscription(client, staff_headers, str(customer.id))  # stays DRAFT
    closed = activate_subscription(
        client, staff_headers, str(customer.id), start_date=TODAY
    )
    action(client, staff_headers, closed["id"], "close")

    assert run_billing(client, staff_headers, TODAY)["invoices_created"] == 0


def test_billing_for_a_future_date_is_refused(
    client: TestClient, staff_headers: dict
) -> None:
    response = client.post(
        f"{STAFF_API}/billing/run",
        json={"as_of": (TODAY + timedelta(days=1)).isoformat()},
        headers=staff_headers,
    )
    assert response.status_code == 422


def test_database_rejects_a_second_invoice_for_the_same_period(
    client: TestClient, staff_headers: dict, customer: User, db: Session
) -> None:
    activate_subscription(client, staff_headers, str(customer.id), start_date=TODAY)
    run_billing(client, staff_headers, TODAY)
    original = db.scalar(select(Invoice))

    duplicate = Invoice(
        number="INV-99999",
        subscription_id=original.subscription_id,
        customer_id=original.customer_id,
        status=InvoiceStatus.DRAFT,
        invoice_date=original.invoice_date,
        due_date=original.due_date,
        period_start=original.period_start,
        period_end=original.period_end,
        subtotal=Decimal(1),
        tax_total=Decimal(0),
        total=Decimal(1),
        amount_paid=Decimal(0),
    )
    db.add(duplicate)
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()


@pytest.mark.skipif(
    TEST_DATABASE_URL.startswith("sqlite"),
    reason="Row locking needs Postgres; run with TEST_DATABASE_URL",
)
def test_concurrent_billing_runs_create_one_invoice(
    client: TestClient, staff_headers: dict, customer: User
) -> None:
    activate_subscription(client, staff_headers, str(customer.id), start_date=TODAY)
    created: list[list[str]] = []

    def worker() -> None:
        with TestingSessionLocal() as session:
            created.append(
                billing_service.generate_due_invoices(session, TODAY).invoice_numbers
            )

    threads = [threading.Thread(target=worker) for _ in range(4)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()

    assert sum(len(numbers) for numbers in created) == 1
    assert len(list_invoices(client, staff_headers)) == 1


def test_invoice_numbers_are_unique_and_sequential(
    client: TestClient, staff_headers: dict, customer: User, db: Session
) -> None:
    activate_subscription(
        client, staff_headers, str(customer.id), start_date=date(2026, 8, 31)
    )
    run_billing(client, staff_headers, TODAY)

    numbers = sorted(db.scalars(select(Invoice.number)).all())
    assert numbers == ["INV-00001", "INV-00002", "INV-00003"]
    assert db.scalar(select(func.count(func.distinct(Invoice.number)))) == 3


# --- Invoice lifecycle -------------------------------------------------------


@pytest.fixture
def draft_invoice(client: TestClient, staff_headers: dict, customer: User) -> dict:
    activate_subscription(client, staff_headers, str(customer.id), start_date=TODAY)
    run_billing(client, staff_headers, TODAY)
    return list_invoices(client, staff_headers)[0]


def test_invoice_confirm_cancel_and_send_rules(
    client: TestClient, staff_headers: dict, draft_invoice: dict
) -> None:
    path = f"{STAFF_API}/invoices/{draft_invoice['id']}"

    assert client.post(f"{path}/send", headers=staff_headers).status_code == 409
    confirmed = confirm_invoice(client, staff_headers, draft_invoice["id"])
    assert confirmed["status"] == "CONFIRMED"
    assert client.post(f"{path}/confirm", headers=staff_headers).status_code == 409

    sent = client.post(f"{path}/send", headers=staff_headers)
    assert sent.status_code == 200
    assert sent.json()["sent_at"] is not None

    cancelled = client.post(f"{path}/cancel", headers=staff_headers)
    assert cancelled.json()["status"] == "CANCELLED"
    assert client.post(f"{path}/cancel", headers=staff_headers).status_code == 409


def test_cancelled_period_is_not_billed_again(
    client: TestClient, staff_headers: dict, draft_invoice: dict
) -> None:
    client.post(
        f"{STAFF_API}/invoices/{draft_invoice['id']}/cancel", headers=staff_headers
    )

    assert run_billing(client, staff_headers, TODAY)["invoices_created"] == 0


def test_zero_total_invoice_is_paid_on_confirm(
    client: TestClient, staff_headers: dict, customer: User
) -> None:
    activate_subscription(
        client,
        staff_headers,
        str(customer.id),
        start_date=TODAY,
        lines=[{"description": "Free tier", "quantity": 1, "unit_price": "0"}],
    )
    run_billing(client, staff_headers, TODAY)
    invoice = list_invoices(client, staff_headers)[0]

    assert confirm_invoice(client, staff_headers, invoice["id"])["status"] == "PAID"


def test_overdue_invoices_are_flagged_and_filterable(
    client: TestClient,
    staff_headers: dict,
    draft_invoice: dict,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    confirm_invoice(client, staff_headers, draft_invoice["id"])
    assert list_invoices(client, staff_headers, overdue="true") == []

    freeze_today(monkeypatch, date(2026, 11, 16))  # due 2026-11-15

    overdue = list_invoices(client, staff_headers, overdue="true")
    assert [i["id"] for i in overdue] == [draft_invoice["id"]]
    assert overdue[0]["is_overdue"] is True


def test_paid_invoice_is_never_overdue(
    client: TestClient,
    staff_headers: dict,
    draft_invoice: dict,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    confirm_invoice(client, staff_headers, draft_invoice["id"])
    record_payment(client, staff_headers, draft_invoice["id"], draft_invoice["total"])
    freeze_today(monkeypatch, date(2026, 12, 31))

    assert list_invoices(client, staff_headers, overdue="true") == []


def test_invoice_list_filters(
    client: TestClient, staff_headers: dict, customer: User, make_user
) -> None:
    other = make_user("other.customer@brightloop.com", UserRole.CUSTOMER)
    activate_subscription(client, staff_headers, str(customer.id), start_date=TODAY)
    activate_subscription(client, staff_headers, str(other.id), start_date=TODAY)
    run_billing(client, staff_headers, TODAY)
    first = list_invoices(client, staff_headers, customer_id=str(customer.id))[0]
    confirm_invoice(client, staff_headers, first["id"])

    assert len(list_invoices(client, staff_headers)) == 2
    assert len(list_invoices(client, staff_headers, status="CONFIRMED")) == 1
    assert len(list_invoices(client, staff_headers, search="other.customer")) == 1
    assert len(list_invoices(client, staff_headers, customer_id=str(customer.id))) == 1


def test_unknown_invoice_returns_404(client: TestClient, staff_headers: dict) -> None:
    response = client.get(f"{STAFF_API}/invoices/{uuid.uuid4()}", headers=staff_headers)
    assert response.status_code == 404


# --- Customer portal ---------------------------------------------------------


def test_customer_sees_only_own_confirmed_invoices(
    client: TestClient,
    staff_headers: dict,
    customer: User,
    customer_headers: dict,
    make_user,
) -> None:
    other = make_user("other.customer@brightloop.com", UserRole.CUSTOMER)
    activate_subscription(client, staff_headers, str(customer.id), start_date=TODAY)
    activate_subscription(client, staff_headers, str(other.id), start_date=TODAY)
    run_billing(client, staff_headers, TODAY)
    mine = list_invoices(client, staff_headers, customer_id=str(customer.id))[0]
    theirs = list_invoices(client, staff_headers, customer_id=str(other.id))[0]
    confirm_invoice(client, staff_headers, theirs["id"])

    # Drafts are internal: nothing is visible until staff confirm.
    assert (
        client.get("/api/portal/invoices", headers=customer_headers).json()["items"]
        == []
    )
    draft = client.get(f"/api/portal/invoices/{mine['id']}", headers=customer_headers)
    assert draft.status_code == 404

    confirm_invoice(client, staff_headers, mine["id"])
    listed = client.get("/api/portal/invoices", headers=customer_headers).json()[
        "items"
    ]
    assert [i["id"] for i in listed] == [mine["id"]]
    other_invoice = client.get(
        f"/api/portal/invoices/{theirs['id']}", headers=customer_headers
    )
    assert other_invoice.status_code == 404
