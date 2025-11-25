from typing import Any

from fastapi import APIRouter, HTTPException, status  # Import HTTPException, status
from pydantic import BaseModel, EmailStr  # Use EmailStr

# Import necessary CRUD functions and models
from app import crud
from app.api.deps import SessionDep
from app.models import (
    TenantCreate,  # Import TenantCreate
    UserCreate,  # Use UserCreate for validation consistency
    UserPublic,
)

router = APIRouter(tags=["private"], prefix="/private")


# Use a Pydantic model for input validation, similar to UserCreate but without tenant_id
class PrivateUserCreateInput(BaseModel):
    email: EmailStr
    password: str
    full_name: str | None = None
    # is_verified: bool = False # Removed, handle verification separately if needed


@router.post("/users/", response_model=UserPublic, status_code=status.HTTP_201_CREATED)
async def create_user_with_new_tenant(user_in: PrivateUserCreateInput, session: SessionDep) -> Any:
    """
    Create a new user AND a new tenant for that user.
    Intended for specific setup scenarios.
    """
    # 1. Check if user email already exists globally
    existing_user = await crud.get_user_by_email(session=session, email=user_in.email)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The user with this email already exists.",
        )

    # 2. Create a new tenant for this user
    tenant_name = f"Tenant for {user_in.email}" # Basic naming strategy
    tenant_create = TenantCreate(name=tenant_name)
    try:
        new_tenant = await crud.create_tenant(session=session, tenant_create=tenant_create)
    except Exception as e: # Catch potential unique constraint errors on tenant name
         await session.rollback() # Rollback if tenant creation fails
         raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create tenant: {e}",
        )

    # 3. Create the user associated with the new tenant
    # Adapt input model to UserCreate format expected by CRUD
    user_create = UserCreate(
        email=user_in.email,
        password=user_in.password,
        full_name=user_in.full_name,
        # Default other fields as needed (is_active=True, is_superuser=False)
    )
    try:
        user = await crud.create_user(
            session=session,
            user_create=user_create,
            tenant_id=new_tenant.id
        )
    except Exception as e:
        await session.rollback() # Rollback user creation if it fails
        # Consider deleting the tenant created above if user creation fails permanently
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create user after creating tenant: {e}",
        )

    # Note: No email sending logic here as in the regular create_user endpoint

    return user
