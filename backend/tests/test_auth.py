from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.models.auth_session import AuthSession
from app.models.user import User, UserRole
from tests.conftest import PASSWORD, bearer_headers, login


@pytest.mark.parametrize(
    ("fixture", "role"),
    [("admin", "ADMIN"), ("staff", "STAFF"), ("customer", "CUSTOMER")],
)
def test_each_role_can_log_in(
    client: TestClient, request: pytest.FixtureRequest, fixture: str, role: str
) -> None:
    user: User = request.getfixturevalue(fixture)

    response = login(client, user.email)

    assert response.status_code == 200
    body = response.json()
    assert body["token_type"] == "bearer"
    assert body["access_token"]
    assert body["expires_in"] > 0
    assert body["user_id"] == str(user.id)
    assert body["email"] == user.email
    assert body["role"] == role
    assert "password" not in response.text


def test_login_email_is_case_insensitive(client: TestClient, admin: User) -> None:
    assert login(client, "  ADMIN@BrightLoop.COM ").status_code == 200


def test_matching_selected_role_logs_in(client: TestClient, staff: User) -> None:
    response = client.post(
        "/api/auth/login",
        json={"email": staff.email, "password": PASSWORD, "role": "STAFF"},
    )

    assert response.status_code == 200
    assert response.json()["role"] == "STAFF"


def test_selected_role_cannot_escalate_privileges(
    client: TestClient, customer: User
) -> None:
    response = client.post(
        "/api/auth/login",
        json={"email": customer.email, "password": PASSWORD, "role": "ADMIN"},
    )

    # Same response as a wrong password, so the role of an account isn't revealed.
    assert response.status_code == 401
    assert response.json() == {"detail": "Invalid email or password"}
    assert "set-cookie" not in response.headers


def test_wrong_role_counts_toward_rate_limit(client: TestClient, admin: User) -> None:
    for _ in range(5):
        wrong_role = {"email": admin.email, "password": PASSWORD, "role": "CUSTOMER"}
        assert client.post("/api/auth/login", json=wrong_role).status_code == 401

    assert login(client, admin.email).status_code == 429


def test_invalid_role_value_is_rejected(client: TestClient, admin: User) -> None:
    response = client.post(
        "/api/auth/login",
        json={"email": admin.email, "password": PASSWORD, "role": "SUPERUSER"},
    )

    assert response.status_code == 422


def test_login_sets_httponly_cookie(client: TestClient, admin: User) -> None:
    response = login(client, admin.email)

    cookie = response.headers["set-cookie"].lower()
    assert cookie.startswith("access_token=")
    assert "httponly" in cookie
    assert "samesite=lax" in cookie
    assert "path=/" in cookie
    assert response.headers["cache-control"] == "no-store"


def test_invalid_password_is_rejected(client: TestClient, admin: User) -> None:
    response = login(client, admin.email, "WrongPassword123!")

    assert response.status_code == 401
    assert response.json() == {"detail": "Invalid email or password"}
    assert "set-cookie" not in response.headers


def test_unknown_email_gets_the_same_error_as_wrong_password(
    client: TestClient, admin: User
) -> None:
    wrong_password = login(client, admin.email, "WrongPassword123!")
    unknown_email = login(client, "nobody@brightloop.com")

    assert unknown_email.status_code == wrong_password.status_code == 401
    assert unknown_email.json() == wrong_password.json()


def test_inactive_account_cannot_log_in(client: TestClient, make_user) -> None:
    user = make_user("inactive@brightloop.com", UserRole.STAFF, is_active=False)

    response = login(client, user.email)

    assert response.status_code == 401
    assert response.json() == {"detail": "Invalid email or password"}


@pytest.mark.parametrize(
    "payload",
    [
        {"email": "not-an-email", "password": PASSWORD},
        {"email": "admin@brightloop.com", "password": ""},
        {"email": "admin@brightloop.com"},
        {"email": "admin@brightloop.com", "password": "x" * 129},
    ],
)
def test_login_validates_input(client: TestClient, payload: dict) -> None:
    assert client.post("/api/auth/login", json=payload).status_code == 422


def test_repeated_failures_are_rate_limited(client: TestClient, admin: User) -> None:
    for _ in range(5):
        assert login(client, admin.email, "WrongPassword123!").status_code == 401

    blocked = login(client, admin.email)  # Even the correct password is refused now.

    assert blocked.status_code == 429
    assert int(blocked.headers["retry-after"]) > 0


def test_successful_login_resets_email_failures(
    client: TestClient, admin: User
) -> None:
    for _ in range(4):
        login(client, admin.email, "WrongPassword123!")
    assert login(client, admin.email).status_code == 200
    for _ in range(4):
        assert login(client, admin.email, "WrongPassword123!").status_code == 401
    assert login(client, admin.email).status_code == 200


def test_me_returns_profile_without_password_hash(
    client: TestClient, staff: User
) -> None:
    response = client.get("/api/auth/me", headers=bearer_headers(client, staff.email))

    assert response.status_code == 200
    body = response.json()
    assert body["id"] == str(staff.id)
    assert body["email"] == staff.email
    assert body["role"] == "STAFF"
    assert body["is_active"] is True
    assert "password_hash" not in body
    assert "argon2" not in response.text


def test_me_works_with_cookie(client: TestClient, customer: User) -> None:
    login(client, customer.email)  # TestClient keeps the cookie.

    response = client.get("/api/auth/me")

    assert response.status_code == 200
    assert response.json()["role"] == "CUSTOMER"


@pytest.mark.parametrize(
    ("method", "path"),
    [
        ("get", "/api/auth/me"),
        ("get", "/api/users/staff"),
        ("post", "/api/users/staff"),
        ("patch", "/api/users/00000000-0000-0000-0000-000000000000/status"),
        ("get", "/api/users/00000000-0000-0000-0000-000000000000"),
    ],
)
def test_unauthenticated_requests_are_rejected(
    client: TestClient, method: str, path: str
) -> None:
    response = getattr(client, method)(path)

    assert response.status_code == 401
    assert response.headers["www-authenticate"] == "Bearer"


@pytest.mark.parametrize("token", ["garbage", "a.b.c", ""])
def test_malformed_tokens_are_rejected(client: TestClient, token: str) -> None:
    response = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 401


def test_unknown_session_token_is_rejected(client: TestClient) -> None:
    response = client.get(
        "/api/auth/me", headers={"Authorization": "Bearer not-a-real-session-token"}
    )

    assert response.status_code == 401


def test_expired_session_is_rejected(
    client: TestClient, db: Session, admin: User
) -> None:
    headers = bearer_headers(client, admin.email)
    past = datetime.now(UTC) - timedelta(seconds=1)
    db.execute(update(AuthSession).values(expires_at=past))
    db.commit()

    response = client.get("/api/auth/me", headers=headers)

    assert response.status_code == 401


def test_logout_deletes_session_and_clears_cookie(
    client: TestClient, db: Session, admin: User
) -> None:
    headers = bearer_headers(client, admin.email)

    response = client.post("/api/auth/logout", headers=headers)

    assert response.status_code == 204
    assert 'access_token=""' in response.headers["set-cookie"]
    assert db.scalar(select(func.count()).select_from(AuthSession)) == 0
    assert client.get("/api/auth/me", headers=headers).status_code == 401


def test_logout_without_token_still_succeeds(client: TestClient) -> None:
    assert client.post("/api/auth/logout").status_code == 204


def test_cookie_auth_writes_require_csrf_header(
    client: TestClient, admin: User
) -> None:
    login(client, admin.email)
    payload = {"email": "new.staff@brightloop.com", "password": PASSWORD}

    without_header = client.post("/api/users/staff", json=payload)
    with_header = client.post(
        "/api/users/staff", json=payload, headers={"X-Requested-With": "fetch"}
    )

    assert without_header.status_code == 403
    assert with_header.status_code == 201


def test_deactivated_user_token_stops_working(
    client: TestClient, admin: User, staff: User
) -> None:
    staff_headers = bearer_headers(client, staff.email)
    admin_headers = bearer_headers(client, admin.email)
    assert client.get("/api/auth/me", headers=staff_headers).status_code == 200

    client.patch(
        f"/api/users/{staff.id}/status",
        json={"is_active": False},
        headers=admin_headers,
    )

    assert client.get("/api/auth/me", headers=staff_headers).status_code == 401


def test_no_public_registration_endpoint_exists(client: TestClient) -> None:
    paths = client.get("/openapi.json").json()["paths"]
    for path in paths:
        assert not any(
            word in path.lower() for word in ("register", "signup", "sign-up")
        )
    # The only account-creating endpoint is the admin-only staff endpoint.
    creating = [
        p for p, ops in paths.items() if "post" in ops and p.startswith("/api/users")
    ]
    assert creating == ["/api/users/staff"]

    for path in (
        "/api/auth/register",
        "/api/auth/signup",
        "/api/users",
        "/api/register",
    ):
        response = client.post(
            path, json={"email": "x@brightloop.com", "password": PASSWORD}
        )
        assert response.status_code in (404, 405), path


def test_passwords_are_stored_as_argon2_hashes(db: Session, admin: User) -> None:
    stored = db.scalar(select(User.password_hash).where(User.id == admin.id))

    assert stored != PASSWORD
    assert PASSWORD not in stored
    assert stored.startswith("$argon2id$")
