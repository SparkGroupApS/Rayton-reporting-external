# app/api/deps.py
import uuid  # NEW: Import uuid module
from collections.abc import (
    AsyncGenerator,  # NEW: Use AsyncGenerator for async dependencies
)
from typing import Annotated

import jwt
from fastapi import Request, Depends, HTTPException, status
from fastapi_mqtt import FastMQTT # Or whatever type your mqtt client is
from fastapi.security import OAuth2PasswordBearer
from jwt.exceptions import InvalidTokenError
from pydantic import ValidationError

# Remove: from sqlmodel import Session # OLD: Remove sync Session import
from sqlmodel.ext.asyncio.session import AsyncSession  # NEW: Import AsyncSession

from app.core import security
from app.core.config import settings

# Remove: from app.core.db import engine # OLD: Remove engine import
from app.core.db import get_async_session  # NEW: Import your async session generator
from app.models import TokenPayload, User

reusable_oauth2 = OAuth2PasswordBearer(
    tokenUrl=f"{settings.API_V1_STR}/login/access-token"
)

# This function *is* the dependency that yields AsyncSession
# It receives the AsyncSession from the 'get_async_session' generator via Depends
async def get_async_db(session: AsyncSession = Depends(get_async_session)) -> AsyncGenerator[AsyncSession, None]:
    # The 'session' object is already provided by the 'get_async_session' dependency via 'Depends'.
    # The 'get_async_session' function (defined in db.py) handles the 'async with async_sessionmaker() as session' part.
    yield session # Yield the session provided by the inner dependency

# Update the dependency type alias
SessionDep = Annotated[AsyncSession, Depends(get_async_db)] # Uses AsyncSession and the new dependency
TokenDep = Annotated[str, Depends(reusable_oauth2)]

# Update the get_current_user function to use AsyncSession
async def get_current_user(session: SessionDep, token: TokenDep) -> User: # NEW: async def
    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[security.ALGORITHM]
        )
        token_data = TokenPayload(**payload)
    except (InvalidTokenError, ValidationError):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Could not validate credentials",
        )

    # NEW: Convert token_data.sub (string) to uuid.UUID object
    # This ensures the type passed to session.get matches the model definition expectation
    # even if the underlying DB column is CHAR(32).
    try:
        user_id_as_uuid = uuid.UUID(token_data.sub)
    except ValueError:
        # If token_data.sub is not a valid UUID string, it's an invalid token
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid user ID in token",
        )

    # NEW: Use the uuid.UUID object with session.get
    user = await session.get(User, user_id_as_uuid) # Use await and the uuid.UUID object
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return user

# Update the dependency type alias for current user
CurrentUser = Annotated[User, Depends(get_current_user)] # This should now point to the async version

async def get_current_active_superuser(current_user: CurrentUser) -> User: # NEW: async def (though logic might not require await)
    if not current_user.is_superuser:
        raise HTTPException(
            status_code=403, detail="The user doesn't have enough privileges"
        )
    return current_user

def get_mqtt_client(request: Request) -> FastMQTT:
    """Dependency to get MQTT client from app state"""
    mqtt_client = request.app.state.mqtt_client
    
    if mqtt_client is None:
        raise HTTPException(
            status_code=503, 
            detail="MQTT service unavailable"
        )
    
    return mqtt_client

# Type alias for dependency injection
MQTTClient = Annotated[FastMQTT, Depends(get_mqtt_client)]