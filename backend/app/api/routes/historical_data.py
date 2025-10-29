# In backend/app/api/routes/historical_data.py

import datetime
import uuid
from typing import List, Optional, Dict, Any # Add Dict
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlmodel import select, func, col, and_
#from sqlalchemy.orm import Query as SQLAlchemyQuery # For potential group_by usage

from app.api.deps import CurrentUser
from app.core.db import get_data_async_session 
from sqlmodel.ext.asyncio.session import AsyncSession # Import AsyncSession
from app.models import (
    PlcDataHistorical,
    HistoricalDataGroupedResponse, 
    TimeSeriesData, 
    TimeSeriesPoint,
    TextList
)

router = APIRouter(prefix="/historical-data", tags=["historical-data"])
@router.get("/details", response_model=HistoricalDataGroupedResponse)
async def read_historical_details(
    current_user: CurrentUser, 
    session: AsyncSession = Depends(get_data_async_session),
    data_ids: List[int] = Query(..., description="List of DATA_IDs to fetch"),
    plant_id: int = Query(..., description="PLANT_ID to fetch data for"),
    start: Optional[datetime.datetime] = Query(default=None, description="Start timestamp (ISO format, optional)"),
    end: Optional[datetime.datetime] = Query(default=None, description="End timestamp (ISO format, optional)"),
    tenant_id_override: uuid.UUID | None = Query(default=None, description="Admin override for tenant ID")
) -> Any:
    """
    Fetch raw historical DATA values for multiple DATA_IDs by PLANT_ID,
    grouped by series, including labels from TEXT_LIST.
    Scoped to user's tenant unless overridden.
    """
    # 1. Determine Target Tenant ID / Permission Check (Keep existing logic)
    # ...
    target_plant_id = plant_id
    # ... permission checks ...

    # 2. Build Query with JOIN (Keep existing logic)
    statement = (
        select(
            PlcDataHistorical.DATA_ID, PlcDataHistorical.TIMESTAMP, PlcDataHistorical.DATA,
            TextList.TEXT_L1, TextList.TEXT_L2, TextList.TEXT_ID
        )
        .join( TextList, and_( col(PlcDataHistorical.DATA_ID) == col(TextList.DATA_ID), col(TextList.CLASS_ID) == 0 ), isouter=True )
        .where(col(PlcDataHistorical.PLANT_ID) == target_plant_id)
        .where(col(PlcDataHistorical.DATA_ID).in_(data_ids))
    )
    if start: statement = statement.where(col(PlcDataHistorical.TIMESTAMP) >= start)
    if end: statement = statement.where(col(PlcDataHistorical.TIMESTAMP) <= end)
    statement = statement.order_by(col(PlcDataHistorical.DATA_ID).asc(), col(PlcDataHistorical.TIMESTAMP).asc()) # Order by ID then timestamp

    # 3. Execute Query (Keep existing logic)
    results = await session.exec(statement)
    rows = results.all()

    # 4. Process and Group Results
    grouped_data: Dict[int, TimeSeriesData] = {} # Use Dict to group by data_id

    for row in rows:
        d_id, ts, d, tl1, tl2, tid = row

        # Ensure timestamp is valid datetime
        if not isinstance(ts, datetime.datetime):
            # Log warning or skip if timestamp is invalid/unexpected type
            print(f"Warning: Skipping row due to invalid timestamp type: {type(ts)}")
            continue

        # Get or create the series group
        if d_id not in grouped_data:
            series_name = tl1 or tid or f"Data ID {d_id}" # Choose name: TEXT_L1 > TEXT_ID > fallback
            grouped_data[d_id] = TimeSeriesData(data_id=d_id, name=series_name, data=[])

        # Add the data point in Highcharts format [ms, value]
        timestamp_ms = int(ts.timestamp() * 1000) # Convert datetime to milliseconds
        grouped_data[d_id].data.append(TimeSeriesPoint(x=timestamp_ms, y=d))

    # Convert dict values to list for the final response
    series_list = list(grouped_data.values())

    return HistoricalDataGroupedResponse(series=series_list)