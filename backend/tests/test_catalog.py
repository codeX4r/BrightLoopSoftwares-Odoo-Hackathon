from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient

from app.models.user import User
from tests.conftest import bearer_headers

PAST = (date.today() - timedelta(days=400)).isoformat()
TODAY = date.today().isoformat()
FUTURE = (date.today() + timedelta(days=400)).isoformat()


@pytest.fixture
def admin_headers(client: TestClient, admin: User) -> dict[str, str]:
    return bearer_headers(client, admin.email)


@pytest.fixture
def product_type(client: TestClient, admin_headers: dict[str, str]) -> dict:
    response = client.post(
        "/api/admin/product-types", json={"name": "Service"}, headers=admin_headers
    )
    assert response.status_code == 201, response.text
    return response.json()


def make_product(
    client: TestClient,
    headers: dict[str, str],
    product_type_id: str,
    name: str = "Software Package",
    sales_price: str = "2000",
    **extra,
) -> dict:
    payload = {
        "name": name,
        "product_type_id": product_type_id,
        "sales_price": sales_price,
        "cost_price": "900",
        **extra,
    }
    response = client.post("/api/admin/products", json=payload, headers=headers)
    assert response.status_code == 201, response.text
    return response.json()


def make_plan(
    client: TestClient, headers: dict[str, str], product_ids: list[str], **overrides
):
    payload = {
        "name": "Monthly Basic",
        "product_ids": product_ids,
        "price": "499.00",
        "billing_frequency": "MONTHLY",
        "minimum_quantity": 1,
        "available_from": PAST,
        "available_until": FUTURE,
        **overrides,
    }
    return client.post("/api/admin/plans", json=payload, headers=headers)


# --- Access control ----------------------------------------------------------


@pytest.mark.parametrize(
    ("method", "path", "json"),
    [
        ("get", "/api/admin/products", None),
        ("post", "/api/admin/products", {}),
        ("post", "/api/admin/product-types", {"name": "X"}),
        ("get", "/api/admin/plans", None),
        ("post", "/api/admin/plans", {}),
    ],
)
@pytest.mark.parametrize("fixture", ["staff", "customer"])
def test_only_admin_can_use_catalog_apis(
    client: TestClient,
    request: pytest.FixtureRequest,
    fixture: str,
    method: str,
    path: str,
    json: dict | None,
) -> None:
    user: User = request.getfixturevalue(fixture)
    response = client.request(
        method.upper(), path, json=json, headers=bearer_headers(client, user.email)
    )
    assert response.status_code == 403


def test_catalog_requires_login(client: TestClient) -> None:
    assert client.get("/api/admin/products").status_code == 401
    assert client.get("/api/admin/plans").status_code == 401


# --- Products ----------------------------------------------------------------


def test_product_is_created_with_two_decimal_prices(
    client: TestClient, admin_headers: dict, product_type: dict
) -> None:
    product = make_product(
        client, admin_headers, product_type["id"], sales_price="2000"
    )

    assert product["sales_price"] == "2000.00"
    assert product["cost_price"] == "900.00"
    assert product["status"] == "ACTIVE"
    assert product["product_type"]["name"] == "Service"


@pytest.mark.parametrize(
    "overrides",
    [
        {"sales_price": "-1"},
        {"cost_price": "-0.01"},
        {"name": "   "},
        {"sales_price": "1.234"},
    ],
)
def test_invalid_product_input_is_rejected(
    client: TestClient, admin_headers: dict, product_type: dict, overrides: dict
) -> None:
    payload = {
        "name": "Valid name",
        "product_type_id": product_type["id"],
        "sales_price": "10",
        "cost_price": "5",
        **overrides,
    }

    response = client.post("/api/admin/products", json=payload, headers=admin_headers)

    assert response.status_code == 422


def test_product_name_must_be_unique_ignoring_case(
    client: TestClient, admin_headers: dict, product_type: dict
) -> None:
    make_product(client, admin_headers, product_type["id"], name="Odoo Suite")

    response = client.post(
        "/api/admin/products",
        json={
            "name": "odoo suite",
            "product_type_id": product_type["id"],
            "sales_price": "1",
            "cost_price": "1",
        },
        headers=admin_headers,
    )

    assert response.status_code == 409


def test_unknown_product_type_is_rejected(
    client: TestClient, admin_headers: dict
) -> None:
    response = client.post(
        "/api/admin/products",
        json={
            "name": "Orphan",
            "product_type_id": "00000000-0000-0000-0000-000000000000",
            "sales_price": "1",
            "cost_price": "1",
        },
        headers=admin_headers,
    )

    assert response.status_code == 422


def test_product_can_be_updated_and_archived(
    client: TestClient, admin_headers: dict, product_type: dict
) -> None:
    product = make_product(client, admin_headers, product_type["id"])

    renamed = client.patch(
        f"/api/admin/products/{product['id']}",
        json={"name": "Software Suite", "sales_price": "2100"},
        headers=admin_headers,
    )
    archived = client.patch(
        f"/api/admin/products/{product['id']}",
        json={"status": "ARCHIVED"},
        headers=admin_headers,
    )

    assert renamed.json()["name"] == "Software Suite"
    assert renamed.json()["sales_price"] == "2100.00"
    assert archived.json()["status"] == "ARCHIVED"


def test_product_rename_to_existing_name_is_rejected(
    client: TestClient, admin_headers: dict, product_type: dict
) -> None:
    make_product(client, admin_headers, product_type["id"], name="First")
    second = make_product(client, admin_headers, product_type["id"], name="Second")

    response = client.patch(
        f"/api/admin/products/{second['id']}",
        json={"name": "first"},
        headers=admin_headers,
    )

    assert response.status_code == 409


def test_unused_product_can_be_deleted(
    client: TestClient, admin_headers: dict, product_type: dict
) -> None:
    product = make_product(client, admin_headers, product_type["id"])

    response = client.delete(
        f"/api/admin/products/{product['id']}", headers=admin_headers
    )

    assert response.status_code == 204
    assert (
        client.get(
            f"/api/admin/products/{product['id']}", headers=admin_headers
        ).status_code
        == 404
    )


def test_product_used_by_a_plan_cannot_be_deleted(
    client: TestClient, admin_headers: dict, product_type: dict
) -> None:
    product = make_product(client, admin_headers, product_type["id"])
    assert make_plan(client, admin_headers, [product["id"]]).status_code == 201

    response = client.delete(
        f"/api/admin/products/{product['id']}", headers=admin_headers
    )

    assert response.status_code == 409
    assert "Archive" in response.json()["detail"]


def test_product_list_paginates_searches_and_filters(
    client: TestClient, admin_headers: dict, product_type: dict
) -> None:
    make_product(client, admin_headers, product_type["id"], name="Alpha Suite")
    make_product(client, admin_headers, product_type["id"], name="Beta Suite")
    archived = make_product(
        client, admin_headers, product_type["id"], name="Gamma Suite"
    )
    client.patch(
        f"/api/admin/products/{archived['id']}",
        json={"status": "ARCHIVED"},
        headers=admin_headers,
    )

    page = client.get(
        "/api/admin/products?limit=2&offset=0", headers=admin_headers
    ).json()
    search = client.get("/api/admin/products?q=beta", headers=admin_headers).json()
    active = client.get(
        "/api/admin/products?status=ACTIVE", headers=admin_headers
    ).json()

    assert page["total"] == 3
    assert len(page["items"]) == 2
    assert search["total"] == 1 and search["items"][0]["name"] == "Beta Suite"
    assert active["total"] == 2


# --- Variants ----------------------------------------------------------------


def test_variant_final_price_is_base_plus_additional(
    client: TestClient, admin_headers: dict, product_type: dict
) -> None:
    product = make_product(
        client, admin_headers, product_type["id"], sales_price="2000"
    )

    odoo = client.post(
        f"/api/admin/products/{product['id']}/variants",
        json={"name": "Odoo", "additional_price": "560"},
        headers=admin_headers,
    ).json()
    default = client.post(
        f"/api/admin/products/{product['id']}/variants",
        json={"name": "Default"},
        headers=admin_headers,
    ).json()

    assert odoo["final_price"] == "2560.00"
    assert default["final_price"] == "2000.00"


def test_variant_price_change_updates_final_price(
    client: TestClient, admin_headers: dict, product_type: dict
) -> None:
    product = make_product(
        client, admin_headers, product_type["id"], sales_price="2000"
    )
    variant = client.post(
        f"/api/admin/products/{product['id']}/variants",
        json={"name": "Odoo", "additional_price": "560"},
        headers=admin_headers,
    ).json()

    updated = client.patch(
        f"/api/admin/variants/{variant['id']}",
        json={"additional_price": "600"},
        headers=admin_headers,
    ).json()

    assert updated["final_price"] == "2600.00"


def test_variant_names_are_unique_per_product_only(
    client: TestClient, admin_headers: dict, product_type: dict
) -> None:
    first = make_product(client, admin_headers, product_type["id"], name="One")
    second = make_product(client, admin_headers, product_type["id"], name="Two")

    def add_variant(product_id: str, name: str):
        return client.post(
            f"/api/admin/products/{product_id}/variants",
            json={"name": name},
            headers=admin_headers,
        )

    assert add_variant(first["id"], "Odoo").status_code == 201
    assert add_variant(first["id"], "odoo").status_code == 409
    assert add_variant(second["id"], "Odoo").status_code == 201


def test_negative_variant_price_is_rejected(
    client: TestClient, admin_headers: dict, product_type: dict
) -> None:
    product = make_product(client, admin_headers, product_type["id"])

    response = client.post(
        f"/api/admin/products/{product['id']}/variants",
        json={"name": "Bad", "additional_price": "-5"},
        headers=admin_headers,
    )

    assert response.status_code == 422


def test_variant_can_be_deleted(
    client: TestClient, admin_headers: dict, product_type: dict
) -> None:
    product = make_product(client, admin_headers, product_type["id"])
    variant = client.post(
        f"/api/admin/products/{product['id']}/variants",
        json={"name": "Temp"},
        headers=admin_headers,
    ).json()

    response = client.delete(
        f"/api/admin/variants/{variant['id']}", headers=admin_headers
    )

    assert response.status_code == 204
    listed = client.get(
        f"/api/admin/products/{product['id']}/variants", headers=admin_headers
    )
    assert listed.json() == []


# --- Plans -------------------------------------------------------------------


@pytest.mark.parametrize("frequency", ["DAILY", "WEEKLY", "MONTHLY", "YEARLY"])
def test_plan_supports_all_four_billing_frequencies(
    client: TestClient, admin_headers: dict, product_type: dict, frequency: str
) -> None:
    product = make_product(
        client, admin_headers, product_type["id"], name=f"P {frequency}"
    )

    response = make_plan(
        client,
        admin_headers,
        [product["id"]],
        name=f"Plan {frequency}",
        billing_frequency=frequency,
    )

    assert response.status_code == 201, response.text
    assert response.json()["billing_frequency"] == frequency


def test_unknown_billing_frequency_is_rejected(
    client: TestClient, admin_headers: dict, product_type: dict
) -> None:
    product = make_product(client, admin_headers, product_type["id"])

    response = make_plan(
        client, admin_headers, [product["id"]], billing_frequency="HOURLY"
    )

    assert response.status_code == 422


@pytest.mark.parametrize("minimum", [0, -1])
def test_minimum_quantity_must_be_positive(
    client: TestClient, admin_headers: dict, product_type: dict, minimum: int
) -> None:
    product = make_product(client, admin_headers, product_type["id"])

    response = make_plan(
        client, admin_headers, [product["id"]], minimum_quantity=minimum
    )

    assert response.status_code == 422


def test_availability_end_must_not_precede_start(
    client: TestClient, admin_headers: dict, product_type: dict
) -> None:
    product = make_product(client, admin_headers, product_type["id"])

    response = make_plan(
        client,
        admin_headers,
        [product["id"]],
        available_from=FUTURE,
        available_until=PAST,
    )

    assert response.status_code == 422


def test_plan_needs_at_least_one_product(
    client: TestClient, admin_headers: dict
) -> None:
    response = make_plan(client, admin_headers, [])

    assert response.status_code == 422


def test_archived_product_cannot_be_added_to_a_plan(
    client: TestClient, admin_headers: dict, product_type: dict
) -> None:
    product = make_product(client, admin_headers, product_type["id"])
    client.patch(
        f"/api/admin/products/{product['id']}",
        json={"status": "ARCHIVED"},
        headers=admin_headers,
    )

    response = make_plan(client, admin_headers, [product["id"]])

    assert response.status_code == 422


def test_plan_lifecycle_flags_are_stored(
    client: TestClient, admin_headers: dict, product_type: dict
) -> None:
    product = make_product(client, admin_headers, product_type["id"])

    plan = make_plan(
        client,
        admin_headers,
        [product["id"]],
        auto_close_on_expiry=True,
        allow_early_closure=True,
        allow_pause=True,
        allow_renewal=False,
    ).json()

    assert plan["auto_close_on_expiry"] is True
    assert plan["allow_early_closure"] is True
    assert plan["allow_pause"] is True
    assert plan["allow_renewal"] is False


def test_expired_plan_is_not_offerable(
    client: TestClient, admin_headers: dict, product_type: dict
) -> None:
    product = make_product(client, admin_headers, product_type["id"])
    make_plan(
        client,
        admin_headers,
        [product["id"]],
        name="Expired",
        available_from=PAST,
        available_until=(date.today() - timedelta(days=1)).isoformat(),
    )
    current = make_plan(client, admin_headers, [product["id"]], name="Current").json()

    offerable = client.get(
        "/api/admin/plans?offerable=true", headers=admin_headers
    ).json()

    assert [p["id"] for p in offerable["items"]] == [current["id"]]
    assert current["is_offerable"] is True


def test_future_plan_is_not_offerable_yet(
    client: TestClient, admin_headers: dict, product_type: dict
) -> None:
    product = make_product(client, admin_headers, product_type["id"])

    plan = make_plan(
        client,
        admin_headers,
        [product["id"]],
        available_from=FUTURE,
        available_until=None,
    ).json()

    assert plan["is_offerable"] is False


def test_inactive_plan_is_not_offerable(
    client: TestClient, admin_headers: dict, product_type: dict
) -> None:
    product = make_product(client, admin_headers, product_type["id"])
    plan = make_plan(client, admin_headers, [product["id"]]).json()

    archived = client.patch(
        f"/api/admin/plans/{plan['id']}",
        json={"status": "ARCHIVED"},
        headers=admin_headers,
    ).json()

    assert archived["status"] == "ARCHIVED"
    assert archived["is_offerable"] is False


def test_plan_can_be_edited_and_names_stay_unique(
    client: TestClient, admin_headers: dict, product_type: dict
) -> None:
    product = make_product(client, admin_headers, product_type["id"])
    make_plan(client, admin_headers, [product["id"]], name="Gold")
    silver = make_plan(client, admin_headers, [product["id"]], name="Silver").json()

    duplicate = client.patch(
        f"/api/admin/plans/{silver['id']}", json={"name": "gold"}, headers=admin_headers
    )
    edited = client.patch(
        f"/api/admin/plans/{silver['id']}",
        json={"price": "599", "allow_pause": True},
        headers=admin_headers,
    ).json()

    assert duplicate.status_code == 409
    assert edited["price"] == "599.00"
    assert edited["allow_pause"] is True


def test_plan_edit_cannot_break_the_availability_window(
    client: TestClient, admin_headers: dict, product_type: dict
) -> None:
    product = make_product(client, admin_headers, product_type["id"])
    plan = make_plan(client, admin_headers, [product["id"]]).json()

    response = client.patch(
        f"/api/admin/plans/{plan['id']}",
        json={
            "available_until": (
                date.fromisoformat(PAST) - timedelta(days=1)
            ).isoformat()
        },
        headers=admin_headers,
    )

    assert response.status_code == 422
