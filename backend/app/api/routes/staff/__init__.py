"""Staff panel API, mounted at /api/staff. Owner: staff-section developer.

Every route requires a STAFF (or ADMIN) account; see app.api.permissions.
"""

from fastapi import APIRouter

from app.api.routes.staff import customers, dashboard, invoices, payments, subscriptions

router = APIRouter(prefix="/api/staff")
router.include_router(dashboard.router)
router.include_router(customers.router)
router.include_router(subscriptions.router)
router.include_router(invoices.router)
router.include_router(payments.router)
