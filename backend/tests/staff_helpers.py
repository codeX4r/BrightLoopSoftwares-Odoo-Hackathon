"""Helpers for staff-panel tests: build subscriptions and move them through the lifecycle
using the real HTTP API, the same way the staff screens do."""

from datetime import date

import pytest
from fastapi.testclient import TestClient

from app.services import clock

STAFF_API = "/api/staff"

DEFAULT_LINES = [
    {
        "description": "Seat licence",
        "quantity": 3,
        "unit_price": "333.33",
        "tax_rate": "5",
    },
    {
        "description": "Odoo add-on",
        "quantity": 1,
        "unit_price": "99.99",
        "tax_rate": "5",
    },
]


def freeze_today(monkeypatch: pytest.MonkeyPatch, today: date) -> None:
    """Every service reads the business date through app.services.clock."""
    monkeypatch.setattr(clock, "today", lambda: today)


def create_subscription(
    client: TestClient, headers: dict[str, str], customer_id: str, **overrides
) -> dict:
    payload = {
        "customer_id": customer_id,
        "plan_name": "Monthly Basic",
        "billing_frequency": "MONTHLY",
        "payment_terms_days": 15,
        "lines": DEFAULT_LINES,
        **overrides,
    }
    response = client.post(f"{STAFF_API}/subscriptions", json=payload, headers=headers)
    assert response.status_code == 201, response.text
    return response.json()


def action(
    client: TestClient,
    headers: dict[str, str],
    subscription_id: str,
    name: str,
    payload: dict | None = None,
):
    return client.post(
        f"{STAFF_API}/subscriptions/{subscription_id}/{name}",
        json=payload if payload is not None else {},
        headers=headers,
    )


def activate_subscription(
    client: TestClient,
    headers: dict[str, str],
    customer_id: str,
    *,
    start_date: date,
    expiry_date: date | None = None,
    **overrides,
) -> dict:
    """DRAFT -> QUOTATION -> CONFIRMED -> ACTIVE in one go."""
    sub = create_subscription(client, headers, customer_id, **overrides)
    for name, payload in [
        ("send-quotation", {"valid_days": 30}),
        ("confirm", None),
        (
            "activate",
            {
                "start_date": start_date.isoformat(),
                "expiry_date": expiry_date.isoformat() if expiry_date else None,
            },
        ),
    ]:
        response = action(client, headers, sub["id"], name, payload)
        assert response.status_code == 200, (name, response.text)
    return response.json()


def run_billing(client: TestClient, headers: dict[str, str], as_of: date) -> dict:
    response = client.post(
        f"{STAFF_API}/billing/run", json={"as_of": as_of.isoformat()}, headers=headers
    )
    assert response.status_code == 200, response.text
    return response.json()


def list_invoices(client: TestClient, headers: dict[str, str], **params) -> list[dict]:
    response = client.get(f"{STAFF_API}/invoices", params=params, headers=headers)
    assert response.status_code == 200, response.text
    return response.json()["items"]


def confirm_invoice(
    client: TestClient, headers: dict[str, str], invoice_id: str
) -> dict:
    response = client.post(
        f"{STAFF_API}/invoices/{invoice_id}/confirm", headers=headers
    )
    assert response.status_code == 200, response.text
    return response.json()


def record_payment(
    client: TestClient, headers: dict[str, str], invoice_id: str, amount: str, **extra
):
    payload = {"invoice_id": invoice_id, "amount": amount, "method": "UPI", **extra}
    return client.post(f"{STAFF_API}/payments", json=payload, headers=headers)
