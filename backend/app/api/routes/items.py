# backend/app/api/routes/items.py
import uuid
from typing import Any

from fastapi import APIRouter, HTTPException
from sqlmodel import func, select

from app.api.deps import CurrentUser, SessionDep
from app.models import Item, ItemCreate, ItemPublic, ItemsPublic, ItemUpdate, Message

router = APIRouter(prefix="/items", tags=["items"])


@router.get("/", response_model=ItemsPublic)
async def read_items( # NEW: async def
    session: SessionDep, current_user: CurrentUser, skip: int = 0, limit: int = 100
) -> Any:
    """
    Retrieve items.
    """

    if current_user.is_superuser:
        count_statement = select(func.count()).select_from(Item)
        # NEW: Await session.exec, then call .one() on the result
        count_result = await session.exec(count_statement)
        count = count_result.one()

        statement = select(Item).offset(skip).limit(limit)
        # NEW: Await session.exec, then call .all() on the result
        items_result = await session.exec(statement)
        items = items_result.all()
    else:
        count_statement = (
            select(func.count())
            .select_from(Item)
            .where(Item.owner_id == current_user.id)
        )
        # NEW: Await session.exec, then call .one() on the result
        count_result = await session.exec(count_statement)
        count = count_result.one()

        statement = (
            select(Item)
            .where(Item.owner_id == current_user.id)
            .offset(skip)
            .limit(limit)
        )
        # NEW: Await session.exec, then call .all() on the result
        items_result = await session.exec(statement)
        items = items_result.all()

    return ItemsPublic(data=items, count=count)


@router.get("/{id}", response_model=ItemPublic)
async def read_item( # NEW: async def
    session: SessionDep, current_user: CurrentUser, id: uuid.UUID
) -> Any:
    """
    Get item by ID.
    """
    # NEW: Await session.get
    item = await session.get(Item, id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    if not current_user.is_superuser and (item.owner_id != current_user.id):
        raise HTTPException(status_code=400, detail="Not enough permissions")
    return item


@router.post("/", response_model=ItemPublic)
async def create_item( # NEW: async def
    *, session: SessionDep, current_user: CurrentUser, item_in: ItemCreate
) -> Any:
    """
    Create new item.
    """
    item = Item.model_validate(item_in, update={"owner_id": current_user.id})
    session.add(item)
    # NEW: Await session.commit
    await session.commit()
    # NEW: Await session.refresh
    await session.refresh(item)
    return item


@router.put("/{id}", response_model=ItemPublic)
async def update_item( # NEW: async def
    *,
    session: SessionDep,
    current_user: CurrentUser,
    id: uuid.UUID,
    item_in: ItemUpdate,
) -> Any:
    """
    Update an item.
    """
    # NEW: Await session.get
    item = await session.get(Item, id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    if not current_user.is_superuser and (item.owner_id != current_user.id):
        raise HTTPException(status_code=400, detail="Not enough permissions")
    update_dict = item_in.model_dump(exclude_unset=True)
    item.sqlmodel_update(update_dict)
    session.add(item)
    # NEW: Await session.commit
    await session.commit()
    # NEW: Await session.refresh
    await session.refresh(item)
    return item


@router.delete("/{id}")
async def delete_item( # NEW: async def
    session: SessionDep, current_user: CurrentUser, id: uuid.UUID
) -> Message:
    """
    Delete an item.
    """
    # NEW: Await session.get
    item = await session.get(Item, id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    if not current_user.is_superuser and (item.owner_id != current_user.id):
        raise HTTPException(status_code=400, detail="Not enough permissions")
    # NEW: Await session.delete (if it's an async method, otherwise session.delete might be sync)
    # Standard SQLModel/SQLAlchemy AsyncSession.delete is typically sync in terms of object state management,
    # but the subsequent commit is async. However, some dialects/versions might make it awaitable.
    # It's safer to assume it might become async in future versions or specific contexts.
    # For now, the standard approach is to treat session.delete() as sync, commit as async.
    # If you get an error like "object is not awaitable", remove the await.
    # session.delete(item) # Standard approach
    await session.delete(item) # Safer for potential future compatibility, but check if necessary
    # NEW: Await session.commit
    await session.commit()
    return Message(message="Item deleted successfully")
