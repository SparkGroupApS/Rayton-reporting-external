# app/main.py
import sentry_sdk
from fastapi import FastAPI
from fastapi.routing import APIRoute
from starlette.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import asyncio
import logging

from app.api.main import api_router
from app.core.config import settings
from app.mqtt_handlers import mqtt  # Import the FastMQTT instance
from app.core.db import init_db, async_engine

# Import WebSocket router
from app.api.routes.websocket import router as websocket_router

# Configure logging
logger = logging.getLogger(__name__)


def custom_generate_unique_id(route: APIRoute) -> str:
    return f"{route.tags[0]}-{route.name}"


@asynccontextmanager
async def lifespan(app: FastAPI):
    # --- Startup ---
    logger.info("Starting up application...")
    try:
        logger.info("Initializing database...")
        await init_db() # Ensure init_db is async and awaited
        logger.info("Database initialized successfully.")
    except Exception as e:
        logger.error(f"Failed to initialize database: {e}")
        # Decide if this should prevent startup

    # --- Initialize MQTT using mqtt_startup() ---
    logger.info("Initializing MQTT...")
    try:
        await mqtt.mqtt_startup()  # ← Use mqtt_startup() instead of init_app()
        logger.info("✅ MQTT connected successfully!")

        # ← ADD THIS: Store mqtt in app.state
        app.state.mqtt_client = mqtt

    except Exception as e:
        logger.warning(f"⚠️  MQTT connection failed: {e}")
        logger.warning("⚠️  Application will continue without MQTT functionality")
        app.state.mqtt_client = None  # Set to None if connection fails

    logger.info("Application startup complete.")
    yield

    # --- Shutdown ---
    logger.info("Shutting down application...")

    # Shutdown MQTT
    try:
        await mqtt.mqtt_shutdown()
        logger.info("MQTT disconnected.")
    except Exception as e:
        logger.error(f"Error disconnecting MQTT: {e}")

    # Dispose database
    await async_engine.dispose()
    logger.info("Application shutdown complete.")


if settings.SENTRY_DSN and settings.ENVIRONMENT != "local":
    sentry_sdk.init(dsn=str(settings.SENTRY_DSN), enable_tracing=True)

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    generate_unique_id_function=custom_generate_unique_id,
    lifespan=lifespan,  # <--- Ensure the lifespan event handler is attached here
)

# Set all CORS enabled origins
if settings.all_cors_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.all_cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

app.include_router(api_router, prefix=settings.API_V1_STR)

# Include WebSocket routes
app.include_router(websocket_router, prefix=settings.API_V1_STR)
