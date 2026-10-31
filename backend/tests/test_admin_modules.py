"""Taxes, discounts, settings, reports, profiles, staff editing and password reset."""

import threading
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core import email as email_module
from app.core.email import OutgoingEmail, get_email_sender
from app.core.rate_limit import get_password_reset_rate_limiter
from app.main import app
from app.models.discount import Discount
from app.models.password_reset import PasswordResetToken
from app.models.settings import AppSettings
from app.models.tax import Tax
from app.models.user import User, UserRole
from app.services import clock, discount_service
from app.services.errors import ConflictError
from tests.conftest import (
    PASSWORD,
    TEST_DATABASE_URL,
    TestingSessionLocal,
    bearer_headers,
    login,
)
from tests.staff_helpers import (
    activate_subscription,
    confirm_invoice,
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


@pytest.fixture
def customer_headers(client: TestClient, customer: User) -> dict[str, str]:
    return bearer_headers(client, customer.email)


@pytest.fixture
def product(client: TestClient, admin_headers: dict) -> dict:
    t = client.post(
        "/api/admin/product-types", json={"name": "Service"}, headers=admin_headers
    )
    response = client.post(
        "/api/admin/products",
        json={
            "name": "Software Package",
            "product_type_id": t.json()["id"],
            "sales_price": "2000",
            "cost_price": "900",
        },
        headers=admin_headers,
    )
    assert response.status_code == 201, response.text
    return response.json()


# --- Access control for every new admin module -------------------------------


@pytest.mark.parametrize("fixture", ["staff", "customer"])
@pytest.mark.parametrize(
    ("method", "path"),
    [
        ("get", "/api/admin/taxes"),
        ("post", "/api/admin/taxes"),
        ("get", "/api/admin/discounts"),
        ("post", "/api/admin/discounts"),
        ("post", "/api/admin/discounts/preview"),
        ("get", "/api/admin/reports/revenue"),
        ("get", "/api/admin/reports/subscriptions"),
        ("get", "/api/admin/settings"),
        ("patch", "/api/admin/settings"),
        ("patch", "/api/admin/staff/00000000-0000-0000-0000-000000000000"),
    ],
)
def test_only_admin_can_use_admin_modules(
    client: TestClient,
    request: pytest.FixtureRequest,
    fixture: str,
    method: str,
    path: str,
) -> None:
    user: User = request.getfixturevalue(fixture)
    response = client.request(
        method.upper(), path, json={}, headers=bearer_headers(client, user.email)
    )
    assert response.status_code == 403


def test_admin_modules_require_login(client: TestClient) -> None:
    for path in ("/api/admin/taxes", "/api/admin/discounts", "/api/admin/settings"):
        assert client.get(path).status_code == 401


# --- Taxes -------------------------------------------------------------------


def make_tax(client, headers, **overrides) -> dict:
    payload = {"name": "GST 18%", "rate": "18", "tax_type": "GST", **overrides}
    response = client.post("/api/admin/taxes", json=payload, headers=headers)
    assert response.status_code == 201, response.text
    return response.json()


def test_tax_crud_search_and_filters(client: TestClient, admin_headers: dict) -> None:
    created = make_tax(client, admin_headers, description="Standard rate")
    assert (created["rate"], created["is_active"], created["is_default"]) == (
        "18.00",
        True,
        False,
    )

    edited = client.patch(
        f"/api/admin/taxes/{created['id']}",
        json={"rate": "12.5", "is_active": False},
        headers=admin_headers,
    ).json()
    assert (edited["rate"], edited["is_active"]) == ("12.50", False)

    listed = client.get(
        "/api/admin/taxes", params={"q": "gst"}, headers=admin_headers
    ).json()
    assert listed["total"] == 1
    inactive = client.get(
        "/api/admin/taxes?is_active=false", headers=admin_headers
    ).json()
    assert [t["name"] for t in inactive["items"]] == ["GST 18%"]


@pytest.mark.parametrize(
    "payload",
    [
        {"name": "Bad", "rate": "-1", "tax_type": "GST"},
        {"name": "Bad", "rate": "100.01", "tax_type": "GST"},
        {"name": "Bad", "rate": "5.555", "tax_type": "GST"},
        {"name": " ", "rate": "5", "tax_type": "GST"},
        {"name": "Bad", "rate": "5", "tax_type": ""},
    ],
)
def test_invalid_tax_is_rejected(
    client: TestClient, admin_headers: dict, payload: dict
) -> None:
    assert (
        client.post("/api/admin/taxes", json=payload, headers=admin_headers).status_code
        == 422
    )


def test_tax_names_are_unique_ignoring_case(
    client: TestClient, admin_headers: dict
) -> None:
    make_tax(client, admin_headers)
    duplicate = client.post(
        "/api/admin/taxes",
        json={"name": "gst 18%", "rate": "18", "tax_type": "GST"},
        headers=admin_headers,
    )
    assert duplicate.status_code == 409


def test_only_one_default_tax(
    client: TestClient, admin_headers: dict, db: Session
) -> None:
    first = make_tax(client, admin_headers, name="GST 5%", rate="5", is_default=True)
    second = make_tax(client, admin_headers, name="GST 12%", rate="12", is_default=True)

    db.expire_all()
    defaults = db.scalars(select(Tax.id).where(Tax.is_default.is_(True))).all()
    assert [str(i) for i in defaults] == [second["id"]]
    refreshed = client.get(
        f"/api/admin/taxes/{first['id']}", headers=admin_headers
    ).json()
    assert refreshed["is_default"] is False


def test_default_tax_cannot_be_deactivated(
    client: TestClient, admin_headers: dict
) -> None:
    tax = make_tax(client, admin_headers, name="GST 5%", rate="5", is_default=True)

    response = client.patch(
        f"/api/admin/taxes/{tax['id']}",
        json={"is_active": False},
        headers=admin_headers,
    )

    assert response.status_code == 422


def test_tax_resolution_product_then_type_then_default(
    client: TestClient, admin_headers: dict, staff_headers: dict, product: dict
) -> None:
    make_tax(client, admin_headers, name="GST 5%", rate="5", is_default=True)

    def resolved() -> str | None:
        body = client.get(
            "/api/staff/taxes/resolve",
            params={"product_id": product["id"]},
            headers=staff_headers,
        ).json()
        return body["tax"]["name"] if body["tax"] else None

    assert resolved() == "GST 5%"
    make_tax(
        client,
        admin_headers,
        name="Service tax",
        rate="12",
        product_type_ids=[product["product_type"]["id"]],
    )
    assert resolved() == "Service tax"
    make_tax(
        client,
        admin_headers,
        name="Package tax",
        rate="18",
        product_ids=[product["id"]],
    )
    assert resolved() == "Package tax"


def test_staff_tax_options_lists_active_default_first(
    client: TestClient, admin_headers: dict, staff_headers: dict, customer: User
) -> None:
    make_tax(client, admin_headers, name="A tax", rate="18")
    make_tax(client, admin_headers, name="GST 5%", rate="5", is_default=True)
    make_tax(client, admin_headers, name="Old", rate="3", is_active=False)

    options = client.get("/api/staff/taxes", headers=staff_headers).json()

    assert [o["name"] for o in options] == ["GST 5%", "A tax"]
    customer_call = client.get(
        "/api/staff/taxes", headers=bearer_headers(client, customer.email)
    )
    assert customer_call.status_code == 403


def test_editing_a_tax_never_changes_existing_invoices(
    client: TestClient, admin_headers: dict, staff_headers: dict, customer: User
) -> None:
    tax = make_tax(client, admin_headers, name="GST 5%", rate="5", is_default=True)
    activate_subscription(client, staff_headers, str(customer.id), start_date=TODAY)
    run_billing(client, staff_headers, TODAY)
    before = list_invoices(client, staff_headers)[0]

    client.patch(
        f"/api/admin/taxes/{tax['id']}", json={"rate": "28"}, headers=admin_headers
    )

    after = list_invoices(client, staff_headers)[0]
    assert (after["tax_total"], after["total"]) == (
        before["tax_total"],
        before["total"],
    )


# --- Discounts ---------------------------------------------------------------


def make_discount(client, headers, **overrides) -> dict:
    payload = {
        "name": "Launch 10%",
        "discount_type": "PERCENTAGE",
        "value": "10",
        "start_date": "2026-10-01",
        **overrides,
    }
    response = client.post("/api/admin/discounts", json=payload, headers=headers)
    assert response.status_code == 201, response.text
    return response.json()


def preview(client, headers, lines, as_of=None) -> dict:
    body = {"lines": lines}
    if as_of:
        body["as_of"] = as_of
    response = client.post("/api/admin/discounts/preview", json=body, headers=headers)
    assert response.status_code == 200, response.text
    return response.json()


def test_discount_crud_and_filters(client: TestClient, admin_headers: dict) -> None:
    made = make_discount(client, admin_headers, usage_limit=5, min_quantity=2)
    assert (made["usage_count"], made["is_valid_today"]) == (0, True)

    edited = client.patch(
        f"/api/admin/discounts/{made['id']}",
        json={"is_active": False, "value": "15"},
        headers=admin_headers,
    ).json()
    assert (edited["value"], edited["is_active"], edited["is_valid_today"]) == (
        "15.00",
        False,
        False,
    )

    assert (
        client.get("/api/admin/discounts?q=launch", headers=admin_headers).json()[
            "total"
        ]
        == 1
    )
    assert (
        client.get(
            "/api/admin/discounts?valid_today=true", headers=admin_headers
        ).json()["total"]
        == 0
    )
    fixed = client.get(
        "/api/admin/discounts?discount_type=FIXED", headers=admin_headers
    )
    assert fixed.json()["total"] == 0


@pytest.mark.parametrize(
    ("overrides", "code"),
    [
        ({"value": "0"}, 422),
        ({"value": "101"}, 422),  # percentage above 100
        ({"end_date": "2026-09-01"}, 422),  # before start
        ({"scope": "SPECIFIC_PRODUCTS"}, 422),  # no products chosen
        ({"usage_limit": 0}, 422),
        ({"min_quantity": 0}, 422),
        ({"min_purchase_amount": "-1"}, 422),
    ],
)
def test_invalid_discounts_are_rejected(
    client: TestClient, admin_headers: dict, overrides: dict, code: int
) -> None:
    payload = {
        "name": "Bad",
        "discount_type": "PERCENTAGE",
        "value": "10",
        "start_date": "2026-10-01",
        **overrides,
    }
    response = client.post("/api/admin/discounts", json=payload, headers=admin_headers)
    assert response.status_code == code, response.text


def test_discount_is_applied_before_tax_and_best_wins(
    client: TestClient, admin_headers: dict
) -> None:
    make_discount(client, admin_headers, name="Ten percent", value="10")
    make_discount(
        client, admin_headers, name="Flat 250", discount_type="FIXED", value="250"
    )

    result = preview(client, admin_headers, [{"quantity": 2, "unit_price": "1000"}])

    # 10% of 2000 = 200 < 250 flat, so the flat discount wins; tax is then charged on 1750.
    assert (
        result["subtotal"],
        result["discount_amount"],
        result["subtotal_after_discount"],
    ) == (
        "2000.00",
        "250.00",
        "1750.00",
    )
    assert result["discount"]["name"] == "Flat 250"


def test_fixed_discount_never_exceeds_the_subtotal(
    client: TestClient, admin_headers: dict
) -> None:
    make_discount(
        client, admin_headers, name="Big", discount_type="FIXED", value="5000"
    )

    result = preview(client, admin_headers, [{"quantity": 1, "unit_price": "100"}])

    assert (result["discount_amount"], result["subtotal_after_discount"]) == (
        "100.00",
        "0.00",
    )


def test_discount_eligibility_rules(
    client: TestClient, admin_headers: dict, product: dict
) -> None:
    make_discount(
        client,
        admin_headers,
        name="Package only",
        scope="SPECIFIC_PRODUCTS",
        product_ids=[product["id"]],
        min_quantity=3,
        min_purchase_amount="5000",
        end_date="2026-11-30",
    )
    package = {"product_id": product["id"], "unit_price": "2000"}

    assert (
        preview(client, admin_headers, [{**package, "quantity": 2}])["discount"] is None
    )
    hit = preview(
        client,
        admin_headers,
        [{**package, "quantity": 3}, {"quantity": 1, "unit_price": "999"}],
    )
    # Only the package line (6000) counts, not the free-text line.
    assert hit["discount_amount"] == "600.00"
    assert (
        preview(client, admin_headers, [{"quantity": 5, "unit_price": "2000"}])[
            "discount"
        ]
        is None
    )
    expired = preview(
        client, admin_headers, [{**package, "quantity": 3}], as_of="2026-12-01"
    )
    assert expired["discount"] is None
    early = preview(
        client, admin_headers, [{**package, "quantity": 3}], as_of="2026-09-30"
    )
    assert early["discount"] is None


def _invoice_ids(client, staff_headers, customer_id, count) -> list[str]:
    activate_subscription(
        client,
        staff_headers,
        customer_id,
        start_date=TODAY - timedelta(days=31 * (count - 1)),
    )
    run_billing(client, staff_headers, TODAY)
    return [i["id"] for i in list_invoices(client, staff_headers)][:count]


def test_redemption_counts_once_per_invoice_and_respects_limit(
    client: TestClient,
    admin_headers: dict,
    staff_headers: dict,
    customer: User,
    db: Session,
) -> None:
    discount = make_discount(client, admin_headers, usage_limit=2)
    invoices = _invoice_ids(client, staff_headers, str(customer.id), 3)

    def redeem(invoice_id: str):
        import uuid

        with TestingSessionLocal() as session:
            try:
                discount_service.redeem(
                    session,
                    discount_id=uuid.UUID(discount["id"]),
                    invoice_id=uuid.UUID(invoice_id),
                    amount=Decimal(10),
                    as_of=TODAY,
                )
                session.commit()
                return True
            except ConflictError:
                session.rollback()
                return False

    assert redeem(invoices[0]) is True
    assert redeem(invoices[0]) is False  # same invoice again
    assert redeem(invoices[1]) is True
    assert redeem(invoices[2]) is False  # limit of 2 reached

    db.expire_all()
    stored = db.get(Discount, __import__("uuid").UUID(discount["id"]))
    assert stored.usage_count == 2
    assert discount_service.redemptions_for(db, stored.id) == 2
    after = client.get(
        f"/api/admin/discounts/{discount['id']}", headers=admin_headers
    ).json()
    assert after["is_valid_today"] is False


def test_usage_limit_cannot_go_below_uses(
    client: TestClient, admin_headers: dict, staff_headers: dict, customer: User
) -> None:
    import uuid

    discount = make_discount(client, admin_headers, usage_limit=5)
    invoice_id = _invoice_ids(client, staff_headers, str(customer.id), 1)[0]
    with TestingSessionLocal() as session:
        discount_service.redeem(
            session,
            discount_id=uuid.UUID(discount["id"]),
            invoice_id=uuid.UUID(invoice_id),
            amount=Decimal(1),
            as_of=TODAY,
        )
        session.commit()

    response = client.patch(
        f"/api/admin/discounts/{discount['id']}",
        json={"usage_limit": 0},
        headers=admin_headers,
    )
    assert response.status_code == 422
    response = client.patch(
        f"/api/admin/discounts/{discount['id']}",
        json={"usage_limit": 1},
        headers=admin_headers,
    )
    assert response.status_code == 200


@pytest.mark.skipif(
    TEST_DATABASE_URL.startswith("sqlite"), reason="Concurrency needs Postgres"
)
def test_concurrent_redemptions_never_exceed_the_limit(
    client: TestClient,
    admin_headers: dict,
    staff_headers: dict,
    customer: User,
    db: Session,
) -> None:
    import uuid

    discount = make_discount(client, admin_headers, usage_limit=1)
    invoices = _invoice_ids(client, staff_headers, str(customer.id), 4)
    wins: list[bool] = []

    def worker(invoice_id: str) -> None:
        with TestingSessionLocal() as session:
            try:
                discount_service.redeem(
                    session,
                    discount_id=uuid.UUID(discount["id"]),
                    invoice_id=uuid.UUID(invoice_id),
                    amount=Decimal(5),
                    as_of=TODAY,
                )
                session.commit()
                wins.append(True)
            except ConflictError:
                session.rollback()
                wins.append(False)

    threads = [threading.Thread(target=worker, args=(i,)) for i in invoices]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    assert wins.count(True) == 1
    db.expire_all()
    assert db.get(Discount, uuid.UUID(discount["id"])).usage_count == 1


# --- Settings ----------------------------------------------------------------


def test_settings_defaults_keep_existing_behaviour(
    client: TestClient, admin_headers: dict
) -> None:
    body = client.get("/api/admin/settings", headers=admin_headers).json()

    assert (body["currency"], body["timezone"], body["invoice_prefix"]) == (
        "INR",
        "Asia/Kolkata",
        "INV",
    )


def test_settings_update_and_validation(
    client: TestClient, admin_headers: dict
) -> None:
    ok = client.patch(
        "/api/admin/settings",
        json={
            "company_name": "Brightloop Software Pvt Ltd",
            "company_email": "billing@brightloop.com",
            "company_phone": "+91 98765 43210",
            "company_address": "Bengaluru",
        },
        headers=admin_headers,
    )
    assert ok.status_code == 200, ok.text
    assert ok.json()["company_name"] == "Brightloop Software Pvt Ltd"

    for bad in (
        {"invoice_prefix": "1NV"},
        {"invoice_prefix": "IN-V"},
        {"currency": "USD"},
        {"timezone": "Mars/Base"},
        {"company_email": "not-an-email"},
        {"company_name": "   "},
    ):
        response = client.patch("/api/admin/settings", json=bad, headers=admin_headers)
        assert response.status_code == 422, (bad, response.text)


def test_invoice_prefix_applies_to_new_invoices_only(
    client: TestClient,
    admin_headers: dict,
    staff_headers: dict,
    customer: User,
    db: Session,
) -> None:
    activate_subscription(
        client, staff_headers, str(customer.id), start_date=date(2026, 9, 30)
    )
    run_billing(client, staff_headers, date(2026, 9, 30))
    client.patch(
        "/api/admin/settings", json={"invoice_prefix": "brl"}, headers=admin_headers
    )
    run_billing(client, staff_headers, TODAY)

    numbers = sorted(i["number"] for i in list_invoices(client, staff_headers))
    assert numbers == ["BRL-00002", "INV-00001"]
    db.expire_all()
    assert db.get(AppSettings, 1).invoice_prefix == "BRL"


# --- Reports -----------------------------------------------------------------


def test_reports_on_empty_database_are_zero(
    client: TestClient, admin_headers: dict
) -> None:
    revenue = client.get("/api/admin/reports/revenue", headers=admin_headers).json()
    subs = client.get("/api/admin/reports/subscriptions", headers=admin_headers).json()

    assert (revenue["invoiced"], revenue["received"], revenue["outstanding"]) == (
        "0.00",
        "0.00",
        "0.00",
    )
    assert revenue["periods"] == []
    assert (subs["active_subscriptions"], subs["recurring_revenue_monthly"]) == (
        0,
        "0.00",
    )
    assert subs["renewed_subscriptions"] is None
    assert "PROPOSED" in subs["recurring_revenue_definition"]


def test_revenue_report_keeps_figures_separate(
    client: TestClient,
    admin_headers: dict,
    staff_headers: dict,
    customer: User,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    activate_subscription(
        client, staff_headers, str(customer.id), start_date=date(2026, 9, 30)
    )
    run_billing(client, staff_headers, TODAY)
    sept, octo = sorted(
        list_invoices(client, staff_headers), key=lambda i: i["period_start"]
    )
    confirm_invoice(client, staff_headers, sept["id"])
    confirm_invoice(client, staff_headers, octo["id"])
    record_payment(client, staff_headers, sept["id"], "1154.98", paid_on="2026-10-05")
    record_payment(client, staff_headers, octo["id"], "154.98")
    freeze_today(monkeypatch, date(2026, 11, 20))  # October invoice now overdue

    report = client.get(
        "/api/admin/reports/revenue",
        params={"date_from": "2026-09-01", "date_to": "2026-11-20"},
        headers=admin_headers,
    ).json()

    assert report["invoiced"] == "2309.96"  # 2 invoices of 1154.98
    assert report["received"] == "1309.96"  # payments, not invoices
    assert report["outstanding"] == "1000.00"
    assert report["overdue"] == "1000.00"
    by_month = {(p["year"], p["month"]): p for p in report["periods"]}
    assert by_month[(2026, 9)]["invoiced"] == "1154.98"
    assert by_month[(2026, 9)]["received"] == "0.00"
    assert by_month[(2026, 10)]["received"] == "1309.96"

    yearly = client.get(
        "/api/admin/reports/revenue",
        params={"date_from": "2026-01-01", "date_to": "2026-11-20", "group_by": "year"},
        headers=admin_headers,
    ).json()
    assert [(p["year"], p["month"], p["invoiced"]) for p in yearly["periods"]] == [
        (2026, None, "2309.96")
    ]


def test_subscription_report_and_recurring_revenue(
    client: TestClient,
    admin_headers: dict,
    staff_headers: dict,
    customer: User,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    # 19:00 UTC is 00:30 the next day in India; reports bucket by the India day.
    monkeypatch.setattr(
        clock, "now_utc", lambda: datetime(2026, 9, 30, 19, 0, tzinfo=UTC)
    )
    activate_subscription(client, staff_headers, str(customer.id), start_date=TODAY)
    monkeypatch.setattr(
        clock, "now_utc", lambda: datetime(2026, 10, 31, 19, 0, tzinfo=UTC)
    )
    activate_subscription(
        client,
        staff_headers,
        str(customer.id),
        start_date=TODAY,
        billing_frequency="YEARLY",
        lines=[{"description": "Annual", "quantity": 1, "unit_price": "12000"}],
    )

    body = client.get(
        "/api/admin/reports/subscriptions",
        params={"date_from": "2026-10-01", "date_to": "2026-10-31"},
        headers=admin_headers,
    ).json()

    assert body["active_subscriptions"] == 2
    assert body["new_subscriptions"] == 1  # the second one was activated on 1 Nov (IST)
    november = client.get(
        "/api/admin/reports/subscriptions",
        params={"date_from": "2026-11-01", "date_to": "2026-11-30"},
        headers=admin_headers,
    ).json()
    assert november["new_subscriptions"] == 1
    # Monthly 1099.98 + yearly 12000 / 12 = 2099.98 (pre-tax).
    assert body["recurring_revenue_monthly"] == "2099.98"
    assert body["recurring_by_frequency"] == {
        "MONTHLY": "1099.98",
        "YEARLY": "12000.00",
    }


def test_report_range_validation(client: TestClient, admin_headers: dict) -> None:
    response = client.get(
        "/api/admin/reports/revenue",
        params={"date_from": "2026-11-01", "date_to": "2026-10-01"},
        headers=admin_headers,
    )
    assert response.status_code == 422


# --- Customer profiles -------------------------------------------------------


def test_admin_creates_and_edits_customer_profile(
    client: TestClient, admin_headers: dict, customer: User
) -> None:
    path = f"/api/customers/{customer.id}/profile"
    empty = client.get(path, headers=admin_headers).json()
    assert (empty["full_name"], empty["updated_at"]) == (None, None)

    saved = client.patch(
        path,
        json={
            "full_name": "  Asha Rao ",
            "company_name": "Rao Traders",
            "phone": "+91 98450 12345",
            "address": "MG Road, Bengaluru",
        },
        headers=admin_headers,
    )
    assert saved.status_code == 200, saved.text
    assert (saved.json()["full_name"], saved.json()["company_name"]) == (
        "Asha Rao",
        "Rao Traders",
    )

    cleared = client.patch(
        path, json={"company_name": ""}, headers=admin_headers
    ).json()
    assert cleared["company_name"] is None
    assert cleared["full_name"] == "Asha Rao"  # untouched


def test_customer_reads_and_edits_only_own_profile(
    client: TestClient, customer: User, customer_headers: dict, make_user
) -> None:
    other = make_user("other.customer@brightloop.com", UserRole.CUSTOMER)

    mine = client.patch(
        f"/api/customers/{customer.id}/profile",
        json={"full_name": "Me"},
        headers=customer_headers,
    )
    theirs_read = client.get(
        f"/api/customers/{other.id}/profile", headers=customer_headers
    )
    theirs_edit = client.patch(
        f"/api/customers/{other.id}/profile",
        json={"full_name": "X"},
        headers=customer_headers,
    )

    assert mine.status_code == 200
    assert theirs_read.status_code == 404
    assert theirs_edit.status_code == 404


def test_staff_can_read_but_not_edit_customer_profiles(
    client: TestClient, staff_headers: dict, customer: User, admin_headers: dict
) -> None:
    path = f"/api/customers/{customer.id}/profile"
    client.patch(path, json={"full_name": "Asha"}, headers=admin_headers)

    assert client.get(path, headers=staff_headers).json()["full_name"] == "Asha"
    assert (
        client.patch(path, json={"full_name": "X"}, headers=staff_headers).status_code
        == 403
    )


def test_profile_validation_and_non_customers(
    client: TestClient, admin_headers: dict, customer: User, staff: User
) -> None:
    path = f"/api/customers/{customer.id}/profile"
    assert (
        client.patch(path, json={"phone": "abc"}, headers=admin_headers).status_code
        == 422
    )
    assert (
        client.patch(
            path, json={"full_name": "x" * 201}, headers=admin_headers
        ).status_code
        == 422
    )
    assert (
        client.patch(path, json={"role": "ADMIN"}, headers=admin_headers).status_code
        == 422
    )
    staff_path = f"/api/customers/{staff.id}/profile"
    assert client.get(staff_path, headers=admin_headers).status_code == 404


def test_customer_list_shows_and_searches_profile_names(
    client: TestClient, admin_headers: dict, customer: User
) -> None:
    client.patch(
        f"/api/customers/{customer.id}/profile",
        json={"full_name": "Asha Rao", "company_name": "Rao Traders"},
        headers=admin_headers,
    )

    found = client.get(
        "/api/admin/customers", params={"q": "traders"}, headers=admin_headers
    )
    row = found.json()["items"][0]

    assert (row["full_name"], row["company_name"]) == ("Asha Rao", "Rao Traders")
    detail = client.get(
        f"/api/admin/customers/{customer.id}", headers=admin_headers
    ).json()
    assert detail["full_name"] == "Asha Rao"


# --- Staff editing -----------------------------------------------------------


def test_admin_edits_staff_details(
    client: TestClient, admin_headers: dict, staff: User
) -> None:
    response = client.patch(
        f"/api/admin/staff/{staff.id}",
        json={
            "full_name": "Ravi Kumar",
            "phone": "080-4000-1234",
            "email": "Ravi@Brightloop.com",
        },
        headers=admin_headers,
    )

    assert response.status_code == 200, response.text
    assert response.json()["email"] == "ravi@brightloop.com"
    assert login(client, "ravi@brightloop.com").json()["role"] == "STAFF"
    listed = client.get(
        "/api/admin/staff", params={"q": "ravi kumar"}, headers=admin_headers
    )
    assert listed.json()["items"][0]["full_name"] == "Ravi Kumar"


def test_staff_edit_rejects_duplicates_and_non_staff(
    client: TestClient, admin_headers: dict, staff: User, customer: User, admin: User
) -> None:
    dup = client.patch(
        f"/api/admin/staff/{staff.id}",
        json={"email": customer.email},
        headers=admin_headers,
    )
    not_staff = client.patch(
        f"/api/admin/staff/{admin.id}", json={"full_name": "X"}, headers=admin_headers
    )
    role_field = client.patch(
        f"/api/admin/staff/{staff.id}", json={"role": "ADMIN"}, headers=admin_headers
    )

    assert dup.status_code == 409
    assert not_staff.status_code == 404
    assert role_field.status_code == 422


def test_staff_cannot_edit_staff(client: TestClient, staff: User, make_user) -> None:
    other = make_user("other.staff@brightloop.com", UserRole.STAFF)
    response = client.patch(
        f"/api/admin/staff/{other.id}",
        json={"full_name": "X"},
        headers=bearer_headers(client, staff.email),
    )
    assert response.status_code == 403


# --- Forgot password ---------------------------------------------------------


@pytest.fixture
def outbox():
    sent: list[OutgoingEmail] = []
    app.dependency_overrides[get_email_sender] = lambda: sent.append
    get_password_reset_rate_limiter().clear()
    yield sent
    app.dependency_overrides.pop(get_email_sender, None)
    get_password_reset_rate_limiter().clear()


def _token_from(email: OutgoingEmail) -> str:
    return email.body.split("token=", 1)[1].split()[0]


def test_reset_flow_sets_new_password_and_signs_out(
    client: TestClient, customer: User, outbox: list, db: Session
) -> None:
    old_headers = bearer_headers(client, customer.email)
    response = client.post(
        "/api/auth/password-reset/request", json={"email": customer.email.upper()}
    )
    assert response.status_code == 202
    assert len(outbox) == 1 and outbox[0].to == customer.email
    token = _token_from(outbox[0])

    # Only a hash is stored.
    stored = db.scalars(select(PasswordResetToken.token_hash)).all()
    assert token not in stored and len(stored[0]) == 64

    done = client.post(
        "/api/auth/password-reset/confirm",
        json={"token": token, "new_password": "Brand@New9"},
    )
    assert done.status_code == 204, done.text
    assert login(client, customer.email, "Brand@New9").status_code == 200
    assert login(client, customer.email, PASSWORD).status_code == 401
    assert client.get("/api/auth/me", headers=old_headers).status_code == 401

    reused = client.post(
        "/api/auth/password-reset/confirm",
        json={"token": token, "new_password": "Another@New9"},
    )
    assert reused.status_code == 422


def test_reset_request_does_not_reveal_unknown_emails(
    client: TestClient, outbox: list, make_user
) -> None:
    make_user("gone@brightloop.com", UserRole.CUSTOMER, is_active=False)
    known_shape = client.post(
        "/api/auth/password-reset/request", json={"email": "nobody@brightloop.com"}
    )
    inactive = client.post(
        "/api/auth/password-reset/request", json={"email": "gone@brightloop.com"}
    )

    assert known_shape.status_code == inactive.status_code == 202
    assert known_shape.json() == inactive.json()
    assert outbox == []


def test_reset_link_expires(
    client: TestClient, customer: User, outbox: list, db: Session
) -> None:
    from app.core.config import get_settings

    client.post("/api/auth/password-reset/request", json={"email": customer.email})
    token = _token_from(outbox[0])
    row = db.scalar(select(PasswordResetToken))
    row.expires_at = row.created_at.replace(year=2000)
    db.commit()

    response = client.post(
        "/api/auth/password-reset/confirm",
        json={"token": token, "new_password": "Brand@New9"},
    )
    assert response.status_code == 422
    assert get_settings().password_reset_token_minutes == 30


def test_new_request_invalidates_older_links(
    client: TestClient, customer: User, outbox: list
) -> None:
    client.post("/api/auth/password-reset/request", json={"email": customer.email})
    client.post("/api/auth/password-reset/request", json={"email": customer.email})
    first, second = (_token_from(e) for e in outbox)

    old = client.post(
        "/api/auth/password-reset/confirm",
        json={"token": first, "new_password": "Brand@New9"},
    )
    new = client.post(
        "/api/auth/password-reset/confirm",
        json={"token": second, "new_password": "Brand@New9"},
    )
    assert (old.status_code, new.status_code) == (422, 204)


def test_reset_keeps_each_roles_password_rule(
    client: TestClient, customer: User, staff: User, outbox: list
) -> None:
    client.post("/api/auth/password-reset/request", json={"email": customer.email})
    client.post("/api/auth/password-reset/request", json={"email": staff.email})
    customer_token, staff_token = (_token_from(e) for e in outbox)

    weak_customer = client.post(
        "/api/auth/password-reset/confirm",
        json={"token": customer_token, "new_password": "alllowercase1"},
    )
    short_staff = client.post(
        "/api/auth/password-reset/confirm",
        json={"token": staff_token, "new_password": "Short@1"},
    )
    good_staff = client.post(
        "/api/auth/password-reset/confirm",
        json={"token": staff_token, "new_password": "LongEnoughPass1"},
    )
    assert weak_customer.status_code == 422
    assert "uppercase" in weak_customer.json()["detail"]
    assert short_staff.status_code == 422
    assert good_staff.status_code == 204


def test_reset_requests_are_rate_limited(
    client: TestClient, customer: User, outbox: list
) -> None:
    codes = [
        client.post(
            "/api/auth/password-reset/request", json={"email": customer.email}
        ).status_code
        for _ in range(4)
    ]
    assert codes == [202, 202, 202, 429]
    assert len(outbox) == 3


def test_invalid_reset_token_is_rejected(client: TestClient) -> None:
    response = client.post(
        "/api/auth/password-reset/confirm",
        json={"token": "x" * 43, "new_password": "Brand@New9"},
    )
    assert response.status_code == 422


@pytest.mark.parametrize(
    ("environment", "shown"), [("development", True), ("production", False)]
)
def test_console_email_hides_reset_links_outside_development(
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
    environment: str,
    shown: bool,
) -> None:
    monkeypatch.setattr(
        email_module,
        "get_settings",
        lambda: SimpleNamespace(email_backend="console", environment=environment),
    )
    with caplog.at_level("WARNING", logger="app.email"):
        email_module.send_email(
            OutgoingEmail(to="a@example.com", subject="Reset", body="secret-link")
        )
    assert ("secret-link" in caplog.text) is shown
