# In: app/api/routes/electricity_cost.py
import datetime
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession  # Import AsyncSession

# Adjust these imports to match your project structure
from app.api.deps import CurrentUser, SessionDep

# Use the correct dependency for your external data session
from app.core.db import get_data_async_session
from app.models import ElectricityCost, ElectricityCostRow, Tenant

router = APIRouter(prefix="/electricity-cost", tags=["electricity-cost"])

# --- UPDATED Helper function ---
async def get_plant_id_for_tenant(
    tenant_id: uuid.UUID, session: SessionDep
) -> int:  # <-- Uses SessionDep (primary DB)
    """Looks up the plant_id stored directly on the Tenant record."""

    tenant = await session.get(
        Tenant, tenant_id
    )  # Use session.get for primary key lookup

    if tenant is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Tenant with ID {tenant_id} not found.",
        )

    if tenant.plant_id is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No plant_id configured for tenant ID {tenant_id}",
        )

    return tenant.plant_id


# --- End Helper ---

@router.get("/", response_model=list[ElectricityCostRow])
async def read_electricity_cost(
    current_user: CurrentUser,
    primary_session: SessionDep,
    tenant_id: uuid.UUID = Query(..., description="Tenant ID to fetch electricity cost for"),
    date: datetime.date = Query(..., description="Date (YYYY-MM-DD)"),
    data_session: AsyncSession = Depends(get_data_async_session),
):
    # Permission check
    if not current_user.is_superuser and current_user.tenant_id != tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized for this tenant"
        )

    # Verify tenant exists and has plant_id (for authorization purposes)
    # Note: Electricity cost data is shared across all plants, so we don't filter by plant_id
    await get_plant_id_for_tenant(tenant_id, primary_session)

    # Query electricity cost data
    query = (
        select(ElectricityCost)
        .where(ElectricityCost.price_date == date)
        .order_by(ElectricityCost.hour_of_day)
    )
    cost_rows_db_result = await data_session.exec(query)
    db_rows: list[ElectricityCost] = cost_rows_db_result.all()

    # Convert DB rows to API response models
    response_rows: list[ElectricityCostRow] = []
    for db_row in db_rows:
        try:
            # Check if db_row is None before accessing its attributes
            if db_row is None:
                continue  # Skip None rows

            # Create a dictionary mapping Pydantic field names to the values from the ORM object
            row_dict = {
                "id": db_row.id,
                "price_date": db_row.price_date,
                "hour_of_day": db_row.hour_of_day,
                "price_UAH_per_MWh": db_row.price_UAH_per_MWh,
                "received_at": db_row.received_at
            }
            # Validate the dictionary against the ElectricityCostRow model
            validated_row = ElectricityCostRow.model_validate(row_dict)
            response_rows.append(validated_row)
        except Exception as e:
            # Catch potential validation errors or attribute errors more specifically
            error_msg = f"Error processing DB row ID {getattr(db_row, 'id', 'Unknown')}: {str(e)}"
            # Only try to print db_row attributes if db_row is not None
            if db_row is not None:
                print(f"{error_msg}. Row Data: {vars(db_row)}") # Log row data for debugging
            else:
                print(f"{error_msg}. Row Data: None") # Log that the row is None
            # Decide whether to skip the row or raise an error for the whole request
            # For now, let's raise, as it indicates a bigger issue
            raise HTTPException(
                status_code=500,
                detail=f"Internal server error processing electricity cost data. Problem with row ID {getattr(db_row, 'id', 'Unknown')}.",
            )

    return response_rows
