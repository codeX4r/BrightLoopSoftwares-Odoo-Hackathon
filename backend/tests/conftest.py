"""Test fixtures.

Tests run against in-memory SQLite by default. To run them against Postgres instead, point
TEST_DATABASE_URL at a disposable database (its tables are dropped after each test):
    TEST_DATABASE_URL=postgresql+psycopg://localhost/brightloop_test uv run pytest
"""

import os

# Configure settings before any app module is imported, so the app never connects to the
# real DATABASE_URL from .env.
TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL", "sqlite+pysqlite:///:memory:")
os.environ["DATABASE_URL"] = TEST_DATABASE_URL
os.environ["ENVIRONMENT"] = "test"
os.environ["AUTH_COOKIE_SECURE"] = "false"  # TestClient talks plain HTTP.

from collections.abc import Callable, Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.rate_limit import get_login_rate_limiter
from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app.models.user import User, UserRole
from app.services import user_service

PASSWORD = "CorrectHorse123!"

if TEST_DATABASE_URL.startswith("sqlite"):
    engine = create_engine(
        TEST_DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
else:
    # Tables and enum types are recreated for every test, so a statement psycopg prepared
    # server-side would point at stale types ("cached plan must not change result type").
    engine = create_engine(TEST_DATABASE_URL, connect_args={"prepare_threshold": None})

TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


@pytest.fixture
def db() -> Generator[Session]:
    Base.metadata.create_all(engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(engine)


@pytest.fixture
def client(db: Session) -> Generator[TestClient]:
    def override_get_db() -> Generator[Session]:
        session = TestingSessionLocal()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_db] = override_get_db
    get_login_rate_limiter().clear()
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
    get_login_rate_limiter().clear()


@pytest.fixture
def make_user(db: Session) -> Callable[..., User]:
    def factory(
        email: str, role: UserRole, *, password: str = PASSWORD, is_active: bool = True
    ) -> User:
        user = user_service.create_user(db, email=email, password=password, role=role)
        if not is_active:
            user = user_service.set_user_active(db, user, is_active=False)
        return user

    return factory


@pytest.fixture
def admin(make_user: Callable[..., User]) -> User:
    return make_user("admin@brightloop.com", UserRole.ADMIN)


@pytest.fixture
def staff(make_user: Callable[..., User]) -> User:
    return make_user("staff@brightloop.com", UserRole.STAFF)


@pytest.fixture
def customer(make_user: Callable[..., User]) -> User:
    return make_user("customer@brightloop.com", UserRole.CUSTOMER)


def login(client: TestClient, email: str, password: str = PASSWORD):
    return client.post("/api/auth/login", json={"email": email, "password": password})


def bearer_headers(
    client: TestClient, email: str, password: str = PASSWORD
) -> dict[str, str]:
    response = login(client, email, password)
    assert response.status_code == 200, response.text
    # Drop the cookie so each test exercises exactly one credential.
    client.cookies.clear()
    return {"Authorization": f"Bearer {response.json()['access_token']}"}
