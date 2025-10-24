# In backend/app/api/routes/dashboard.py

import uuid
from typing import Any
from fastapi import APIRouter, Depends, Query
from sqlmodel import select, func, col

from app.api.deps import CurrentUser, SessionDep
from app.models import DashboardCardData, RevenueData, DashboardData, User, Item, ItemPublic

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

@router.get("/", response_model=DashboardData)
async def read_dashboard_data(
    session: SessionDep, 
    current_user: CurrentUser,
    # Allow superusers to override the tenant ID they are viewing
    tenant_id_override: uuid.UUID | None = Query(default=None, description="Admin override to view a specific tenant's dashboard")
) -> Any:
    """
    Retrieve dashboard data for the current user's tenant.
    Superusers can use tenant_id_override to view other tenants.
    """
    
    # Determine which tenant's data to fetch
    target_tenant_id = current_user.tenant_id
    if current_user.is_superuser and tenant_id_override:
        target_tenant_id = tenant_id_override
        
    # --- Fetch Card Data (Example Queries) ---
    users_count_stmt = select(func.count(User.id)).where(col(User.tenant_id) == target_tenant_id)
    items_count_stmt = select(func.count(Item.id)).where(col(Item.tenant_id) == target_tenant_id)
    
    users_count_res = await session.exec(users_count_stmt)
    items_count_res = await session.exec(items_count_stmt)
    
    total_users = users_count_res.one()
    total_items = items_count_res.one()
    
    # Create mock card data
    cards = DashboardCardData(
        total_users=total_users,
        total_items=total_items,
        active_users=total_users, # Placeholder
        inactive_items=0 # Placeholder
    )
    
    # --- Fetch Revenue Data (Mock Data) ---
    revenue = [
        RevenueData(month="Jan", revenue=1000), RevenueData(month="Feb", revenue=1500),
        RevenueData(month="Mar", revenue=1200), RevenueData(month="Apr", revenue=2000),
        RevenueData(month="May", revenue=2500), RevenueData(month="Jun", revenue=2300),
    ]
    
    # --- Fetch Latest Items (Example of "Latest Invoices") ---
    latest_items_stmt = select(Item).where(col(Item.tenant_id) == target_tenant_id).order_by(col(Item.id).desc()).limit(5)
    latest_items_res = await session.exec(latest_items_stmt)
    latest_items = [ItemPublic.model_validate(item) for item in latest_items_res.all()]
    
    return DashboardData(cards=cards, revenue=revenue, items=latest_items)