# In backend/app/api/routes/historical_data.py

import datetime
import uuid
from typing import Any  # Add Dict

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlmodel import and_, col, select
from sqlmodel.ext.asyncio.session import AsyncSession

#from sqlalchemy.orm import Query as SQLAlchemyQuery # For potential group_by usage
# --- Import Dependencies ---
from app.api.deps import CurrentUser, SessionDep  # <-- Add SessionDep

# --- Import Sessions ---
from app.core.db import get_data_async_session

# --- Import Models ---
from app.models import (
    HistoricalDataGroupedResponse,
    PlcDataHistorical,
    Tenant,  # <-- Import Tenant model for lookup
    TextList,
    TimeSeriesData,
    TimeSeriesPoint,
)

# --- Import or copy the helper function ---
# Option A: Import if you moved it to a shared utility file
# from app.utils.tenancy import get_plant_id_for_tenant # Example path

# Option B: Copy the helper function here (if not shared)
async def get_plant_id_for_tenant(tenant_id: uuid.UUID, session: SessionDep) -> int:
    """Looks up the plant_id stored directly on the Tenant record."""
    tenant = await session.get(Tenant, tenant_id)
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


router = APIRouter(prefix="/historical-data", tags=["historical-data"])

@router.get("/details", response_model=HistoricalDataGroupedResponse)
async def read_historical_details(
    current_user: CurrentUser,
    # --- Inject BOTH sessions ---
    primary_session: SessionDep,
    data_session: AsyncSession = Depends(get_data_async_session), # External data
    # --- CHANGE: Accept tenant_id, make plant_id optional (or remove) ---
    tenant_id: uuid.UUID = Query(..., description="Tenant ID to fetch data for"),
    # plant_id: int = Query(..., description="PLANT_ID to fetch data for"), # REMOVE
    # --- END CHANGE ---
    data_ids: list[int] = Query(..., description="List of DATA_IDs to fetch"),
    start: datetime.datetime | None = Query(None, description="Start timestamp"),
    end: datetime.datetime | None = Query(None, description="End timestamp"),
    # tenant_id_override: uuid.UUID | None = Query(None, description="Admin override...") # Can likely remove this now
) -> Any:
    """
    Fetch historical DATA values for a specific Tenant ID and date range,
    grouped by series. Looks up Plant ID internally.
    """
    # 1. Permission Check
    if not current_user.is_superuser and current_user.tenant_id != tenant_id:
         raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized for this tenant")

    # 2. Lookup plant_id using the primary session
    target_plant_id = await get_plant_id_for_tenant(tenant_id, primary_session)

    # 3. Build Query using the looked-up target_plant_id
    statement = (
        select(
            PlcDataHistorical.DATA_ID, PlcDataHistorical.TIMESTAMP, PlcDataHistorical.DATA,
            TextList.TEXT_L1, TextList.TEXT_L2, TextList.TEXT_ID
        )
        .join( TextList, and_( col(PlcDataHistorical.DATA_ID) == col(TextList.DATA_ID), col(TextList.CLASS_ID) == 0 ), isouter=True )
        .where(col(PlcDataHistorical.PLANT_ID) == target_plant_id) # Use looked-up ID
        .where(col(PlcDataHistorical.DATA_ID).in_(data_ids))
    )
    if start: statement = statement.where(col(PlcDataHistorical.TIMESTAMP) >= start)
    if end: statement = statement.where(col(PlcDataHistorical.TIMESTAMP) <= end)
    statement = statement.order_by(col(PlcDataHistorical.DATA_ID).asc(), col(PlcDataHistorical.TIMESTAMP).asc())

    # 4. Execute Query using the data_session
    results = await data_session.exec(statement)
    rows = results.all()

    # 5. Process and Group Results (No change needed here)
    grouped_data: dict[int, TimeSeriesData] = {}
    for row in rows:
        # ... (processing logic remains the same) ...
        d_id, ts, d, tl1, tl2, tid = row
        if not isinstance(ts, datetime.datetime): continue
        if d_id not in grouped_data:
            series_name = tl1 or tid or f"Data ID {d_id}"
            grouped_data[d_id] = TimeSeriesData(data_id=d_id, name=series_name, data=[])
        timestamp_ms = int(ts.timestamp() * 1000)
        grouped_data[d_id].data.append(TimeSeriesPoint(x=timestamp_ms, y=d))

    series_list = list(grouped_data.values())
    return HistoricalDataGroupedResponse(series=series_list)

# --- Add similar changes to /summary endpoint if you created it ---
# @router.get("/summary", ...)
# async def read_historical_summary(
#     current_user: CurrentUser,
#     primary_session: SessionDep = Depends(),
#     data_session: AsyncSession = Depends(get_data_async_session),
#     tenant_id: uuid.UUID = Query(...),
#     start: datetime.datetime,
#     end: datetime.datetime,
# ):
#     # Permission check
#     # Lookup plant_id using primary_session
#     # Perform SUM queries using data_session and looked-up plant_id
#     # Return HistoricalSummaryResponse
#     pass
