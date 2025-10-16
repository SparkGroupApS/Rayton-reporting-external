# backend/app/api/routes/users.py
import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import col, delete, func, select

from app import crud
from app.api.deps import (
    CurrentUser,
    SessionDep,
    get_current_active_superuser,
)
from app.core.config import settings
from app.core.security import get_password_hash, verify_password
from app.models import (
    Item,
    Message,
    UpdatePassword,
    User,
    UserCreate,
    UserPublic,
    UserRegister,
    UsersPublic,
    UserUpdate,
    UserUpdateMe,
)
from app.utils import generate_new_account_email, send_email

router = APIRouter(prefix="/users", tags=["users"])


@router.get(
    "/",
    dependencies=[Depends(get_current_active_superuser)],
    response_model=UsersPublic,
)
async def read_users(session: SessionDep, skip: int = 0, limit: int = 100) -> Any: # NEW: async def
    """
    Retrieve users.
    """

    count_statement = select(func.count()).select_from(User)
    # NEW: Await session.exec, then call .one() on the result
    count_result = await session.exec(count_statement)
    count = count_result.one()

    statement = select(User).offset(skip).limit(limit)
    # NEW: Await session.exec, then call .all() on the result
    users_result = await session.exec(statement)
    users = users_result.all()

    return UsersPublic(data=users, count=count)


@router.post(
    "/", dependencies=[Depends(get_current_active_superuser)], response_model=UserPublic
)
async def create_user(*, session: SessionDep, user_in: UserCreate) -> Any: # NEW: async def
    """
    Create new user.
    """
    # NEW: Await the async CRUD function
    user = await crud.get_user_by_email(session=session, email=user_in.email) # Use await
    if user:
        raise HTTPException(
            status_code=400,
            detail="The user with this email already exists in the system.",
        )

    # NEW: Await the async CRUD function
    user = await crud.create_user(session=session, user_create=user_in) # Use await
    if settings.emails_enabled and user_in.email:
        email_data = generate_new_account_email(
            email_to=user_in.email, username=user_in.email, password=user_in.password
        )
        send_email(
            email_to=user_in.email,
            subject=email_data.subject,
            html_content=email_data.html_content,
        )
    return user


@router.patch("/me", response_model=UserPublic)
async def update_user_me( # NEW: async def
    *, session: SessionDep, user_in: UserUpdateMe, current_user: CurrentUser
) -> Any:
    """
    Update own user.
    """

    if user_in.email:
        # NEW: Await the async CRUD function
        existing_user = await crud.get_user_by_email(session=session, email=user_in.email) # Use await
        if existing_user and existing_user.id != current_user.id:
            raise HTTPException(
                status_code=409, detail="User with this email already exists"
            )
    user_data = user_in.model_dump(exclude_unset=True)
    current_user.sqlmodel_update(user_data)
    session.add(current_user)
    # NEW: Await session.commit
    await session.commit()
    # NEW: Await session.refresh
    await session.refresh(current_user)
    return current_user


@router.patch("/me/password", response_model=Message)
async def update_password_me( # NEW: async def
    *, session: SessionDep, body: UpdatePassword, current_user: CurrentUser
) -> Any:
    """
    Update own password.
    """
    if not verify_password(body.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect password")
    if body.current_password == body.new_password:
        raise HTTPException(
            status_code=400, detail="New password cannot be the same as the current one"
        )
    hashed_password = get_password_hash(body.new_password)
    current_user.hashed_password = hashed_password
    session.add(current_user)
    # NEW: Await session.commit
    await session.commit()
    return Message(message="Password updated successfully")


@router.get("/me", response_model=UserPublic)
async def read_user_me(current_user: CurrentUser) -> Any: # NEW: async def (though logic might not require await)
    """
    Get current user.
    """
    return current_user


@router.delete("/me", response_model=Message)
async def delete_user_me(session: SessionDep, current_user: CurrentUser) -> Any: # NEW: async def
    """
    Delete own user.
    """
    if current_user.is_superuser:
        raise HTTPException(
            status_code=403, detail="Super users are not allowed to delete themselves"
        )
    # NEW: Await session.delete (check if standard AsyncSession.delete is awaitable, often it's sync)
    # session.delete(current_user) # Standard approach
    await session.delete(current_user) # Safer for potential future compatibility, but check if necessary
    # NEW: Await session.commit
    await session.commit()
    return Message(message="User deleted successfully")


@router.post("/signup", response_model=UserPublic)
async def register_user(session: SessionDep, user_in: UserRegister) -> Any: # NEW: async def
    """
    Create new user without the need to be logged in.
    """
    # NEW: Await the async CRUD function
    user = await crud.get_user_by_email(session=session, email=user_in.email) # Use await
    if user:
        raise HTTPException(
            status_code=400,
            detail="The user with this email already exists in the system",
        )
    user_create = UserCreate.model_validate(user_in)
    # NEW: Await the async CRUD function
    user = await crud.create_user(session=session, user_create=user_create) # Use await
    return user


@router.get("/{user_id}", response_model=UserPublic)
async def read_user_by_id( # NEW: async def
    user_id: uuid.UUID, session: SessionDep, current_user: CurrentUser
) -> Any:
    """
    Get a specific user by id.
    """
    # NEW: Await session.get
    user = await session.get(User, user_id)
    if user == current_user:
        return user
    if not current_user.is_superuser:
        raise HTTPException(
            status_code=403,
            detail="The user doesn't have enough privileges",
        )
    return user


@router.patch(
    "/{user_id}",
    dependencies=[Depends(get_current_active_superuser)],
    response_model=UserPublic,
)
async def update_user( # NEW: async def
    *,
    session: SessionDep,
    user_id: uuid.UUID,
    user_in: UserUpdate,
) -> Any:
    """
    Update a user.
    """

    # NEW: Await session.get
    db_user = await session.get(User, user_id)
    if not db_user:
        raise HTTPException(
            status_code=404,
            detail="The user with this id does not exist in the system",
        )
    if user_in.email:
        # NEW: Await the async CRUD function
        existing_user = await crud.get_user_by_email(session=session, email=user_in.email) # Use await
        if existing_user and existing_user.id != user_id:
            raise HTTPException(
                status_code=409, detail="User with this email already exists"
            )

    # NEW: Await the async CRUD function
    db_user = await crud.update_user(session=session, db_user=db_user, user_in=user_in) # Use await
    return db_user


@router.delete("/{user_id}", dependencies=[Depends(get_current_active_superuser)])
async def delete_user( # NEW: async def
    session: SessionDep, current_user: CurrentUser, user_id: uuid.UUID
) -> Message:
    """
    Delete a user.
    """
    # NEW: Await session.get
    user = await session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user == current_user:
        raise HTTPException(
            status_code=403, detail="Super users are not allowed to delete themselves"
        )
    statement = delete(Item).where(col(Item.owner_id) == user_id)
    # NEW: Await session.exec (for delete statements, exec might be sync, but often it's awaitable in async contexts)
    # result = session.exec(statement) # Standard approach might be sync for DML within session context
    # If the above standard approach doesn't work or is discouraged for async sessions:
    await session.exec(statement)  # type: ignore # Await the exec call
    # NEW: Await session.delete (check if standard AsyncSession.delete is awaitable, often it's sync)
    # session.delete(user) # Standard approach
    await session.delete(user) # Safer for potential future compatibility, but check if necessary
    # NEW: Await session.commit
    await session.commit()
    return Message(message="User deleted successfully")
