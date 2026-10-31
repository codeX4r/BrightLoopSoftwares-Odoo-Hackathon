"""Customer portal API: own records only, accept/reject, invoice filters, profile."""

from collections.abc import Callable
from datetime import date

import pytest
from fastapi.testclient import TestClient

from app.models.user import User, UserRole
from app.services import clock
from tests.conftest import bearer_headers
from tests.staff_helpers import (
    action,
    activate,
    create_quotation,
    invoices_for,
    run_billing,
)


@pytest.fixture(autouse=True)
def fixed_today(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(clock, "today", lambda: date(2026, 10, 31))


@pytest.fixture
def other_customer(make_user: Callable[..., User]) -> User:
    return make_user("other@brightloop.com", UserRole.CUSTOMER)


def test_staff_cannot_use_portal(client: TestClient, staff: User) -> None:
    headers = bearer_headers(client, staff.email)
    assert client.get("/api/portal/invoices", headers=headers).status_code == 403
    assert client.get("/api/portal/profile", headers=headers).status_code == 403


def test_accept_and_reject_quotations(
    client: TestClient, staff: User, customer: User, other_customer: User
) -> None:
    staff_h = bearer_headers(client, staff.email)
    mine = bearer_headers(client, customer.email)
    theirs = bearer_headers(client, other_customer.email)

    draft = create_quotation(client, staff_h, str(customer.id))
    # Drafts are invisible to the customer.
    assert (
        client.get(f"/api/portal/subscriptions/{draft['id']}", headers=mine).status_code
        == 404
    )
    action(client, staff_h, draft["id"], "send-quotation")

    # Another customer can't see, accept or reject it.
    for method, path in (
        ("get", f"/api/portal/subscriptions/{draft['id']}"),
        ("post", f"/api/portal/subscriptions/{draft['id']}/accept"),
        ("post", f"/api/portal/subscriptions/{draft['id']}/reject"),
    ):
        kwargs = {"json": {}} if method == "post" else {}
        assert (
            getattr(client, method)(path, headers=theirs, **kwargs).status_code == 404
        )

    accepted = client.post(
        f"/api/portal/subscriptions/{draft['id']}/accept", headers=mine
    )
    assert accepted.json()["status"] == "CONFIRMED"
    assert (
        client.post(
            f"/api/portal/subscriptions/{draft['id']}/reject", headers=mine, json={}
        ).status_code
        == 409
    )

    second = create_quotation(client, staff_h, str(customer.id))
    action(client, staff_h, second["id"], "send-quotation")
    rejected = client.post(
        f"/api/portal/subscriptions/{second['id']}/reject",
        headers=mine,
        json={"reason": "  Too expensive this quarter  "},
    ).json()
    assert rejected["status"] == "CLOSED"
    assert rejected["rejected_at"] is not None
    assert rejected["rejection_reason"] == "Too expensive this quarter"

    # Staff see the rejection and it appears in recent activity.
    staff_view = client.get(
        f"/api/staff/subscriptions/{second['id']}", headers=staff_h
    ).json()
    assert staff_view["rejection_reason"] == "Too expensive this quarter"
    activity = client.get("/api/staff/dashboard", headers=staff_h).json()[
        "recent_activity"
    ]
    assert any(item["kind"] == "quotation_rejected" for item in activity)

    too_long = client.post(
        f"/api/portal/subscriptions/{second['id']}/reject",
        headers=mine,
        json={"reason": "x" * 501},
    )
    assert too_long.status_code == 422


def test_invoice_filters_and_isolation(
    client: TestClient, staff: User, customer: User, other_customer: User
) -> None:
    staff_h = bearer_headers(client, staff.email)
    mine = bearer_headers(client, customer.email)
    sub = create_quotation(client, staff_h, str(customer.id))
    activate(client, staff_h, sub["id"], "2026-08-31")
    run_billing(client, staff_h)
    paid, unpaid, draft = invoices_for(client, staff_h, sub["id"])
    for invoice in (paid, unpaid):
        client.post(f"/api/staff/invoices/{invoice['id']}/confirm", headers=staff_h)
    client.post(
        "/api/staff/payments",
        headers=staff_h,
        json={"invoice_id": paid["id"], "amount": paid["total"], "method": "UPI"},
    )

    def numbers(query: str = "") -> list[str]:
        response = client.get(f"/api/portal/invoices{query}", headers=mine)
        assert response.status_code == 200, response.text
        return sorted(i["number"] for i in response.json()["items"])

    assert numbers() == sorted([paid["number"], unpaid["number"]])  # draft hidden
    assert numbers("?status=PAID") == [paid["number"]]
    assert numbers("?status=CONFIRMED") == [unpaid["number"]]
    assert numbers("?overdue=true") == [unpaid["number"]]
    assert numbers("?status=CANCELLED") == []
    assert (
        client.get("/api/portal/invoices?status=DRAFT", headers=mine).status_code == 422
    )

    theirs = bearer_headers(client, other_customer.email)
    assert client.get("/api/portal/invoices", headers=theirs).json()["total"] == 0
    assert (
        client.get(f"/api/portal/invoices/{paid['id']}", headers=theirs).status_code
        == 404
    )
    assert (
        client.get(f"/api/portal/invoices/{draft['id']}", headers=mine).status_code
        == 404
    )


def test_profile_read_update_and_visible_to_staff(
    client: TestClient, staff: User, customer: User
) -> None:
    mine = bearer_headers(client, customer.email)
    empty = client.get("/api/portal/profile", headers=mine).json()
    assert empty == {
        "email": customer.email,
        "full_name": None,
        "company_name": None,
        "phone": None,
        "address": None,
        "updated_at": None,
    }

    saved = client.patch(
        "/api/portal/profile",
        headers=mine,
        json={
            "full_name": " Priya Verma ",
            "company_name": "Nimbus Retail",
            "phone": "+91 98100 22222",
        },
    ).json()
    assert saved["full_name"] == "Priya Verma"
    assert saved["updated_at"] is not None

    partial = client.patch(
        "/api/portal/profile", headers=mine, json={"address": "Hazratganj, Lucknow"}
    ).json()
    assert partial["full_name"] == "Priya Verma"  # unchanged
    assert partial["address"] == "Hazratganj, Lucknow"

    cleared = client.patch(
        "/api/portal/profile", headers=mine, json={"company_name": ""}
    ).json()
    assert cleared["company_name"] is None

    for bad in (
        {"email": "new@example.com"},
        {"phone": "abc"},
        {"full_name": "x" * 201},
    ):
        assert (
            client.patch("/api/portal/profile", headers=mine, json=bad).status_code
            == 422
        )

    staff_h = bearer_headers(client, staff.email)
    detail = client.get(f"/api/staff/customers/{customer.id}", headers=staff_h).json()
    assert detail["full_name"] == "Priya Verma"
    assert detail["address"] == "Hazratganj, Lucknow"
