# app/main.py
import sentry_sdk
from fastapi import FastAPI
from fastapi.routing import APIRoute
from starlette.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from fastapi_mqtt import FastMQTT, MQTTConfig  # Import MQTT

from app.api.main import api_router
from app.core.config import settings
from app.core.mqtt import mqtt_config  # Import the MQTTConfig instance
from app.core.mqtt import mqtt
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

# NEW WAY (correct):
# Get the MQTTConfig instance from settings
mqtt_config: 'MQTTConfig' = mqtt_config # Type hint is optional but helpful

# Initialize the FastMQTT instance with the Pydantic model instance
mqtt = FastMQTT(config=mqtt_config) # This should now work correctly
# --- END MQTT Configuration ---


def custom_generate_unique_id(route: APIRoute) -> str:
    return f"{route.tags[0]}-{route.name}"


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Code executed during startup
    logger.info("Initializing database...")
    await init_db()  # <--- Ensure this calls the ASYNC init_db and uses 'await'
    logger.info("Database initialization attempted.")

    # --- Initialize MQTT ---
    logger.info("Initializing MQTT...")
    try:
        # Initialize the MQTT client with the FastAPI app
        await mqtt.init_app(app)  # Use await if init_app is async
        logger.info("MQTT initialized successfully.")
        # Store the mqtt instance in app.state for dependency injection
        # You might store `mqtt` itself or `mqtt.client` depending on what you need to call
        app.state.mqtt_client = mqtt  # Store the FastMQTT instance
        # OR if you need the underlying paho/asyncio client:
        # app.state.mqtt_client = mqtt.client # Check fastapi-mqtt docs for the correct attribute
    except Exception as e:
        logger.error(f"Failed to initialize MQTT: {e}")
        # Depending on requirements, you might want to stop startup here
        # raise e # Re-raise to prevent app startup if MQTT is critical

    logger.info("Application startup complete.")

    yield  # Application runs
    # Code executed during shutdown
    logger.info("Disconnecting from MQTT broker...")
    #await mqtt.disconnect()  # <-- Add disconnect

    logger.info("Shutting down...")
    await async_engine.dispose()  # Optionally dispose the engine on shutdown
    logger.info("Database engine disposed.")


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
