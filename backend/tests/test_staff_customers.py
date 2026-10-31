"""Staff customer management and customer names on staff screens."""

from fastapi.testclient import TestClient

from app.models.user import User
from tests.conftest import bearer_headers, login
from tests.staff_helpers import create_quotation

NEW_CUSTOMER = {
    "email": "Ops@AbcTech.example.com",
    "password": "Welcome@123",
    "full_name": "Aarav Sharma",
    "company_name": "ABC Technologies",
    "phone": "+91 98100 11111",
    "address": "Sector 62, Noida",
}


def test_staff_creates_customer_who_can_then_sign_in(
    client: TestClient, staff: User
) -> None:
    headers = bearer_headers(client, staff.email)
    response = client.post("/api/staff/customers", headers=headers, json=NEW_CUSTOMER)
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["email"] == "ops@abctech.example.com"
    assert body["full_name"] == "Aarav Sharma"
    assert body["company_name"] == "ABC Technologies"
    assert body["active_subscriptions"] == 0
    assert "password" not in response.text

    signed_in = login(client, NEW_CUSTOMER["email"], NEW_CUSTOMER["password"])
    assert signed_in.json()["role"] == "CUSTOMER"


def test_create_customer_validation(
    client: TestClient, staff: User, customer: User
) -> None:
    headers = bearer_headers(client, staff.email)
    weak = client.post(
        "/api/staff/customers",
        headers=headers,
        json={**NEW_CUSTOMER, "password": "short"},
    )
    assert weak.status_code == 422
    no_name = client.post(
        "/api/staff/customers", headers=headers, json={**NEW_CUSTOMER, "full_name": " "}
    )
    assert no_name.status_code == 422
    role = client.post(
        "/api/staff/customers", headers=headers, json={**NEW_CUSTOMER, "role": "ADMIN"}
    )
    assert role.status_code == 422
    taken = client.post(
        "/api/staff/customers",
        headers=headers,
        json={**NEW_CUSTOMER, "email": customer.email.upper()},
    )
    assert taken.status_code == 409


def test_search_edit_and_totals(
    client: TestClient, staff: User, customer: User
) -> None:
    headers = bearer_headers(client, staff.email)
    created = client.post(
        "/api/staff/customers", headers=headers, json=NEW_CUSTOMER
    ).json()

    for term in ("aarav", "ABC tech", "98100", "abctech"):
        found = client.get(
            f"/api/staff/customers?search={term}", headers=headers
        ).json()
        assert [c["id"] for c in found["items"]] == [created["id"]], term

    edited = client.patch(
        f"/api/staff/customers/{created['id']}",
        headers=headers,
        json={"company_name": "ABC Tech Pvt Ltd", "phone": ""},
    ).json()
    assert edited["company_name"] == "ABC Tech Pvt Ltd"
    assert edited["phone"] is None
    assert edited["full_name"] == "Aarav Sharma"  # untouched

    bad_phone = client.patch(
        f"/api/staff/customers/{created['id']}",
        headers=headers,
        json={"phone": "call me"},
    )
    assert bad_phone.status_code == 422

    # Staff-only accounts are not customers.
    assert (
        client.get(f"/api/staff/customers/{staff.id}", headers=headers).status_code
        == 404
    )

    # Names show on quotations, and quotation search finds the company.
    create_quotation(client, headers, created["id"])
    subs = client.get(
        "/api/staff/subscriptions?search=ABC Tech", headers=headers
    ).json()
    assert subs["total"] == 1
    assert subs["items"][0]["customer"]["full_name"] == "Aarav Sharma"
    assert subs["items"][0]["customer"]["company_name"] == "ABC Tech Pvt Ltd"

    options = client.get(
        "/api/staff/subscriptions/customer-options?search=aarav", headers=headers
    ).json()
    assert [o["id"] for o in options] == [created["id"]]

    # A customer without a profile still lists, with empty name fields.
    everyone = client.get("/api/staff/customers", headers=headers).json()
    plain = next(c for c in everyone["items"] if c["id"] == str(customer.id))
    assert plain["full_name"] is None
