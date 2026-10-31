"""Quotations and invoices using the admin catalog: plan lines, product prices, tax rules,
discounts (before tax, counted on confirm, returned on cancel) and plan rules."""

from datetime import date

import pytest
from fastapi.testclient import TestClient

from app.models.user import User
from app.services import clock
from tests.conftest import bearer_headers
from tests.staff_helpers import action, invoices_for, run_billing

TODAY = date(2026, 10, 31)


@pytest.fixture(autouse=True)
def fixed_today(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(clock, "today", lambda: TODAY)


@pytest.fixture
def catalog(client: TestClient, admin: User) -> dict:
    h = bearer_headers(client, admin.email)
    ptype = client.post(
        "/api/admin/product-types", headers=h, json={"name": "Software"}
    ).json()
    product = client.post(
        "/api/admin/products",
        headers=h,
        json={
            "name": "CRM Suite",
            "product_type_id": ptype["id"],
            "sales_price": "2000",
            "cost_price": "500",
        },
    ).json()
    variant = client.post(
        f"/api/admin/products/{product['id']}/variants",
        headers=h,
        json={"name": "Odoo", "additional_price": "560"},
    ).json()
    tax = client.post(
        "/api/admin/taxes",
        headers=h,
        json={
            "name": "GST 18",
            "rate": "18",
            "tax_type": "GST",
            "product_ids": [product["id"]],
        },
    ).json()
    plan = client.post(
        "/api/admin/plans",
        headers=h,
        json={
            "name": "Pro",
            "price": "1000",
            "billing_frequency": "MONTHLY",
            "minimum_quantity": 2,
            "available_from": "2026-01-01",
            "product_ids": [product["id"]],
            "allow_pause": True,
            "allow_renewal": True,
            "allow_early_closure": False,
        },
    ).json()
    return {
        "admin": h,
        "product": product,
        "variant": variant,
        "tax": tax,
        "plan": plan,
    }


def _quote(client, h, customer_id, plan_id, lines):
    r = client.post(
        "/api/staff/subscriptions",
        headers=h,
        json={
            "customer_id": customer_id,
            "plan_id": plan_id,
            "payment_terms_days": 15,
            "lines": lines,
        },
    )
    return r


def test_plan_and_product_lines_fill_from_catalog(client, staff, customer, catalog):
    h = bearer_headers(client, staff.email)
    r = _quote(
        client,
        h,
        str(customer.id),
        catalog["plan"]["id"],
        [
            {"is_plan_line": True, "quantity": 2, "tax_rate": "18"},
            {
                "product_id": catalog["product"]["id"],
                "variant_id": catalog["variant"]["id"],
                "quantity": 1,
            },
        ],
    )
    assert r.status_code == 201, r.text
    sub = r.json()
    assert sub["plan_name"] == "Pro" and sub["billing_frequency"] == "MONTHLY"
    plan_line, product_line = sub["lines"]
    assert (plan_line["description"], plan_line["unit_price"]) == ("Pro", "1000.00")
    assert product_line["description"] == "CRM Suite (Odoo)"
    assert product_line["unit_price"] == "2560.00"
    assert product_line["tax_rate"] == "18.00"  # from the product's tax rule
    assert sub["plan_rules"]["minimum_quantity"] == 2

    under = _quote(
        client,
        h,
        str(customer.id),
        catalog["plan"]["id"],
        [{"is_plan_line": True, "quantity": 1}],
    )
    assert under.status_code == 422  # below the plan's minimum quantity


def test_discount_before_tax_counted_on_confirm_returned_on_cancel(
    client, staff, customer, catalog
):
    admin_h = catalog["admin"]
    disc = client.post(
        "/api/admin/discounts",
        headers=admin_h,
        json={
            "name": "Ten",
            "discount_type": "PERCENTAGE",
            "value": "10",
            "start_date": "2026-01-01",
            "usage_limit": 1,
        },
    ).json()
    h = bearer_headers(client, staff.email)
    sub = _quote(
        client,
        h,
        str(customer.id),
        catalog["plan"]["id"],
        [{"is_plan_line": True, "quantity": 2, "tax_rate": "18"}],
    ).json()
    for name, body in [
        ("send-quotation", {}),
        ("confirm", None),
        ("activate", {"start_date": "2026-10-01"}),
    ]:
        assert action(client, h, sub["id"], name, body).status_code == 200
    run_billing(client, h)
    (inv,) = invoices_for(client, h, sub["id"])
    # 2 x 1000 = 2000, 10% off = 200, tax 18% on 1800 = 324, total 2124.
    assert (inv["subtotal"], inv["discount_total"], inv["tax_total"], inv["total"]) == (
        "2000.00",
        "200.00",
        "324.00",
        "2124.00",
    )
    assert inv["discount_name"] == "Ten"
    client.post(f"/api/staff/invoices/{inv['id']}/confirm", headers=h)
    used = client.get(f"/api/admin/discounts/{disc['id']}", headers=admin_h).json()
    assert used["usage_count"] == 1
    client.post(f"/api/staff/invoices/{inv['id']}/cancel", headers=h)
    back = client.get(f"/api/admin/discounts/{disc['id']}", headers=admin_h).json()
    assert back["usage_count"] == 0


def test_plan_rules_pause_resume_renew_and_close(client, staff, customer, catalog):
    h = bearer_headers(client, staff.email)
    mine = bearer_headers(client, customer.email)
    sub = _quote(
        client,
        h,
        str(customer.id),
        catalog["plan"]["id"],
        [{"is_plan_line": True, "quantity": 2}],
    ).json()
    for name, body in [
        ("send-quotation", {}),
        ("confirm", None),
        ("activate", {"start_date": "2026-10-01", "expiry_date": "2026-12-31"}),
    ]:
        assert action(client, h, sub["id"], name, body).status_code == 200

    paused = client.post(
        f"/api/portal/subscriptions/{sub['id']}/pause", headers=mine
    ).json()
    assert paused["paused_at"] is not None
    assert run_billing(client, h)["invoices_created"] == 0  # paused: nothing billed
    resumed = client.post(
        f"/api/portal/subscriptions/{sub['id']}/resume", headers=mine
    ).json()
    assert resumed["paused_at"] is None

    renewed = client.post(
        f"/api/portal/subscriptions/{sub['id']}/renew", headers=mine
    ).json()
    # Term 1 Oct-31 Dec is 92 days; renewing adds another 92: 31 Dec + 92 = 2 Apr.
    assert renewed["expiry_date"] == "2027-04-02"

    # The plan doesn't allow early closure for customers.
    assert (
        client.post(
            f"/api/portal/subscriptions/{sub['id']}/close", headers=mine
        ).status_code
        == 409
    )


def test_staff_catalog_and_templates(client, staff, catalog):
    h = bearer_headers(client, staff.email)
    plans = client.get("/api/staff/catalog/plans", headers=h).json()
    assert [p["name"] for p in plans] == ["Pro"]
    products = client.get("/api/staff/catalog/products", headers=h).json()
    assert products[0]["tax"]["rate"] == "18.00"
    assert products[0]["variants"][0]["final_price"] == "2560.00"

    t = client.post(
        "/api/staff/quotation-templates",
        headers=h,
        json={
            "name": "Pro starter",
            "plan_id": catalog["plan"]["id"],
            "validity_days": 30,
            "lines": [{"is_plan_line": True, "quantity": 3}],
        },
    )
    assert t.status_code == 201, t.text
    assert t.json()["lines"][0]["unit_price"] == "1000.00"
    assert len(client.get("/api/staff/quotation-templates", headers=h).json()) == 1
