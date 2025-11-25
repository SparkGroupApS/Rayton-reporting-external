# app/main.py
import asyncio
import logging
from contextlib import asynccontextmanager

import sentry_sdk
from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware

from app.api.main import api_router

# Import WebSocket router
from app.api.routes.websocket import router as websocket_router
from app.core.config import settings
from app.core.db import async_engine, init_db
from app.mqtt_handlers import mqtt  # Import the FastMQTT instance

# Configure logging
logger = logging.getLogger(__name__)


# def custom_generate_unique_id(route: APIRoute) -> str:
#    return f"{route.tags[0]}-{route.name}"


#    Проверять наличие тегов:
def custom_generate_unique_id(route):
    tag = route.tags[0] if route.tags else "default"
    return f"{tag}-{route.name}"


@asynccontextmanager
async def lifespan(app: FastAPI):
    # --- Startup ---
    logger.info("Starting up application...")
    try:
        logger.info("Initializing database...")
        await init_db()  # Ensure init_db is async and awaited
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

    # 1. Shutdown MQTT with Timeout
    try:
        logger.info("Disconnecting MQTT...")
        await asyncio.wait_for(mqtt.mqtt_shutdown(), timeout=3.0)
        logger.info("MQTT disconnected gracefully.")
    except asyncio.TimeoutError:
        logger.warning("⚠️ MQTT shutdown timed out. Forcing.")
    except Exception as e:
        logger.error(f"Error disconnecting MQTT: {e}")

    # 2. Dispose database
    try:
        logger.info("Disposing database connection...")
        await async_engine.dispose()
        logger.info("Database connection disposed.")
    except Exception as e:
        logger.error(f"Error disposing database: {e}")

    # 3. Force Cancel Pending Tasks (The Fix for Hanging Process)
    # This cancels any background loops (like MQTT reconnects) that are keeping the process alive.
    try:
        current_task = asyncio.current_task()
        tasks = [t for t in asyncio.all_tasks() if t is not current_task]

        if tasks:
            logger.info(f"Cancelling {len(tasks)} pending background tasks...")
            for task in tasks:
                task.cancel()

            # Wait briefly for tasks to acknowledge cancellation,
            # but protect against the wait itself being cancelled.
            try:
                await asyncio.wait(tasks, timeout=1.0)
            except asyncio.CancelledError:
                logger.debug(
                    "asyncio.wait() was cancelled during shutdown — proceeding."
                )
            logger.info("Background tasks cancellation initiated.")
    except Exception as e:
        logger.exception("Error while cancelling background tasks: %s", e)

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
