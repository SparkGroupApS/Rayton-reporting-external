from fastapi import APIRouter

from app.api.routes import (
    dashboard,
    electricity_cost,
    historical_data,
    items,
    login,
    plant_config,
    plants,
    plc_control,
    plc_data_settings,
    private,
    realtime_data,
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
api_router.include_router(electricity_cost.router)
api_router.include_router(plants.router)
api_router.include_router(realtime_data.router)
api_router.include_router(plant_config.router)
api_router.include_router(plc_data_settings.router)
api_router.include_router(plc_control.router)

if settings.ENVIRONMENT == "local":
    api_router.include_router(private.router)
