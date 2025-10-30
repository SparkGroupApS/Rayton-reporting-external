# app/main.py
import logging
from contextlib import asynccontextmanager  # Import asynccontextmanager

import sentry_sdk
from fastapi import FastAPI
from fastapi.routing import APIRoute
from starlette.middleware.cors import CORSMiddleware

from app.api.main import api_router
from app.core.config import settings

# Import your init_db function from db.py
from app.core.db import async_engine, init_db  # Import async_engine for shutdown too

logger = logging.getLogger(__name__)

def custom_generate_unique_id(route: APIRoute) -> str:
    return f"{route.tags[0]}-{route.name}"


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Code executed during startup
    logger.info("Initializing database...")
    await init_db() # <--- Ensure this calls the ASYNC init_db and uses 'await'
    logger.info("Database initialization attempted.")
    yield # Application runs
    # Code executed during shutdown
    logger.info("Shutting down...")
    await async_engine.dispose() # Optionally dispose the engine on shutdown
    logger.info("Database engine disposed.")


if settings.SENTRY_DSN and settings.ENVIRONMENT != "local":
    sentry_sdk.init(dsn=str(settings.SENTRY_DSN), enable_tracing=True)

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    generate_unique_id_function=custom_generate_unique_id,
    lifespan=lifespan, # <--- Ensure the lifespan event handler is attached here
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
