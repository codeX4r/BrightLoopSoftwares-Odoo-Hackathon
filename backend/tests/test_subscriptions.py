"""Quotations and subscriptions: access control, validation, lifecycle and portal scoping."""

import re
from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient

from app.models.user import User, UserRole
from tests.conftest import bearer_headers
from tests.staff_helpers import (
    STAFF_API,
    action,
    activate_subscription,
    create_subscription,
    freeze_today,
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


# --- Access control ----------------------------------------------------------


@pytest.mark.parametrize(
    ("method", "path"),
    [
        ("get", "/subscriptions"),
        ("post", "/subscriptions"),
        ("get", "/subscriptions/customer-options"),
        ("get", "/invoices"),
        ("post", "/billing/run"),
        ("get", "/payments"),
        ("post", "/payments"),
        ("get", "/dashboard"),
    ],
)
def test_customer_cannot_use_staff_api(
    client: TestClient, customer_headers: dict, method: str, path: str
) -> None:
    response = client.request(
        method.upper(), f"{STAFF_API}{path}", json={}, headers=customer_headers
    )
    assert response.status_code == 403


@pytest.mark.parametrize(
    "path", ["/subscriptions", "/invoices", "/payments", "/dashboard"]
)
def test_staff_api_requires_login(client: TestClient, path: str) -> None:
    assert client.get(f"{STAFF_API}{path}").status_code == 401


def test_admin_can_use_staff_api(client: TestClient, admin: User) -> None:
    headers = bearer_headers(client, admin.email)
    assert client.get(f"{STAFF_API}/subscriptions", headers=headers).status_code == 200


@pytest.mark.parametrize("path", ["/subscriptions", "/invoices"])
def test_staff_cannot_use_portal_api(
    client: TestClient, staff_headers: dict, path: str
) -> None:
    assert client.get(f"/api/portal{path}", headers=staff_headers).status_code == 403


# --- Creating and editing drafts --------------------------------------------


def test_create_draft_numbers_and_totals(
    client: TestClient, staff_headers: dict, customer: User
) -> None:
    first = create_subscription(client, staff_headers, str(customer.id))
    second = create_subscription(client, staff_headers, str(customer.id))

    assert first["status"] == "DRAFT"
    assert re.fullmatch(r"SUB-\d{5}", first["number"])
    assert first["number"] != second["number"]
    # 3 x 333.33 = 999.99 (+50.00 tax) and 1 x 99.99 (+5.00 tax), rounded per line.
    assert first["subtotal"] == "1099.98"
    assert first["tax_total"] == "55.00"
    assert first["total"] == "1154.98"
    assert [line["total"] for line in first["lines"]] == ["1049.99", "104.99"]


def test_subscription_customer_must_be_an_active_customer(
    client: TestClient, staff_headers: dict, staff: User, make_user
) -> None:
    inactive = make_user("gone@brightloop.com", UserRole.CUSTOMER, is_active=False)

    for customer_id in (str(staff.id), str(inactive.id)):
        response = client.post(
            f"{STAFF_API}/subscriptions",
            json={
                "customer_id": customer_id,
                "plan_name": "Plan",
                "billing_frequency": "MONTHLY",
            },
            headers=staff_headers,
        )
        assert response.status_code == 422, response.text


@pytest.mark.parametrize(
    "line",
    [
        {"description": "x", "quantity": 0, "unit_price": "1"},
        {"description": "x", "quantity": 1, "unit_price": "-1"},
        {"description": "x", "quantity": 1, "unit_price": "1", "tax_rate": "100.01"},
        {"description": "x", "quantity": 1, "unit_price": "1.001"},
        {"description": "  ", "quantity": 1, "unit_price": "1"},
    ],
)
def test_invalid_lines_are_rejected(
    client: TestClient, staff_headers: dict, customer: User, line: dict
) -> None:
    response = client.post(
        f"{STAFF_API}/subscriptions",
        json={
            "customer_id": str(customer.id),
            "plan_name": "Plan",
            "billing_frequency": "MONTHLY",
            "lines": [line],
        },
        headers=staff_headers,
    )
    assert response.status_code == 422


def test_only_drafts_can_be_edited(
    client: TestClient, staff_headers: dict, customer: User
) -> None:
    sub = create_subscription(client, staff_headers, str(customer.id))
    path = f"{STAFF_API}/subscriptions/{sub['id']}"

    edited = client.patch(path, json={"plan_name": "Renamed"}, headers=staff_headers)
    assert edited.status_code == 200
    assert edited.json()["plan_name"] == "Renamed"

    assert action(client, staff_headers, sub["id"], "send-quotation").status_code == 200
    locked = client.patch(path, json={"plan_name": "Again"}, headers=staff_headers)
    assert locked.status_code == 409


def test_quotation_needs_at_least_one_line(
    client: TestClient, staff_headers: dict, customer: User
) -> None:
    sub = create_subscription(client, staff_headers, str(customer.id), lines=[])

    response = action(client, staff_headers, sub["id"], "send-quotation")

    assert response.status_code == 409


# --- Lifecycle ---------------------------------------------------------------


def test_full_lifecycle_sets_dates_and_timestamps(
    client: TestClient, staff_headers: dict, customer: User
) -> None:
    sub = create_subscription(client, staff_headers, str(customer.id))

    quoted = action(
        client, staff_headers, sub["id"], "send-quotation", {"valid_days": 10}
    )
    assert quoted.json()["status"] == "QUOTATION"
    assert (
        quoted.json()["quotation_valid_until"]
        == (TODAY + timedelta(days=10)).isoformat()
    )

    confirmed = action(client, staff_headers, sub["id"], "confirm")
    assert confirmed.json()["status"] == "CONFIRMED"
    assert confirmed.json()["confirmed_at"] is not None

    active = action(client, staff_headers, sub["id"], "activate", {})
    body = active.json()
    assert body["status"] == "ACTIVE"
    assert body["start_date"] == TODAY.isoformat()
    # Billed in advance: the first period starts on the start date.
    assert body["next_billing_date"] == TODAY.isoformat()

    closed = action(client, staff_headers, sub["id"], "close")
    assert closed.json()["status"] == "CLOSED"
    assert closed.json()["next_billing_date"] is None
    assert closed.json()["closed_at"] is not None


def test_quotation_can_go_back_to_draft(
    client: TestClient, staff_headers: dict, customer: User
) -> None:
    sub = create_subscription(client, staff_headers, str(customer.id))
    action(client, staff_headers, sub["id"], "send-quotation")

    reverted = action(client, staff_headers, sub["id"], "revert-to-draft")

    assert reverted.json()["status"] == "DRAFT"
    assert reverted.json()["quotation_valid_until"] is None


# Every action that is NOT allowed from each status.
INVALID_TRANSITIONS = [
    ("DRAFT", "confirm"),
    ("DRAFT", "activate"),
    ("DRAFT", "revert-to-draft"),
    ("QUOTATION", "send-quotation"),
    ("QUOTATION", "activate"),
    ("CONFIRMED", "send-quotation"),
    ("CONFIRMED", "confirm"),
    ("CONFIRMED", "revert-to-draft"),
    ("ACTIVE", "send-quotation"),
    ("ACTIVE", "confirm"),
    ("ACTIVE", "activate"),
    ("ACTIVE", "revert-to-draft"),
    ("CLOSED", "send-quotation"),
    ("CLOSED", "confirm"),
    ("CLOSED", "activate"),
    ("CLOSED", "revert-to-draft"),
    ("CLOSED", "close"),
]

STEPS_TO_REACH = {
    "DRAFT": [],
    "QUOTATION": ["send-quotation"],
    "CONFIRMED": ["send-quotation", "confirm"],
    "ACTIVE": ["send-quotation", "confirm", "activate"],
    "CLOSED": ["send-quotation", "confirm", "activate", "close"],
}


@pytest.mark.parametrize(("status", "attempt"), INVALID_TRANSITIONS)
def test_invalid_transitions_are_rejected(
    client: TestClient, staff_headers: dict, customer: User, status: str, attempt: str
) -> None:
    sub = create_subscription(client, staff_headers, str(customer.id))
    for step in STEPS_TO_REACH[status]:
        assert action(client, staff_headers, sub["id"], step).status_code == 200

    response = action(client, staff_headers, sub["id"], attempt)

    assert response.status_code == 409, response.text
    current = client.get(
        f"{STAFF_API}/subscriptions/{sub['id']}", headers=staff_headers
    )
    assert current.json()["status"] == status


def test_expired_quotation_cannot_be_confirmed(
    client: TestClient,
    staff_headers: dict,
    customer: User,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    sub = create_subscription(client, staff_headers, str(customer.id))
    action(client, staff_headers, sub["id"], "send-quotation", {"valid_days": 5})

    freeze_today(monkeypatch, TODAY + timedelta(days=6))
    response = action(client, staff_headers, sub["id"], "confirm")

    assert response.status_code == 409
    assert "expired" in response.json()["detail"]


def test_expiry_before_start_is_rejected(
    client: TestClient, staff_headers: dict, customer: User
) -> None:
    sub = create_subscription(client, staff_headers, str(customer.id))
    action(client, staff_headers, sub["id"], "send-quotation")
    action(client, staff_headers, sub["id"], "confirm")

    response = action(
        client,
        staff_headers,
        sub["id"],
        "activate",
        {"start_date": "2026-11-10", "expiry_date": "2026-11-01"},
    )

    assert response.status_code == 422


def test_subscription_list_filters_and_search(
    client: TestClient, staff_headers: dict, customer: User
) -> None:
    create_subscription(
        client, staff_headers, str(customer.id), plan_name="Gold Yearly"
    )
    activate_subscription(
        client, staff_headers, str(customer.id), start_date=TODAY, plan_name="Silver"
    )

    def listed(**params):
        return client.get(
            f"{STAFF_API}/subscriptions", params=params, headers=staff_headers
        ).json()

    assert listed()["total"] == 2
    assert listed(status="ACTIVE")["total"] == 1
    assert listed(search="gold")["items"][0]["plan_name"] == "Gold Yearly"
    assert listed(page_size=1, page=2)["items"][0]["plan_name"] in {
        "Gold Yearly",
        "Silver",
    }


# --- Customer portal ---------------------------------------------------------


def test_customer_sees_only_own_non_draft_subscriptions(
    client: TestClient,
    staff_headers: dict,
    customer: User,
    customer_headers: dict,
    make_user,
) -> None:
    other = make_user("other.customer@brightloop.com", UserRole.CUSTOMER)
    draft = create_subscription(client, staff_headers, str(customer.id))
    mine = create_subscription(client, staff_headers, str(customer.id))
    action(client, staff_headers, mine["id"], "send-quotation")
    theirs = create_subscription(client, staff_headers, str(other.id))
    action(client, staff_headers, theirs["id"], "send-quotation")

    listed = client.get("/api/portal/subscriptions", headers=customer_headers).json()

    assert [s["id"] for s in listed["items"]] == [mine["id"]]
    for hidden in (draft["id"], theirs["id"]):
        response = client.get(
            f"/api/portal/subscriptions/{hidden}", headers=customer_headers
        )
        assert response.status_code == 404


def test_customer_accepts_own_quotation_only(
    client: TestClient,
    staff_headers: dict,
    customer: User,
    customer_headers: dict,
    make_user,
) -> None:
    other = make_user("other.customer@brightloop.com", UserRole.CUSTOMER)
    mine = create_subscription(client, staff_headers, str(customer.id))
    theirs = create_subscription(client, staff_headers, str(other.id))
    for sub in (mine, theirs):
        action(client, staff_headers, sub["id"], "send-quotation")

    accepted = client.post(
        f"/api/portal/subscriptions/{mine['id']}/accept", headers=customer_headers
    )
    refused = client.post(
        f"/api/portal/subscriptions/{theirs['id']}/accept", headers=customer_headers
    )

    assert accepted.status_code == 200
    assert accepted.json()["status"] == "CONFIRMED"
    assert refused.status_code == 404
    still = client.get(
        f"{STAFF_API}/subscriptions/{theirs['id']}", headers=staff_headers
    )
    assert still.json()["status"] == "QUOTATION"
