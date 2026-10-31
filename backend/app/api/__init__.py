"""API routes, grouped by who uses them.

/health, /api/auth/*   everyone (login, logout, session, customer signup)
/api/users/*           admin user management
/api/admin/*           admin catalog: product types, products, variants, plans
/api/staff/*           staff panel (app/api/routes/staff/)
/api/portal/*          customer portal (app/api/routes/portal/)
"""

from fastapi import APIRouter

from app.api.routes import auth, catalog, health, portal, staff, users

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(catalog.router)
api_router.include_router(staff.router)
api_router.include_router(portal.router)
