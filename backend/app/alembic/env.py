# ./backend/app/alembic/env.py
from logging.config import fileConfig
import asyncio
from alembic import context
from sqlalchemy.ext.asyncio import create_async_engine
from app.core.config import settings

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Import ALL models to ensure they're registered
from app.models import (
    SQLModel, 
    external_metadata,
    # Explicitly import external models to ensure they're loaded
    ClassList,
    ElectricityCost,
    PlantConfig,
    PlantList,
    PlcDataHistorical,
    PlcDataRealtime,
    Schedule,
    TextList,
)

target_metadata = SQLModel.metadata

# Explicitly list external table names that should be EXCLUDED from Alembic
EXTERNAL_TABLE_NAMES = {
    'CLASS_LIST',
    'ELECTRICITY_COST',
    'PLANT_CONFIG',
    'PLANT_LIST',
    'PLC_DATA_HISTORICAL',
    'PLC_DATA_REALTIME',
    'SCHEDULE',
    'TEXT_LIST',
}

def include_object(object, name, type_, reflected, compare_to):
    """
    Filter callback - return False to ignore an object.
    This prevents Alembic from generating migrations for external tables.
    """
    if type_ == "table" and name in EXTERNAL_TABLE_NAMES:
        return False
    return True

def get_url():
    """Get the database URL from settings."""
    return str(settings.SQLALCHEMY_DATABASE_URI)

def run_migrations_offline():
    """Run migrations in 'offline' mode."""
    url = get_url()
    context.configure(
        url=url, 
        target_metadata=target_metadata, 
        literal_binds=True, 
        compare_type=True,
        include_object=include_object
    )

    with context.begin_transaction():
        context.run_migrations()

def do_run_migrations(connection):
    """Configure the context and run migrations."""
    context.configure(
        connection=connection, 
        target_metadata=target_metadata, 
        compare_type=True,
        include_object=include_object
    )

    with context.begin_transaction():
        context.run_migrations()

async def run_migrations_online():
    """Run migrations in 'online' mode using async engine."""
    connectable = create_async_engine(get_url())

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()

if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())