# ./backend/app/alembic/env.py (NEW - Asynchronous)
from logging.config import fileConfig
import asyncio # Import asyncio for async execution
from alembic import context
from sqlalchemy.ext.asyncio import create_async_engine # Import async engine creator
from app.core.config import settings # Import your settings to get the DB URI

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Interpret the config file for Python logging.
# This line sets up loggers basically.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# add your model's MetaData object here
# for 'autogenerate' support
from app.models import SQLModel # Import your SQLModel to get the metadata

target_metadata = SQLModel.metadata # Point Alembic to your SQLModel metadata

# other values from the config, defined by the needs of env.py,
# can be acquired:
# my_important_option = config.get_main_option("my_important_option")
# ... etc.

def get_url():
    """Get the database URL from settings."""
    return str(settings.SQLALCHEMY_DATABASE_URI)

def run_migrations_offline():
    """Run migrations in 'offline' mode.

    This configures the context with just a URL
    and not an Engine, though an Engine is acceptable
    here as well.  By skipping the Engine creation
    we don't even need a DBAPI to be available.

    Calls to context.execute() here emit the given string to the
    script output.

    """
    url = get_url()
    context.configure(
        url=url, target_metadata=target_metadata, literal_binds=True, compare_type=True
    )

    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection):
    """Configure the context and run migrations."""
    context.configure(connection=connection, target_metadata=target_metadata, compare_type=True)

    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online():
    """Run migrations in 'online' mode using async engine."""
    # Create the async engine using the same URI used by your main app
    connectable = create_async_engine(get_url())

    # Acquire an async connection
    async with connectable.connect() as connection:
        # Run the sync configuration and migrations within the async context
        # using connection.run_sync
        await connection.run_sync(do_run_migrations)

    # Dispose of the engine
    await connectable.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    # Run the async version using asyncio.run
    asyncio.run(run_migrations_online()) # NEW: Calls the async function
