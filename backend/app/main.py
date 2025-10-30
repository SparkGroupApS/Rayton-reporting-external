# app/main.py
import sentry_sdk
from fastapi import FastAPI
from fastapi.routing import APIRoute
from starlette.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from fastapi_mqtt import FastMQTT, MQTTConfig  # Import MQTT

from app.api.main import api_router
from app.core.config import settings
#from app.core.mqtt import mqtt_config  # Import the MQTTConfig instance
from app.mqtt_handlers import mqtt
# from app.core.mqtt import mqtt
# Import the MQTTConfig model if needed for type hints (optional but good practice)
# from app.core.mqtt import MQTTConfig
from app.core.db import init_db, async_engine
import logging

logger = logging.getLogger(__name__)

# --- MQTT Configuration ---
# Use the settings.mqtt_config property which returns an MQTTConfig Pydantic model instance
# OLD WAY (causing the error):
# mqtt_config = {
#     "broker": settings.MQTT_BROKER,
#     "port": settings.MQTT_PORT,
#     "username": settings.MQTT_USERNAME,
#     "password": settings.MQTT_PASSWORD,
#     "client_id": settings.MQTT_CLIENT_ID,
#     # ... other settings as dict items ...
# }

# # NEW WAY (correct):
# # Get the MQTTConfig instance from settings
# mqtt_config: 'MQTTConfig' = mqtt_config # Type hint is optional but helpful

# # Initialize the FastMQTT instance with the Pydantic model instance
# mqtt = FastMQTT(config=mqtt_config) # This should now work correctly
# # --- END MQTT Configuration ---


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

    # --- Initialize MQTT ---
    logger.info("Initializing MQTT...")
    try:
        # Initialize the MQTT client with the FastAPI app
        # Use the imported 'mqtt' instance (which is a FastMQTT object)
        # The 'init_app' method registers internal startup/shutdown handlers
        mqtt.init_app(app) # Call WITHOUT 'await' - it configures, doesn't return an awaitable
        logger.info("MQTT initialized successfully (handlers registered).")
        # Store the mqtt instance in app.state if other parts need it via DI
        # app.state.mqtt_client = mqtt # Example
    except Exception as e:
        logger.error(f"Failed to initialize MQTT: {e}")
        # Decide if this should prevent startup if MQTT is critical

    logger.info("Application startup complete.")
    yield # Application runs
    # --- Shutdown ---
    logger.info("Shutting down application...")
    # Perform any necessary cleanup
    # FastMQTT's internal shutdown handler (registered by init_app) should handle MQTT disconnection
    await async_engine.dispose() # Dispose DB engine if needed
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
