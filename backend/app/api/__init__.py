"""API routes, grouped by who uses them.

/health, /api/auth/*   everyone (login, logout, session)
/api/users/*           admin user management
/api/staff/*           staff panel (app/api/routes/staff/)
/api/portal/*          customer portal (app/api/routes/portal/)
"""

from fastapi import APIRouter

from app.api.routes import auth, health, portal, staff, users

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(staff.router)
api_router.include_router(portal.router)
