import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status

from app import crud
from app.api.deps import SessionDep, get_current_active_superuser, CurrentUser
# Import all necessary Tenant models
from app.models import (
    Tenant, 
    TenantCreate, 
    TenantPublic, 
    TenantsPublic, 
    TenantUpdate,
    Message # For delete response
)

# All tenant operations require superuser privileges
router = APIRouter(
    prefix="/tenants", 
    tags=["tenants"], 
    dependencies=[Depends(get_current_active_superuser)]
)


@router.post("/", response_model=TenantPublic, status_code=status.HTTP_201_CREATED)
async def create_tenant(
    *, session: SessionDep, tenant_in: TenantCreate
) -> Any:
    """
    Create new tenant (Superuser only).
    """
    # Optional: Check if tenant name already exists if needed (DB constraint handles it too)
    tenant = await crud.create_tenant(session=session, tenant_create=tenant_in)
    return tenant


@router.get("/", response_model=TenantsPublic)
async def read_tenants(
    session: SessionDep, skip: int = 0, limit: int = 100
) -> Any:
    """
    Retrieve tenants (Superuser only).
    """
    tenants, count = await crud.get_tenants(session=session, skip=skip, limit=limit)
    return TenantsPublic(data=tenants, count=count)


@router.get("/{tenant_id}", response_model=TenantPublic)
async def read_tenant_by_id(
    tenant_id: uuid.UUID, session: SessionDep
) -> Any:
    """
    Get a specific tenant by ID (Superuser only).
    """
    tenant = await crud.get_tenant_by_id(session=session, tenant_id=tenant_id)
    if not tenant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant not found")
    return tenant


@router.put("/{tenant_id}", response_model=TenantPublic)
async def update_tenant(
    *,
    session: SessionDep,
    tenant_id: uuid.UUID,
    tenant_in: TenantUpdate,
) -> Any:
    """
    Update a tenant (Superuser only).
    """
    db_tenant = await crud.get_tenant_by_id(session=session, tenant_id=tenant_id)
    if not db_tenant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant not found")
        
    # Optional: Check if the new name conflicts with another tenant if name is being updated
        
    tenant = await crud.update_tenant(session=session, db_tenant=db_tenant, tenant_in=tenant_in)
    return tenant


@router.delete("/{tenant_id}", status_code=status.HTTP_200_OK)
async def delete_tenant(
    tenant_id: uuid.UUID, session: SessionDep
) -> Message:
    """
    Delete a tenant (Superuser only). 
    WARNING: Does not currently handle associated users/items.
    """
    db_tenant = await crud.get_tenant_by_id(session=session, tenant_id=tenant_id)
    if not db_tenant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant not found")

    # --- IMPORTANT ---
    # Add logic here BEFORE deleting the tenant:
    # 1. Find all users belonging to this tenant.
    # 2. Decide what to do: 
    #    - Delete these users (and their items via cascade)?
    #    - Reassign them to a default/archive tenant?
    #    - Prevent deletion if tenant is not empty?
    # For now, it just deletes the tenant record.
    # Example check (prevent deletion if not empty):
    # user_count_statement = select(func.count(User.id)).where(col(User.tenant_id) == tenant_id)
    # user_count_res = await session.exec(user_count_statement)
    # if user_count_res.one() > 0:
    #    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot delete tenant with active users.")
    # --- END IMPORTANT ---

    await crud.delete_tenant(session=session, db_tenant=db_tenant)
    return Message(message="Tenant deleted successfully")