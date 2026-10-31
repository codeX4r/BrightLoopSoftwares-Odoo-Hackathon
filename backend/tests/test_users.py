import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.user import User, UserRole
from app.services import user_service
from tests.conftest import PASSWORD, bearer_headers, login

NEW_STAFF = {"email": "New.Staff@Brightloop.com", "password": "InitialPassword123!"}


def test_admin_can_create_staff(client: TestClient, db: Session, admin: User) -> None:
    response = client.post(
        "/api/users/staff", json=NEW_STAFF, headers=bearer_headers(client, admin.email)
    )

    assert response.status_code == 201
    body = response.json()
    assert body["email"] == "new.staff@brightloop.com"
    assert body["role"] == "STAFF"
    assert body["is_active"] is True
    assert "password" not in response.text

    stored = user_service.get_user_by_email(db, NEW_STAFF["email"])
    assert stored is not None
    assert stored.password_hash.startswith("$argon2id$")
    # The new staff member can sign in with the initial password.
    assert (
        login(client, NEW_STAFF["email"], NEW_STAFF["password"]).json()["role"]
        == "STAFF"
    )


def test_role_cannot_be_chosen_when_creating_staff(
    client: TestClient, admin: User
) -> None:
    response = client.post(
        "/api/users/staff",
        json={**NEW_STAFF, "role": "ADMIN"},
        headers=bearer_headers(client, admin.email),
    )

    assert response.status_code == 422


def test_duplicate_staff_email_is_rejected(
    client: TestClient, admin: User, staff: User
) -> None:
    response = client.post(
        "/api/users/staff",
        json={"email": staff.email.upper(), "password": PASSWORD},
        headers=bearer_headers(client, admin.email),
    )

    assert response.status_code == 409


@pytest.mark.parametrize(
    "payload",
    [
        {"email": "bad", "password": PASSWORD},
        {"email": "ok@brightloop.com", "password": "short"},
        {"email": "ok@brightloop.com", "password": " " * 12},
        {"email": "ok@brightloop.com"},
    ],
)
def test_staff_creation_validates_input(
    client: TestClient, admin: User, payload: dict
) -> None:
    response = client.post(
        "/api/users/staff", json=payload, headers=bearer_headers(client, admin.email)
    )

    assert response.status_code == 422


def test_staff_cannot_create_staff(client: TestClient, staff: User) -> None:
    response = client.post(
        "/api/users/staff", json=NEW_STAFF, headers=bearer_headers(client, staff.email)
    )

    assert response.status_code == 403


@pytest.mark.parametrize("fixture", ["staff", "customer"])
@pytest.mark.parametrize(
    ("method", "path", "json"),
    [
        ("post", "/api/users/staff", NEW_STAFF),
        ("get", "/api/users/staff", None),
        ("patch", "/api/users/{admin_id}/status", {"is_active": False}),
    ],
)
def test_non_admins_cannot_use_admin_apis(
    client: TestClient,
    request: pytest.FixtureRequest,
    admin: User,
    fixture: str,
    method: str,
    path: str,
    json: dict | None,
) -> None:
    user: User = request.getfixturevalue(fixture)
    headers = bearer_headers(client, user.email)

    response = client.request(
        method.upper(), path.format(admin_id=admin.id), json=json, headers=headers
    )

    assert response.status_code == 403


def test_admin_can_list_staff_only(
    client: TestClient, admin: User, staff: User, customer: User
) -> None:
    response = client.get(
        "/api/users/staff", headers=bearer_headers(client, admin.email)
    )

    assert response.status_code == 200
    body = response.json()
    assert [u["email"] for u in body] == [staff.email]
    assert all("password_hash" not in u for u in body)


def test_admin_can_deactivate_and_reactivate(
    client: TestClient, admin: User, staff: User
) -> None:
    headers = bearer_headers(client, admin.email)

    off = client.patch(
        f"/api/users/{staff.id}/status", json={"is_active": False}, headers=headers
    )
    assert off.status_code == 200
    assert off.json()["is_active"] is False
    assert login(client, staff.email).status_code == 401

    on = client.patch(
        f"/api/users/{staff.id}/status", json={"is_active": True}, headers=headers
    )
    assert on.status_code == 200
    assert on.json()["is_active"] is True
    assert login(client, staff.email).status_code == 200


def test_admin_cannot_deactivate_self(client: TestClient, admin: User) -> None:
    response = client.patch(
        f"/api/users/{admin.id}/status",
        json={"is_active": False},
        headers=bearer_headers(client, admin.email),
    )

    assert response.status_code == 400


def test_status_update_for_unknown_user_returns_404(
    client: TestClient, admin: User
) -> None:
    response = client.patch(
        f"/api/users/{uuid.uuid4()}/status",
        json={"is_active": False},
        headers=bearer_headers(client, admin.email),
    )

    assert response.status_code == 404


def test_customer_can_read_own_profile(client: TestClient, customer: User) -> None:
    response = client.get(
        f"/api/users/{customer.id}", headers=bearer_headers(client, customer.email)
    )

    assert response.status_code == 200
    assert response.json()["id"] == str(customer.id)


def test_customer_cannot_read_another_customers_data(
    client: TestClient, customer: User, make_user
) -> None:
    other = make_user("other.customer@brightloop.com", UserRole.CUSTOMER)
    headers = bearer_headers(client, customer.email)

    response = client.get(f"/api/users/{other.id}", headers=headers)
    missing = client.get(f"/api/users/{uuid.uuid4()}", headers=headers)

    # Same response as a missing user, so other accounts can't be discovered.
    assert response.status_code == missing.status_code == 404
    assert response.json() == missing.json()
    assert other.email not in response.text


def test_customer_cannot_read_staff_or_admin(
    client: TestClient, customer: User, staff: User, admin: User
) -> None:
    headers = bearer_headers(client, customer.email)

    assert client.get(f"/api/users/{staff.id}", headers=headers).status_code == 404
    assert client.get(f"/api/users/{admin.id}", headers=headers).status_code == 404


def test_staff_can_read_customers_but_not_admins(
    client: TestClient, staff: User, customer: User, admin: User
) -> None:
    headers = bearer_headers(client, staff.email)

    assert client.get(f"/api/users/{customer.id}", headers=headers).status_code == 200
    assert client.get(f"/api/users/{admin.id}", headers=headers).status_code == 404


def test_admin_can_read_any_user(
    client: TestClient, admin: User, customer: User
) -> None:
    response = client.get(
        f"/api/users/{customer.id}", headers=bearer_headers(client, admin.email)
    )

    assert response.status_code == 200
