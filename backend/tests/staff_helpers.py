"""Helpers shared by the staff-panel and customer-portal tests."""

from fastapi.testclient import TestClient

LINES = [
    {
        "description": "Enterprise Plan",
        "quantity": 10,
        "unit_price": "5000",
        "tax_rate": "18",
    },
    {"description": "Add-on", "quantity": 2, "unit_price": "500.00", "tax_rate": "18"},
]


def create_quotation(
    client: TestClient,
    headers: dict[str, str],
    customer_id: str,
    *,
    frequency: str = "MONTHLY",
    terms: int = 15,
    lines: list[dict] | None = None,
) -> dict:
    response = client.post(
        "/api/staff/subscriptions",
        headers=headers,
        json={
            "customer_id": customer_id,
            "plan_name": "Enterprise Plan",
            "billing_frequency": frequency,
            "payment_terms_days": terms,
            "lines": LINES if lines is None else lines,
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def action(
    client: TestClient, headers: dict[str, str], sub_id: str, name: str, body=None
):
    return client.post(
        f"/api/staff/subscriptions/{sub_id}/{name}", headers=headers, json=body or {}
    )


def activate(
    client: TestClient, headers: dict[str, str], sub_id: str, start: str, expiry=None
) -> dict:
    assert action(client, headers, sub_id, "send-quotation").status_code == 200
    assert action(client, headers, sub_id, "confirm").status_code == 200
    response = action(
        client,
        headers,
        sub_id,
        "activate",
        {"start_date": start, "expiry_date": expiry},
    )
    assert response.status_code == 200, response.text
    return response.json()


def run_billing(client: TestClient, headers: dict[str, str]) -> dict:
    response = client.post("/api/staff/billing/run", headers=headers, json={})
    assert response.status_code == 200, response.text
    return response.json()


def invoices_for(
    client: TestClient, headers: dict[str, str], sub_id: str
) -> list[dict]:
    response = client.get(
        f"/api/staff/invoices?subscription_id={sub_id}&page_size=100", headers=headers
    )
    assert response.status_code == 200, response.text
    return sorted(response.json()["items"], key=lambda i: i["period_start"])
