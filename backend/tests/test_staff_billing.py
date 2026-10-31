"""Staff panel: quotation lifecycle, invoice generation, payments, dashboard."""

from datetime import date

import pytest
from fastapi.testclient import TestClient

from app.models.user import User
from app.services import clock
from tests.conftest import bearer_headers
from tests.staff_helpers import (
    action,
    activate,
    create_quotation,
    invoices_for,
    run_billing,
)

TODAY = date(2026, 10, 31)


@pytest.fixture(autouse=True)
def fixed_today(monkeypatch: pytest.MonkeyPatch) -> None:
    """Pin the business date so billing periods are predictable."""
    monkeypatch.setattr(clock, "today", lambda: TODAY)


@pytest.fixture
def staff_headers(client: TestClient, staff: User) -> dict[str, str]:
    return bearer_headers(client, staff.email)


def test_customers_and_anonymous_cannot_use_staff_api(
    client: TestClient, customer: User
) -> None:
    assert client.get("/api/staff/subscriptions").status_code == 401
    headers = bearer_headers(client, customer.email)
    for path in (
        "/api/staff/subscriptions",
        "/api/staff/invoices",
        "/api/staff/payments",
        "/api/staff/dashboard",
        "/api/staff/customers",
    ):
        assert client.get(path, headers=headers).status_code == 403, path


def test_admin_can_use_staff_api(client: TestClient, admin: User) -> None:
    headers = bearer_headers(client, admin.email)
    assert client.get("/api/staff/subscriptions", headers=headers).status_code == 200


def test_quotation_numbers_and_totals(
    client: TestClient, staff_headers: dict, customer: User
) -> None:
    first = create_quotation(client, staff_headers, str(customer.id))
    second = create_quotation(client, staff_headers, str(customer.id), lines=[])
    assert first["number"] == "SUB-00001"
    assert second["number"] == "SUB-00002"
    assert first["status"] == "DRAFT"
    # 10 x 5000 + 2 x 500 = 51000, 18% tax = 9180.
    assert (first["subtotal"], first["tax_total"], first["total"]) == (
        "51000.00",
        "9180.00",
        "60180.00",
    )


def test_quotation_needs_an_active_customer(
    client: TestClient, staff_headers: dict, staff: User, make_user
) -> None:
    from app.models.user import UserRole

    inactive = make_user("gone@example.com", UserRole.CUSTOMER, is_active=False)
    for customer_id in (str(staff.id), str(inactive.id)):
        response = client.post(
            "/api/staff/subscriptions",
            headers=staff_headers,
            json={
                "customer_id": customer_id,
                "plan_name": "Basic",
                "billing_frequency": "MONTHLY",
            },
        )
        assert response.status_code == 422, customer_id


def test_lifecycle_rules(
    client: TestClient, staff_headers: dict, customer: User
) -> None:
    empty = create_quotation(client, staff_headers, str(customer.id), lines=[])
    assert (
        action(client, staff_headers, empty["id"], "send-quotation").status_code == 409
    )

    sub = create_quotation(client, staff_headers, str(customer.id))
    sub_id = sub["id"]
    assert action(client, staff_headers, sub_id, "activate").status_code == 409

    sent = action(client, staff_headers, sub_id, "send-quotation", {"valid_days": 15})
    assert sent.json()["status"] == "QUOTATION"
    assert sent.json()["quotation_valid_until"] == "2026-11-15"
    # Quotations can't be edited until moved back to draft.
    patch = client.patch(
        f"/api/staff/subscriptions/{sub_id}", headers=staff_headers, json={"notes": "x"}
    )
    assert patch.status_code == 409
    assert (
        action(client, staff_headers, sub_id, "revert-to-draft").json()["status"]
        == "DRAFT"
    )
    assert (
        client.patch(
            f"/api/staff/subscriptions/{sub_id}",
            headers=staff_headers,
            json={"notes": "x"},
        ).json()["notes"]
        == "x"
    )

    action(client, staff_headers, sub_id, "send-quotation")
    assert (
        action(client, staff_headers, sub_id, "confirm").json()["status"] == "CONFIRMED"
    )
    active = action(
        client, staff_headers, sub_id, "activate", {"start_date": "2026-10-01"}
    ).json()
    assert active["status"] == "ACTIVE"
    assert active["next_billing_date"] == "2026-10-01"

    closed = action(client, staff_headers, sub_id, "close").json()
    assert closed["status"] == "CLOSED"
    assert closed["next_billing_date"] is None
    assert action(client, staff_headers, sub_id, "close").status_code == 409


def test_expired_quotation_cannot_be_confirmed(
    client: TestClient, staff_headers: dict, customer: User, monkeypatch
) -> None:
    sub = create_quotation(client, staff_headers, str(customer.id))
    action(client, staff_headers, sub["id"], "send-quotation", {"valid_days": 1})
    monkeypatch.setattr(clock, "today", lambda: date(2026, 11, 2))
    assert action(client, staff_headers, sub["id"], "confirm").status_code == 409


def test_billing_catches_up_handles_month_ends_and_never_duplicates(
    client: TestClient, staff_headers: dict, customer: User
) -> None:
    sub = create_quotation(client, staff_headers, str(customer.id))
    activate(client, staff_headers, sub["id"], "2026-08-31")

    run = run_billing(client, staff_headers)
    assert run["invoices_created"] == 3
    assert run_billing(client, staff_headers)["invoices_created"] == 0

    invoices = invoices_for(client, staff_headers, sub["id"])
    assert [(i["period_start"], i["period_end"]) for i in invoices] == [
        ("2026-08-31", "2026-09-29"),
        ("2026-09-30", "2026-10-30"),
        ("2026-10-31", "2026-11-29"),
    ]
    assert invoices[0]["total"] == "60180.00"
    assert invoices[0]["due_date"] == "2026-09-15"
    assert all(i["status"] == "DRAFT" for i in invoices)
    detail = client.get(f"/api/staff/subscriptions/{sub['id']}", headers=staff_headers)
    assert detail.json()["next_billing_date"] == "2026-11-30"


def test_billing_stops_at_expiry_and_refuses_future_dates(
    client: TestClient, staff_headers: dict, customer: User
) -> None:
    sub = create_quotation(client, staff_headers, str(customer.id), frequency="WEEKLY")
    activate(client, staff_headers, sub["id"], "2026-10-01", expiry="2026-10-20")
    assert run_billing(client, staff_headers)["invoices_created"] == 3
    invoices = invoices_for(client, staff_headers, sub["id"])
    assert invoices[-1]["period_end"] == "2026-10-20"
    detail = client.get(f"/api/staff/subscriptions/{sub['id']}", headers=staff_headers)
    assert detail.json()["next_billing_date"] is None

    future = client.post(
        "/api/staff/billing/run", headers=staff_headers, json={"as_of": "2099-01-01"}
    )
    assert future.status_code == 422


def test_payments_partial_full_and_rules(
    client: TestClient, staff_headers: dict, customer: User
) -> None:
    sub = create_quotation(client, staff_headers, str(customer.id))
    activate(client, staff_headers, sub["id"], "2026-08-31")
    run_billing(client, staff_headers)
    first, second, _ = invoices_for(client, staff_headers, sub["id"])

    def pay(invoice_id: str, amount: str, **extra):
        return client.post(
            "/api/staff/payments",
            headers=staff_headers,
            json={"invoice_id": invoice_id, "amount": amount, "method": "UPI", **extra},
        )

    assert pay(first["id"], "100").status_code == 409  # still a draft
    confirmed = client.post(
        f"/api/staff/invoices/{first['id']}/confirm", headers=staff_headers
    ).json()
    assert confirmed["status"] == "CONFIRMED"
    assert confirmed["is_overdue"] is True  # due 15 Sep, today 31 Oct

    partial = pay(first["id"], "30000", reference="TXN-1")
    assert partial.status_code == 201
    assert partial.json()["reference"] == "TXN-1"
    detail = client.get(
        f"/api/staff/invoices/{first['id']}", headers=staff_headers
    ).json()
    assert (detail["status"], detail["amount_due"]) == ("CONFIRMED", "30180.00")

    assert pay(first["id"], "40000").status_code == 422  # more than the balance
    assert pay(first["id"], "1", paid_on="2099-01-01").status_code == 422
    assert (
        client.post(
            f"/api/staff/invoices/{first['id']}/cancel", headers=staff_headers
        ).status_code
        == 409
    )

    assert pay(first["id"], "30180.00").status_code == 201
    detail = client.get(
        f"/api/staff/invoices/{first['id']}", headers=staff_headers
    ).json()
    assert (detail["status"], detail["amount_due"], detail["is_overdue"]) == (
        "PAID",
        "0.00",
        False,
    )
    assert len(detail["payments"]) == 2
    assert pay(first["id"], "1").status_code == 409

    cancelled = client.post(
        f"/api/staff/invoices/{second['id']}/cancel", headers=staff_headers
    ).json()
    assert cancelled["status"] == "CANCELLED"
    # A cancelled billing period is not re-billed.
    assert run_billing(client, staff_headers)["invoices_created"] == 0

    by_customer = client.get(
        f"/api/staff/payments?customer_id={customer.id}", headers=staff_headers
    ).json()
    assert by_customer["total"] == 2


def test_dashboard_totals_and_activity(
    client: TestClient, staff_headers: dict, customer: User
) -> None:
    sub = create_quotation(client, staff_headers, str(customer.id))
    activate(client, staff_headers, sub["id"], "2026-10-01")
    run_billing(client, staff_headers)
    (invoice,) = invoices_for(client, staff_headers, sub["id"])
    client.post(f"/api/staff/invoices/{invoice['id']}/confirm", headers=staff_headers)
    client.post(
        "/api/staff/payments",
        headers=staff_headers,
        json={"invoice_id": invoice["id"], "amount": "10000", "method": "CASH"},
    )

    data = client.get("/api/staff/dashboard", headers=staff_headers).json()
    assert data["total_customers"] == 1
    assert data["active_subscriptions"] == 1
    assert data["revenue_received"] == "10000.00"
    assert data["outstanding_invoices"] == 1
    assert data["outstanding_amount"] == "50180.00"
    assert data["overdue_invoices"] == 1  # due 16 Oct
    kinds = {item["kind"] for item in data["recent_activity"]}
    assert {"subscription_activated", "invoice_generated", "payment_recorded"} <= kinds

    empty = client.get(
        "/api/staff/dashboard?date_from=2020-01-01&date_to=2020-01-31",
        headers=staff_headers,
    ).json()
    assert empty["revenue_received"] == "0.00"
