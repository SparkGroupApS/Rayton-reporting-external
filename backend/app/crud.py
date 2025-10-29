import uuid
from typing import Any

from sqlmodel.ext.asyncio.session import AsyncSession # NEW: Import AsyncSession
from sqlmodel import select, func, col 
import uuid
from app.core.security import get_password_hash, verify_password
# Import Tenant models as well
from app.models import Item, ItemCreate, User, UserCreate, UserUpdate, Tenant, TenantCreate, TenantUpdate


# ==================
# Tenant CRUD
# ==================
async def create_tenant(*, session: AsyncSession, tenant_create: TenantCreate) -> Tenant:
    """Creates a new Tenant."""
    db_obj = Tenant.model_validate(tenant_create)
    session.add(db_obj)
    await session.commit()
    await session.refresh(db_obj)
    return db_obj

async def get_tenant_by_id(*, session: AsyncSession, tenant_id: uuid.UUID) -> Tenant | None:
    """Gets a Tenant by its ID."""
    tenant = await session.get(Tenant, tenant_id)
    return tenant

# Add more tenant CRUD functions as needed (get_by_name, get_all, update, delete)

# ==================
# User CRUD (Updated for Multi-Tenancy)
# ==================
async def create_user(
    *, session: AsyncSession, user_create: UserCreate, tenant_id: uuid.UUID # Added tenant_id
) -> User:
    """Creates a user, assigns tenant, and handles optional role."""
    # Prepare update dictionary, including hashed password and tenant_id
    update_data = {
        "hashed_password": get_password_hash(user_create.password),
        "tenant_id": tenant_id
    }
    # If a role is provided in UserCreate, include it in the update data
    # Otherwise, the default 'client' from UserBase will be used
    if user_create.role is not None:
        update_data["role"] = user_create.role
        
    db_obj = User.model_validate(
        user_create, 
        update=update_data
    )
    session.add(db_obj)
    await session.commit() 
    await session.refresh(db_obj) 
    return db_obj

# update_user: Typically, tenant_id should NOT be updatable via standard user updates.
# If you need to move a user between tenants, create a specific admin function.
async def update_user(*, session: AsyncSession, db_user: User, user_in: UserUpdate) -> Any:
    """Updates a user, allowing role changes."""
    user_data = user_in.model_dump(exclude_unset=True)
    extra_data = {}
    if "password" in user_data and user_data["password"]: # Check if password is not None/empty
        password = user_data.pop("password") # Remove password before main update
        hashed_password = get_password_hash(password)
        extra_data["hashed_password"] = hashed_password
    
    # Ensure tenant_id is not accidentally changed
    user_data.pop("tenant_id", None) 
    
    # Update standard fields (email, full_name, is_active, is_superuser, role)
    db_user.sqlmodel_update(user_data) 
    # Update extra data like hashed_password if needed
    if extra_data:
        db_user.sqlmodel_update(extra_data) 

    session.add(db_user)
    await session.commit() 
    await session.refresh(db_user) 
    return db_user

# get_user_by_email: Does NOT filter by tenant initially for authentication purposes.
async def get_user_by_email(*, session: AsyncSession, email: str) -> User | None:
    statement = select(User).where(col(User.email) == email) # Use col() for clarity
    result = await session.exec(statement) 
    session_user = result.first() 
    return session_user

# authenticate: No changes needed, relies on get_user_by_email.
async def authenticate(*, session: AsyncSession, email: str, password: str) -> User | None:
    db_user = await get_user_by_email(session=session, email=email)
    if not db_user:
        return None
    if not verify_password(password, db_user.hashed_password):
        return None
    return db_user

# Add functions like get_user_by_id_and_tenant, get_users_by_tenant etc. if needed


# ==================
# Item CRUD (Updated for Multi-Tenancy)
# ==================
async def create_item(
    *, session: AsyncSession, item_in: ItemCreate, owner_id: uuid.UUID, tenant_id: uuid.UUID # Added tenant_id
) -> Item:
    """Creates an item, ensuring it's assigned to the owner's tenant."""
    db_item = Item.model_validate(
        item_in, 
        update={
            "owner_id": owner_id,
            "tenant_id": tenant_id # Assign tenant_id
        }
    )
    session.add(db_item)
    await session.commit() 
    await session.refresh(db_item) 
    return db_item

async def get_item_by_id(
    *, session: AsyncSession, item_id: uuid.UUID
) -> Item | None:
    """Gets an item by ID (without tenant check initially)."""
    item = await session.get(Item, item_id)
    return item

async def get_tenants(
    *, session: AsyncSession, skip: int = 0, limit: int = 100
) -> tuple[list[Tenant], int]:
    """Gets a list of tenants with pagination."""
    count_statement = select(func.count()).select_from(Tenant)
    count_result = await session.exec(count_statement)
    count = count_result.one()

    statement = select(Tenant).offset(skip).limit(limit)
    tenants_result = await session.exec(statement)
    tenants = tenants_result.all()
    return tenants, count

async def update_tenant(
    *, session: AsyncSession, db_tenant: Tenant, tenant_in: TenantUpdate
) -> Tenant:
    """Updates a tenant."""
    tenant_data = tenant_in.model_dump(exclude_unset=True)
    db_tenant.sqlmodel_update(tenant_data)
    session.add(db_tenant)
    await session.commit()
    await session.refresh(db_tenant)
    return db_tenant

async def delete_tenant(*, session: AsyncSession, db_tenant: Tenant) -> None:
    """Deletes a tenant."""
    # WARNING: Consider implications - what happens to users/items?
    # Add logic here to reassign or delete associated objects if needed.
    await session.delete(db_tenant)
    await session.commit()
    # Return nothing on successful deletion