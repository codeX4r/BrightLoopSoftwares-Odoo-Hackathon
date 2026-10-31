"""Payments against invoices, outstanding balances and the staff dashboard figures."""

from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient

from app.models.user import User
from tests.conftest import bearer_headers
from tests.staff_helpers import (
    STAFF_API,
    activate_subscription,
    confirm_invoice,
    freeze_today,
    list_invoices,
    record_payment,
    run_billing,
)

TODAY = date(2026, 10, 31)
INVOICE_TOTAL = "1154.98"  # DEFAULT_LINES: 1099.98 + 55.00 tax


@pytest.fixture
def staff_headers(client: TestClient, staff: User) -> dict[str, str]:
    return bearer_headers(client, staff.email)


@pytest.fixture(autouse=True)
def fixed_today(monkeypatch: pytest.MonkeyPatch) -> None:
    freeze_today(monkeypatch, TODAY)


@pytest.fixture
def invoice(client: TestClient, staff_headers: dict, customer: User) -> dict:
    """A confirmed invoice for 1154.98, due 2026-11-15."""
    activate_subscription(client, staff_headers, str(customer.id), start_date=TODAY)
    run_billing(client, staff_headers, TODAY)
    draft = list_invoices(client, staff_headers)[0]
    return confirm_invoice(client, staff_headers, draft["id"])


def get_invoice(client: TestClient, headers: dict, invoice_id: str) -> dict:
    return client.get(f"{STAFF_API}/invoices/{invoice_id}", headers=headers).json()


def test_partial_payments_reduce_the_balance_until_paid(
    client: TestClient, staff_headers: dict, invoice: dict, staff: User
) -> None:
    first = record_payment(
        client, staff_headers, invoice["id"], "500.00", reference="UTR123", notes="Part"
    )
    assert first.status_code == 201, first.text
    assert first.json()["recorded_by"] == staff.email
    assert first.json()["reference"] == "UTR123"

    after_first = get_invoice(client, staff_headers, invoice["id"])
    assert after_first["status"] == "CONFIRMED"
    assert after_first["amount_paid"] == "500.00"
    assert after_first["amount_due"] == "654.98"

    assert (
        record_payment(client, staff_headers, invoice["id"], "654.98").status_code
        == 201
    )

    paid = get_invoice(client, staff_headers, invoice["id"])
    assert paid["status"] == "PAID"
    assert paid["amount_due"] == "0.00"
    assert paid["paid_at"] is not None
    assert [p["amount"] for p in paid["payments"]] == ["500.00", "654.98"]


def test_overpayment_is_rejected(
    client: TestClient, staff_headers: dict, invoice: dict
) -> None:
    response = record_payment(client, staff_headers, invoice["id"], "1154.99")

    assert response.status_code == 422
    assert "outstanding balance of 1154.98" in response.json()["detail"]
    assert get_invoice(client, staff_headers, invoice["id"])["amount_paid"] == "0.00"


def test_paid_invoice_accepts_no_more_payments(
    client: TestClient, staff_headers: dict, invoice: dict
) -> None:
    record_payment(client, staff_headers, invoice["id"], INVOICE_TOTAL)

    response = record_payment(client, staff_headers, invoice["id"], "1.00")

    assert response.status_code == 409
    assert "already fully paid" in response.json()["detail"]


def test_payment_needs_a_confirmed_invoice(
    client: TestClient, staff_headers: dict, customer: User
) -> None:
    activate_subscription(client, staff_headers, str(customer.id), start_date=TODAY)
    run_billing(client, staff_headers, TODAY)
    draft = list_invoices(client, staff_headers)[0]

    on_draft = record_payment(client, staff_headers, draft["id"], "10.00")
    assert on_draft.status_code == 409

    client.post(f"{STAFF_API}/invoices/{draft['id']}/cancel", headers=staff_headers)
    on_cancelled = record_payment(client, staff_headers, draft["id"], "10.00")
    assert on_cancelled.status_code == 409


def test_invoice_with_payments_cannot_be_cancelled(
    client: TestClient, staff_headers: dict, invoice: dict
) -> None:
    record_payment(client, staff_headers, invoice["id"], "100.00")

    response = client.post(
        f"{STAFF_API}/invoices/{invoice['id']}/cancel", headers=staff_headers
    )

    assert response.status_code == 409


@pytest.mark.parametrize("amount", ["0", "-5", "0.001", "abc"])
def test_invalid_amounts_are_rejected(
    client: TestClient, staff_headers: dict, invoice: dict, amount: str
) -> None:
    assert (
        record_payment(client, staff_headers, invoice["id"], amount).status_code == 422
    )


def test_future_payment_date_is_rejected(
    client: TestClient, staff_headers: dict, invoice: dict
) -> None:
    tomorrow = (TODAY + timedelta(days=1)).isoformat()

    response = record_payment(
        client, staff_headers, invoice["id"], "10.00", paid_on=tomorrow
    )

    assert response.status_code == 422


def test_unknown_invoice_and_method_are_rejected(
    client: TestClient, staff_headers: dict, invoice: dict
) -> None:
    missing = record_payment(
        client, staff_headers, "00000000-0000-0000-0000-000000000000", "10.00"
    )
    bad_method = record_payment(
        client, staff_headers, invoice["id"], "10.00", method="BITCOIN"
    )

    assert missing.status_code == 404
    assert bad_method.status_code == 422


def test_customer_cannot_record_payments(
    client: TestClient, customer: User, invoice: dict
) -> None:
    headers = bearer_headers(client, customer.email)

    assert record_payment(client, headers, invoice["id"], "10.00").status_code == 403


def test_payment_list_filters(
    client: TestClient, staff_headers: dict, invoice: dict
) -> None:
    yesterday = (TODAY - timedelta(days=1)).isoformat()
    record_payment(
        client, staff_headers, invoice["id"], "100.00", method="CASH", paid_on=yesterday
    )
    record_payment(client, staff_headers, invoice["id"], "200.00", method="UPI")

    def listed(**params):
        response = client.get(
            f"{STAFF_API}/payments", params=params, headers=staff_headers
        )
        assert response.status_code == 200, response.text
        return response.json()

    assert listed()["total"] == 2
    assert [p["amount"] for p in listed(method="CASH")["items"]] == ["100.00"]
    assert [p["amount"] for p in listed(date_from=TODAY.isoformat())["items"]] == [
        "200.00"
    ]
    assert listed(invoice_id=invoice["id"])["total"] == 2


def test_customer_portal_shows_paid_and_outstanding(
    client: TestClient, staff_headers: dict, customer: User, invoice: dict
) -> None:
    record_payment(client, staff_headers, invoice["id"], "154.98")
    headers = bearer_headers(client, customer.email)

    mine = client.get("/api/portal/invoices", headers=headers).json()["items"][0]

    assert (mine["amount_paid"], mine["amount_due"]) == ("154.98", "1000.00")


# --- Dashboard figures come from the database --------------------------------


def test_dashboard_reflects_database_figures(
    client: TestClient,
    staff_headers: dict,
    invoice: dict,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    empty_check = client.get(f"{STAFF_API}/dashboard", headers=staff_headers).json()
    assert empty_check["active_subscriptions"] == 1
    assert empty_check["revenue_received"] == "0.00"
    assert empty_check["outstanding_invoices"] == 1
    assert empty_check["outstanding_amount"] == INVOICE_TOTAL

    record_payment(client, staff_headers, invoice["id"], "154.98")
    freeze_today(monkeypatch, date(2026, 11, 20))  # past the 2026-11-15 due date

    after = client.get(f"{STAFF_API}/dashboard", headers=staff_headers).json()
    assert after["revenue_received"] == "154.98"
    assert after["payments_count"] == 1
    assert after["outstanding_amount"] == "1000.00"
    assert after["overdue_invoices"] == 1
    assert after["overdue_amount"] == "1000.00"


def test_dashboard_on_empty_database_is_all_zero(
    client: TestClient, staff_headers: dict
) -> None:
    body = client.get(f"{STAFF_API}/dashboard", headers=staff_headers).json()

    assert body["active_subscriptions"] == 0
    assert body["revenue_received"] == "0.00"
    assert body["outstanding_amount"] == "0.00"
    assert body["overdue_invoices"] == 0


def test_dashboard_rejects_reversed_date_range(
    client: TestClient, staff_headers: dict
) -> None:
    response = client.get(
        f"{STAFF_API}/dashboard",
        params={"date_from": "2026-11-01", "date_to": "2026-10-01"},
        headers=staff_headers,
    )
    assert response.status_code == 422
