import uuid
from typing import Any

from fastapi import APIRouter, HTTPException, status, Query # Import Query
from sqlmodel import func, select, col # Import col

# Import the specific CRUD function we might need
from app.crud import get_item_by_id 
from app.api.deps import CurrentUser, SessionDep
# Import Tenant model for potential future use
from app.models import Item, ItemCreate, ItemPublic, ItemsPublic, ItemUpdate, Message, Tenant

#router = APIRouter(tags=["items"])
router = APIRouter(prefix="/items", tags=["items"])


@router.get("/", response_model=ItemsPublic)
async def read_items( 
    session: SessionDep, 
    current_user: CurrentUser, 
    skip: int = 0, 
    limit: int = 100,
    # --- NEW Query Parameters ---
    tenant_id: uuid.UUID | None = Query(default=None, description="Filter by specific tenant ID (Superuser only)"),
    all_tenants: bool = Query(default=False, description="Fetch items from all tenants (Superuser only)")
    # --- End New Parameters ---
) -> Any:
    """
    Retrieve items. Regular users see items from their tenant.
    Superusers default to their own tenant but can override.
    """
    count_query = select(func.count()).select_from(Item)
    items_query = select(Item).offset(skip).limit(limit)

    # Apply Tenant Filtering
    effective_tenant_id = current_user.tenant_id # Default for all users

    if current_user.is_superuser:
        if all_tenants:
            effective_tenant_id = None # Signal to skip filtering
        elif tenant_id:
            # Superuser specified a tenant
            # Optional: Check if tenant_id exists before querying
            effective_tenant_id = tenant_id 
        # else: Superuser default is their own tenant_id (already set)
    
    # Apply the filter if an effective_tenant_id is determined
    if effective_tenant_id:
        tenant_filter = (col(Item.tenant_id) == effective_tenant_id)
        count_query = count_query.where(tenant_filter)
        items_query = items_query.where(tenant_filter)
    elif not current_user.is_superuser:
         # Non-superuser trying to access all tenants? Should not be possible if code is right.
         raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
        
    # Execute queries
    count_result = await session.exec(count_query)
    count = count_result.one()
    
    items_result = await session.exec(items_query)
    items = items_result.all()

    return ItemsPublic(data=items, count=count)


@router.get("/{id}", response_model=ItemPublic)
async def read_item( 
    session: SessionDep, current_user: CurrentUser, id: uuid.UUID
) -> Any:
    """
    Get item by ID, ensuring it belongs to the user's tenant (or user is superuser).
    """
    # Use the CRUD function for consistency (optional, but good practice)
    # item = await get_item_by_id(session=session, item_id=id) 
    item = await session.get(Item, id) # Keep direct session.get for now

    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")
    
    # Check tenant access
    if not current_user.is_superuser and (item.tenant_id != current_user.tenant_id):
        # Forbidden: Item exists but doesn't belong to this tenant
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not enough permissions") 
        
    return item


@router.post("/", response_model=ItemPublic, status_code=status.HTTP_201_CREATED) # Added 201 status
async def create_item( 
    *, session: SessionDep, current_user: CurrentUser, item_in: ItemCreate
) -> Any:
    """
    Create new item, assigned to the current user and their tenant.
    """
    # Ideally, call crud.create_item here. Modifying directly for now:
    item_data = item_in.model_dump()
    item = Item(
        **item_data, 
        owner_id=current_user.id, 
        tenant_id=current_user.tenant_id # <-- SET TENANT ID
    )
    session.add(item)
    await session.commit()
    await session.refresh(item)
    return item


@router.put("/{id}", response_model=ItemPublic)
async def update_item( 
    *,
    session: SessionDep,
    current_user: CurrentUser,
    id: uuid.UUID,
    item_in: ItemUpdate,
) -> Any:
    """
    Update an item, ensuring it belongs to the user's tenant (or user is superuser).
    """
    item = await session.get(Item, id)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")
        
    # Check tenant access BEFORE updating
    if not current_user.is_superuser and (item.tenant_id != current_user.tenant_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not enough permissions") 
        
    update_dict = item_in.model_dump(exclude_unset=True)
    # Ensure tenant_id and owner_id are not changed via this endpoint
    update_dict.pop("tenant_id", None)
    update_dict.pop("owner_id", None) 
    
    item.sqlmodel_update(update_dict)
    session.add(item)
    await session.commit()
    await session.refresh(item)
    return item


@router.delete("/{id}", status_code=status.HTTP_200_OK) # Changed default to 200 OK
async def delete_item( 
    session: SessionDep, current_user: CurrentUser, id: uuid.UUID
) -> Message:
    """
    Delete an item, ensuring it belongs to the user's tenant (or user is superuser).
    """
    item = await session.get(Item, id)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")
        
    # Check tenant access BEFORE deleting
    if not current_user.is_superuser and (item.tenant_id != current_user.tenant_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not enough permissions") 
        
    await session.delete(item) 
    await session.commit()
    return Message(message="Item deleted successfully")