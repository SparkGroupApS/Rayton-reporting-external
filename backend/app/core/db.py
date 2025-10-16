# app/core/db.py (or wherever engine/session is defined)
from sqlmodel import SQLModel # Keep if defining models here or importing them
from sqlmodel.ext.asyncio.session import AsyncSession # Import AsyncSession
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker # Import async engine and sessionmaker
from app.core.config import settings
from collections.abc import AsyncGenerator

# Create the async engine
# Use the URI from your updated config.py
# The scheme in your config.py (e.g., "mariadb+asyncmy://...") tells SQLAlchemy which async driver to use.
async_engine = create_async_engine(
    str(settings.SQLALCHEMY_DATABASE_URI),
    # echo=True, # Optional: for debugging SQL queries
)

# Create an async sessionmaker
AsyncSessionLocal = async_sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=async_engine,
    class_=AsyncSession, # Use AsyncSession
)

# The init_db function might also need to be async if it performs DB operations
# and uses the session
async def init_db() -> None:
    async with async_engine.begin() as conn:
        # If you need to create tables (not recommended for production, use Alembic)
        # await conn.run_sync(SQLModel.metadata.create_all)

        # Example of creating a superuser (adapt this logic)
        from app.models import User # Import your models
        from app import crud # Import your CRUD functions (these might also need async updates)
        from sqlmodel import select

        async with AsyncSessionLocal() as session: # Use AsyncSession
            # Use await session.exec(...) instead of session.exec(...)
            user = await session.exec(select(User).where(User.email == settings.FIRST_SUPERUSER))
            user = user.first()
            if not user:
                from app.models import UserCreate # Import schemas if needed
                user_in = UserCreate(
                    email=settings.FIRST_SUPERUSER,
                    password=settings.FIRST_SUPERUSER_PASSWORD,
                    is_superuser=True,
                )
                # Assuming your crud.create_user is updated to be async
                user = await crud.create_user(session=session, user_create=user_in) # Use await
                await session.commit() # Use await
                await session.refresh(user) # Use await if needed

# NEW: Correctly type the async generator function
async def get_async_session() -> AsyncGenerator[AsyncSession, None]: # Use AsyncGenerator[TypeYielded, SendType]
    async with AsyncSessionLocal() as session:
        yield session # Yield the session provided by the inner dependency

# Remember to update your Alembic configuration (alembic.ini or alembic/env.py)
# to use the async engine if you are using migrations.
# This often involves setting target_metadata = SQLModel.metadata
# and using the async engine in env.py.