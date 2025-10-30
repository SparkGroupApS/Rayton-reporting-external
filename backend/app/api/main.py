from fastapi import APIRouter

from app.api.routes import (
    dashboard,
    historical_data,
    items,
    login,
    private,
    schedule,
    tenants,
    users,
    utils,
)
from app.core.config import settings

api_router = APIRouter()
api_router.include_router(login.router)
api_router.include_router(users.router)
api_router.include_router(utils.router)
api_router.include_router(items.router)
api_router.include_router(tenants.router)
api_router.include_router(dashboard.router)
api_router.include_router(historical_data.router)
api_router.include_router(schedule.router)

if settings.ENVIRONMENT == "local":
    api_router.include_router(private.router)
