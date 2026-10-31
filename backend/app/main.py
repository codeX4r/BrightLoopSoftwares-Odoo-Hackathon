from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api import api_router
from app.core.config import get_settings
from app.services.errors import BusinessRuleError

settings = get_settings()

app = FastAPI(title=settings.app_name)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(BusinessRuleError)
async def business_rule_error_handler(
    _request: Request, exc: BusinessRuleError
) -> JSONResponse:
    """Turns service-layer rule violations into {"detail": "..."} responses."""
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.message})


app.include_router(api_router)
