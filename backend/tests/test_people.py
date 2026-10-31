"""Admin customer and staff management, with figures from subscriptions and billing."""

from datetime import date

import pytest
from fastapi.testclient import TestClient

from app.models.user import User, UserRole
from tests.conftest import PASSWORD, bearer_headers, login
from tests.staff_helpers import (
    activate_subscription,
    confirm_invoice,
    create_subscription,
    freeze_today,
    list_invoices,
    record_payment,
    run_billing,
)

TODAY = date(2026, 10, 31)


@pytest.fixture(autouse=True)
def fixed_today(monkeypatch: pytest.MonkeyPatch) -> None:
    freeze_today(monkeypatch, TODAY)


@pytest.fixture
def admin_headers(client: TestClient, admin: User) -> dict[str, str]:
    return bearer_headers(client, admin.email)


@pytest.fixture
def staff_headers(client: TestClient, staff: User) -> dict[str, str]:
    return bearer_headers(client, staff.email)


# --- Access control ----------------------------------------------------------


@pytest.mark.parametrize("fixture", ["staff", "customer"])
@pytest.mark.parametrize(
    ("method", "path"),
    [
        ("get", "/api/admin/customers"),
        ("post", "/api/admin/customers"),
        ("get", "/api/admin/customers/00000000-0000-0000-0000-000000000000"),
        ("get", "/api/admin/staff"),
        ("get", "/api/admin/staff/00000000-0000-0000-0000-000000000000"),
    ],
)
def test_only_admin_can_manage_people(
    client: TestClient,
    request: pytest.FixtureRequest,
    fixture: str,
    method: str,
    path: str,
) -> None:
    user: User = request.getfixturevalue(fixture)
    response = client.request(
        method.upper(),
        path,
        json={"email": "x@brightloop.com", "password": PASSWORD},
        headers=bearer_headers(client, user.email),
    )
    assert response.status_code == 403


def test_people_apis_require_login(client: TestClient) -> None:
    assert client.get("/api/admin/customers").status_code == 401
    assert client.get("/api/admin/staff").status_code == 401


# --- Customers ---------------------------------------------------------------


def test_admin_creates_customer_who_can_log_in(
    client: TestClient, admin_headers: dict
) -> None:
    response = client.post(
        "/api/admin/customers",
        json={"email": "New.Client@Brightloop.com", "password": PASSWORD},
        headers=admin_headers,
    )

    assert response.status_code == 201, response.text
    body = response.json()
    assert body["email"] == "new.client@brightloop.com"
    assert body["role"] == "CUSTOMER"
    assert body["figures"]["subscriptions_total"] == 0
    assert "password" not in response.text
    assert login(client, "new.client@brightloop.com").json()["role"] == "CUSTOMER"


def test_customer_creation_validates_and_rejects_duplicates(
    client: TestClient, admin_headers: dict, customer: User
) -> None:
    duplicate = client.post(
        "/api/admin/customers",
        json={"email": customer.email.upper(), "password": PASSWORD},
        headers=admin_headers,
    )
    short = client.post(
        "/api/admin/customers",
        json={"email": "ok@brightloop.com", "password": "short"},
        headers=admin_headers,
    )
    role_field = client.post(
        "/api/admin/customers",
        json={"email": "ok@brightloop.com", "password": PASSWORD, "role": "ADMIN"},
        headers=admin_headers,
    )

    assert duplicate.status_code == 409
    assert short.status_code == 422
    assert role_field.status_code == 422


def test_customer_list_search_filter_and_pagination(
    client: TestClient, admin_headers: dict, customer: User, staff: User, make_user
) -> None:
    make_user("alpha.client@brightloop.com", UserRole.CUSTOMER)
    make_user("beta.client@brightloop.com", UserRole.CUSTOMER, is_active=False)

    def listed(**params) -> dict:
        response = client.get(
            "/api/admin/customers", params=params, headers=admin_headers
        )
        assert response.status_code == 200, response.text
        return response.json()

    everyone = listed()
    assert everyone["total"] == 3  # staff and admin are not customers
    assert {c["role"] for c in everyone["items"]} == {"CUSTOMER"}
    assert [c["email"] for c in listed(q="alpha")["items"]] == [
        "alpha.client@brightloop.com"
    ]
    assert listed(is_active="false")["total"] == 1
    page = listed(limit=2, offset=2)
    assert (len(page["items"]), page["total"]) == (1, 3)


def test_customer_figures_match_billing_data(
    client: TestClient,
    admin_headers: dict,
    staff_headers: dict,
    customer: User,
    make_user,
) -> None:
    other = make_user("other.customer@brightloop.com", UserRole.CUSTOMER)
    create_subscription(client, staff_headers, str(customer.id))  # draft
    activate_subscription(client, staff_headers, str(customer.id), start_date=TODAY)
    activate_subscription(client, staff_headers, str(other.id), start_date=TODAY)
    run_billing(client, staff_headers, TODAY)
    mine = list_invoices(client, staff_headers, customer_id=str(customer.id))[0]
    confirm_invoice(client, staff_headers, mine["id"])
    record_payment(client, staff_headers, mine["id"], "154.98")

    detail = client.get(f"/api/admin/customers/{customer.id}", headers=admin_headers)

    assert detail.status_code == 200, detail.text
    figures = detail.json()["figures"]
    assert figures == {
        "subscriptions_total": 2,
        "active_subscriptions": 1,
        "invoices_total": 1,
        "invoiced_amount": "1154.98",
        "paid_amount": "154.98",
        "outstanding_amount": "1000.00",
        "overdue_invoices": 0,
    }
    payments = detail.json()["recent_payments"]
    assert [(p["amount"], p["invoice_number"]) for p in payments] == [
        ("154.98", mine["number"])
    ]

    # The other customer's draft invoice isn't billed yet, so it counts as nothing.
    theirs = client.get(
        f"/api/admin/customers/{other.id}", headers=admin_headers
    ).json()
    assert theirs["figures"]["invoices_total"] == 0
    assert theirs["figures"]["invoiced_amount"] == "0.00"
    assert theirs["recent_payments"] == []


def test_overdue_and_list_figures(
    client: TestClient,
    admin_headers: dict,
    staff_headers: dict,
    customer: User,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    activate_subscription(client, staff_headers, str(customer.id), start_date=TODAY)
    run_billing(client, staff_headers, TODAY)
    confirm_invoice(
        client, staff_headers, list_invoices(client, staff_headers)[0]["id"]
    )
    freeze_today(monkeypatch, date(2026, 11, 20))  # due 2026-11-15

    row = client.get("/api/admin/customers", headers=admin_headers).json()["items"][0]

    assert row["figures"]["overdue_invoices"] == 1
    assert row["figures"]["outstanding_amount"] == "1154.98"


def test_customer_detail_rejects_other_roles_and_unknown_ids(
    client: TestClient, admin_headers: dict, staff: User
) -> None:
    assert (
        client.get(
            f"/api/admin/customers/{staff.id}", headers=admin_headers
        ).status_code
        == 404
    )
    unknown = "00000000-0000-0000-0000-000000000000"
    assert (
        client.get(f"/api/admin/customers/{unknown}", headers=admin_headers).status_code
        == 404
    )


def test_admin_deactivates_customer_with_existing_endpoint(
    client: TestClient, admin_headers: dict, customer: User
) -> None:
    response = client.patch(
        f"/api/users/{customer.id}/status",
        json={"is_active": False},
        headers=admin_headers,
    )

    assert response.status_code == 200
    assert login(client, customer.email).status_code == 401
    listed = client.get("/api/admin/customers?is_active=false", headers=admin_headers)
    assert listed.json()["items"][0]["id"] == str(customer.id)


# --- Staff -------------------------------------------------------------------


def test_staff_list_and_figures(
    client: TestClient,
    admin_headers: dict,
    staff_headers: dict,
    staff: User,
    customer: User,
    make_user,
) -> None:
    make_user("second.staff@brightloop.com", UserRole.STAFF, is_active=False)
    activate_subscription(client, staff_headers, str(customer.id), start_date=TODAY)
    run_billing(client, staff_headers, TODAY)
    invoice = list_invoices(client, staff_headers)[0]
    confirm_invoice(client, staff_headers, invoice["id"])
    record_payment(client, staff_headers, invoice["id"], "200.00")

    listed = client.get("/api/admin/staff", headers=admin_headers).json()
    detail = client.get(f"/api/admin/staff/{staff.id}", headers=admin_headers).json()

    assert listed["total"] == 2
    assert {s["role"] for s in listed["items"]} == {"STAFF"}
    assert detail["figures"] == {
        "subscriptions_created": 1,
        "payments_recorded": 1,
        "payments_amount": "200.00",
    }
    assert [p["amount"] for p in detail["recent_payments"]] == ["200.00"]
    inactive = client.get(
        "/api/admin/staff?is_active=false", headers=admin_headers
    ).json()
    assert [s["email"] for s in inactive["items"]] == ["second.staff@brightloop.com"]


def test_new_staff_from_existing_endpoint_appears_in_admin_list(
    client: TestClient, admin_headers: dict
) -> None:
    created = client.post(
        "/api/users/staff",
        json={"email": "fresh.staff@brightloop.com", "password": PASSWORD},
        headers=admin_headers,
    )
    assert created.status_code == 201

    found = client.get("/api/admin/staff?q=fresh", headers=admin_headers).json()

    assert [s["email"] for s in found["items"]] == ["fresh.staff@brightloop.com"]
    assert found["items"][0]["figures"]["subscriptions_created"] == 0


def test_staff_detail_rejects_customers(
    client: TestClient, admin_headers: dict, customer: User
) -> None:
    assert (
        client.get(f"/api/admin/staff/{customer.id}", headers=admin_headers).status_code
        == 404
    )


def test_admin_can_read_customer_history_from_staff_api(
    client: TestClient, admin_headers: dict, staff_headers: dict, customer: User
) -> None:
    activate_subscription(client, staff_headers, str(customer.id), start_date=TODAY)

    subs = client.get(
        "/api/staff/subscriptions",
        params={"customer_id": str(customer.id)},
        headers=admin_headers,
    )

    assert subs.status_code == 200
    assert subs.json()["total"] == 1
