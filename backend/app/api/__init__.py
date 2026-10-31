"""API routes, grouped by who uses them.

/health, /api/auth/*   everyone (login, logout, session, customer signup)
/api/users/*           admin user management
/api/admin/*           admin catalog (product types, products, variants, plans)
                       and customer/staff accounts with billing figures
/api/admin/taxes|discounts|reports|settings, /api/admin/staff/{id}  admin modules
/api/company           company details for printed documents (any signed-in user)
/api/customers/{id}/profile  customer profile (admin, staff read, customer self)
/api/auth/password-reset/*   forgot password (public)
/api/staff/*           staff panel (app/api/routes/staff/), incl. /api/staff/taxes
/api/portal/*          customer portal (app/api/routes/portal/)
"""

from fastapi import APIRouter

from app.api.routes import (
    admin_modules,
    auth,
    catalog,
    company,
    health,
    people,
    portal,
    profiles,
    staff,
    users,
)

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(catalog.router)
api_router.include_router(people.router)
api_router.include_router(admin_modules.router)
api_router.include_router(company.router)
api_router.include_router(profiles.router)
api_router.include_router(staff.router)
api_router.include_router(portal.router)
