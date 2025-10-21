import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status, Query # Import Query
from sqlmodel import col, delete, func, select

from app import crud
from app.api.deps import (
    CurrentUser,
    SessionDep,
    get_current_active_superuser,
)
from app.core.config import settings
from app.core.security import get_password_hash, verify_password
# Import Tenant models needed for user creation/association
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
    TenantCreate, # Import TenantCreate for registration example
    Tenant,       # Import Tenant
)
from app.utils import generate_new_account_email, send_email

#router = APIRouter(tags=["users"])
router = APIRouter(prefix="/users", tags=["users"])

@router.get(
    "/",
    dependencies=[Depends(get_current_active_superuser)],
    response_model=UsersPublic,
)
async def read_users(
    session: SessionDep, 
    current_user: CurrentUser, 
    skip: int = 0, 
    limit: int = 100,
    # --- NEW Query Parameters for Superusers ---
    tenant_id: uuid.UUID | None = Query(default=None, description="Filter by specific tenant ID (Superuser only)"),
    all_tenants: bool = Query(default=False, description="Fetch users from all tenants (Superuser only)")
    # --- End New Parameters ---
) -> Any:
    """
    Retrieve users. Superusers default to their own tenant, 
    but can specify a tenant_id or request all_tenants.
    """
    count_query = select(func.count()).select_from(User)
    users_query = select(User).offset(skip).limit(limit)

    # Apply Tenant Filtering
    if current_user.is_superuser:
        if all_tenants:
            # No additional filtering needed
            pass 
        elif tenant_id:
            # Filter by the specified tenant_id
            tenant_filter = (col(User.tenant_id) == tenant_id)
            count_query = count_query.where(tenant_filter)
            users_query = users_query.where(tenant_filter)
        else:
            # Superuser default: Filter by their own tenant
            tenant_filter = (col(User.tenant_id) == current_user.tenant_id)
            count_query = count_query.where(tenant_filter)
            users_query = users_query.where(tenant_filter)
    else:
        # Should not happen due to dependency, but defensive coding:
        # Regular users ONLY see their own tenant (enforced by dependency/other logic ideally)
        # This endpoint is superuser-only anyway.
         raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    # Execute queries
    count_result = await session.exec(count_query)
    count = count_result.one()
    
    users_result = await session.exec(users_query)
    users = users_result.all()

    return UsersPublic(data=users, count=count)


# Modify the UserCreate model (in models.py) first if you want strict validation
# Or add tenant_id directly to the endpoint function parameters/body

# Add tenant_id to UserCreate in models.py if not already done via schema update
# class UserCreate(UserBase):
#     password: str = Field(min_length=8, max_length=40)
#     tenant_id: uuid.UUID # Add this line to models.py if needed

# Then modify the endpoint:

@router.post(
    "/", 
    dependencies=[Depends(get_current_active_superuser)], 
    response_model=UserPublic
)
async def create_user(
    *, 
    session: SessionDep, 
    user_in: UserCreate, # Assuming UserCreate now includes tenant_id
    # current_user: CurrentUser # No longer needed directly if tenant_id is in user_in
) -> Any: 
    """
    Create new user (by superuser). Requires tenant_id in the input.
    """
    # Check if user email already exists
    user = await crud.get_user_by_email(session=session, email=user_in.email) 
    if user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The user with this email already exists in the system.",
        )
        
    # Check if the specified tenant exists
    tenant = await crud.get_tenant_by_id(session=session, tenant_id=user_in.tenant_id)
    if not tenant:
         raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Tenant with id {user_in.tenant_id} not found.",
        )

    # Use the modified crud function, passing the tenant_id from input
    # Note: crud.create_user already expects tenant_id as an argument now
    user = await crud.create_user(
        session=session, 
        user_create=user_in, 
        tenant_id=user_in.tenant_id # Use the ID from the request
    ) 
    
    # Email sending logic remains the same...
    if settings.emails_enabled and user_in.email:
        # ... (email sending code) ...
        pass
    return user


# --- Routes operating on the Current User (/me) ---
# These generally don't need explicit tenant checks because the user object is already scoped.

@router.patch("/me", response_model=UserPublic)
async def update_user_me( 
    *, session: SessionDep, user_in: UserUpdateMe, current_user: CurrentUser
) -> Any:
    """
    Update own user. (Tenant ID cannot be changed here).
    """
    if user_in.email:
        existing_user = await crud.get_user_by_email(session=session, email=user_in.email) 
        if existing_user and existing_user.id != current_user.id:
            # Check if the conflicting user is in the *same tenant* - might be relevant
            if existing_user.tenant_id == current_user.tenant_id:
                 raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT, 
                    detail="Another user in your tenant already has this email."
                )
            # If in another tenant, maybe allow it depending on rules, or still forbid globally?
            # For simplicity, let's forbid globally for now.
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT, detail="User with this email already exists"
            )
            
    # Use the model's update method - crud.update_user prevents tenant_id change
    user_data = user_in.model_dump(exclude_unset=True)
    current_user.sqlmodel_update(user_data) 
    session.add(current_user)
    await session.commit()
    await session.refresh(current_user)
    return current_user


@router.patch("/me/password", response_model=Message)
async def update_password_me( 
    *, session: SessionDep, body: UpdatePassword, current_user: CurrentUser
) -> Any:
    """ Update own password. """
    # No tenant logic needed here
    if not verify_password(body.current_password, current_user.hashed_password):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Incorrect password")
    if body.current_password == body.new_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="New password cannot be the same as the current one"
        )
    hashed_password = get_password_hash(body.new_password)
    current_user.hashed_password = hashed_password
    session.add(current_user)
    await session.commit()
    return Message(message="Password updated successfully")


@router.get("/me", response_model=UserPublic)
async def read_user_me(current_user: CurrentUser) -> Any: 
    """ Get current user. """
    # No tenant logic needed here
    return current_user


@router.delete("/me", response_model=Message)
async def delete_user_me(session: SessionDep, current_user: CurrentUser) -> Any: 
    """ Delete own user. """
    # Need to consider: What happens to items owned by this user?
    # cascade_delete=True on User->Item relationship handles DB cleanup.
    # What if this is the *last* user in a tenant? Should the tenant be deleted? (Business logic)
    
    if current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Super users are not allowed to delete themselves"
        )
        
    # Cascade delete should handle items due to relationship setting in models.py
    await session.delete(current_user) 
    await session.commit()
    # TODO: Add logic here to check if the tenant is now empty and potentially delete it or mark inactive.
    return Message(message="User deleted successfully")


# --- Public Registration ---
# @router.post("/signup", response_model=UserPublic)
# async def register_user(session: SessionDep, user_in: UserRegister) -> Any: 
#     """
#     Create new user without the need to be logged in.
#     **TENANCY STRATEGY NEEDED HERE**.
#     Example: Creates a *new tenant* for each registered user. Adjust as needed.
#     """
#     user = await crud.get_user_by_email(session=session, email=user_in.email) 
#     if user:
#         raise HTTPException(
#             status_code=status.HTTP_400_BAD_REQUEST,
#             detail="The user with this email already exists in the system",
#         )
        
#     # --- Example Strategy: Create a new tenant for this user ---
#     # You might want a different strategy (e.g., assign to default, require invite code)
#     new_tenant_name = f"Tenant for {user_in.email}" # Or generate a unique name
#     tenant_create = TenantCreate(name=new_tenant_name, description=f"Auto-created tenant for {user_in.email}")
#     new_tenant = await crud.create_tenant(session=session, tenant_create=tenant_create)
#     # --- End Example Strategy ---

#     user_create = UserCreate.model_validate(user_in)
#     # Use the modified crud function, assigning the determined tenant_id
#     user = await crud.create_user(
#         session=session, 
#         user_create=user_create, 
#         tenant_id=new_tenant.id # Assign the newly created tenant's ID
#     ) 
    return user


# --- Admin operations on specific users ---

@router.get("/{user_id}", response_model=UserPublic)
async def read_user_by_id( 
    user_id: uuid.UUID, session: SessionDep, current_user: CurrentUser
) -> Any:
    """
    Get a specific user by id. Requires superuser or user in the same tenant.
    """
    user = await session.get(User, user_id)
    
    if not user:
         raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
         
    if user.id == current_user.id:
        return user # User can always read their own data

    # Check tenant access
    if not current_user.is_superuser and user.tenant_id != current_user.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions to view this user",
        )
        
    return user


@router.patch(
    "/{user_id}",
    dependencies=[Depends(get_current_active_superuser)], # Only superusers can update arbitrary users
    response_model=UserPublic,
)
async def update_user( 
    *,
    session: SessionDep,
    user_id: uuid.UUID,
    user_in: UserUpdate,
    # current_user: CurrentUser # Superuser dependency already applied
) -> Any:
    """
    Update a user (by Superuser). Tenant ID is protected by crud.update_user.
    """
    db_user = await session.get(User, user_id)
    if not db_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="The user with this id does not exist in the system",
        )
        
    # Optional: Check email conflict across tenants if superuser is updating
    if user_in.email:
        existing_user = await crud.get_user_by_email(session=session, email=user_in.email) 
        if existing_user and existing_user.id != user_id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT, detail="User with this email already exists"
            )

    # crud.update_user prevents tenant_id change
    db_user = await crud.update_user(session=session, db_user=db_user, user_in=user_in) 
    return db_user


@router.delete("/{user_id}", dependencies=[Depends(get_current_active_superuser)]) # Only superusers can delete arbitrary users
async def delete_user( 
    session: SessionDep, current_user: CurrentUser, user_id: uuid.UUID
) -> Message:
    """
    Delete a user (by Superuser).
    """
    user = await session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if user.id == current_user.id: # Superuser check already done by dependency
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Super users are not allowed to delete themselves"
        )
        
    # Delete items owned by the user (or rely on cascade delete if configured)
    # The cascade delete on User->Item relationship should handle this automatically.
    # statement = delete(Item).where(col(Item.owner_id) == user_id)
    # await session.exec(statement)  # type: ignore 
    
    await session.delete(user) 
    await session.commit()
    # TODO: Check if tenant is now empty and delete/deactivate if needed.
    return Message(message="User deleted successfully")