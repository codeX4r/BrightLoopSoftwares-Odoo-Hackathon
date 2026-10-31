"""Customer portal API, mounted at /api/portal (the frontend's /portal area).

Every route requires a CUSTOMER account and only returns that customer's own records.

billing.py exposes staff-owned data (subscriptions, invoices) to customers. It was
written by the staff-section developer; the customer-portal developer builds the pages
that call it and owns any other portal routes added here.
"""

from fastapi import APIRouter

from app.api.routes.portal import billing, profile

router = APIRouter(prefix="/api/portal")
router.include_router(billing.router)
router.include_router(profile.router)
