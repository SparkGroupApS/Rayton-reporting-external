# In backend/app/api/routes/historical_data.py

import datetime
import uuid
from typing import Any, Literal
from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_
from sqlmodel import select, col, func
from sqlmodel.ext.asyncio.session import AsyncSession

from app.api.deps import CurrentUser, SessionDep
from app.core.db import get_data_async_session
from app.models import (
    HistoricalDataGroupedResponse,
    PlcDataHistorical,
    Tenant,
    TextList,
    TimeSeriesData,
    TimeSeriesPoint,
)

router = APIRouter(prefix="/historical-data", tags=["historical-data"])

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

@router.get("/details", response_model=HistoricalDataGroupedResponse)
async def read_historical_details(
    current_user: CurrentUser,
    primary_session: SessionDep,
    data_session: AsyncSession = Depends(get_data_async_session),
    tenant_id: uuid.UUID = Query(..., description="Tenant ID to fetch data for"),
    data_ids: list[int] = Query(..., description="List of DATA_IDs to fetch"),
    start: datetime.datetime | None = Query(None, description="Start timestamp"),
    end: datetime.datetime | None = Query(None, description="End timestamp"),
    aggregate_by: Literal["hour", "day", "month", "year"] | None = Query(
        None, description="Aggregation level: hour (raw data), day, month, year (deltas)"
    ),
) -> Any:
    """
    Fetch historical data.
    - If aggregate_by is 'hour', it returns raw data points.
    - Otherwise, it calculates the DELTA (difference between consecutive readings).
    
    Frontend Time Range to Aggregation Mapping:
    - Day view: hour (raw data points)
    - Week/Month view: day (daily deltas)
    - Year view: month (monthly deltas)
    - Lifetime view: year (yearly deltas)
    """
    # Adjust aggregate_by based on frontend time range selection
    # Week and Month should return daily data, Year should return monthly, Lifetime should return yearly
    # The frontend will send the appropriate aggregate_by value based on the selected time range
    # 1. Permission Check
    if not current_user.is_superuser and current_user.tenant_id != tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="Not authorized for this tenant"
        )

    # 2. Lookup plant_id
    target_plant_id = await get_plant_id_for_tenant(tenant_id, primary_session)

    # Branch for raw data (Day view) vs aggregated data (Week, Month, etc.)
    if aggregate_by == "hour" or aggregate_by is None:
        # Query for raw, non-aggregated data points
        query = select(
            PlcDataHistorical.DATA_ID,
            PlcDataHistorical.TIMESTAMP,
            PlcDataHistorical.DATA,
            TextList.TEXT_L1,
            TextList.TEXT_L2,
        ).join(
            TextList,
            and_(
                col(PlcDataHistorical.DATA_ID) == col(TextList.DATA_ID),
                col(TextList.CLASS_ID) == 0,
            ),
            isouter=True,
        ).where(
            col(PlcDataHistorical.PLANT_ID) == target_plant_id
        ).where(
            col(PlcDataHistorical.DATA_ID).in_(data_ids)
        )
        if start:
            query = query.where(col(PlcDataHistorical.TIMESTAMP) >= start)
        if end:
            query = query.where(col(PlcDataHistorical.TIMESTAMP) <= end)
        
        query = query.order_by(PlcDataHistorical.DATA_ID.asc(), PlcDataHistorical.TIMESTAMP.asc())
        
        results = await data_session.exec(query)
        rows = results.all()

        # Process raw data results
        grouped_data: dict[int, TimeSeriesData] = {}
        for data_id, timestamp, value, label, label_local in rows:
            if data_id not in grouped_data:
                series_name = label_local or label or f"Data ID {data_id}"
                grouped_data[data_id] = TimeSeriesData(data_id=data_id, name=series_name, data=[])
            
            timestamp_ms = int(timestamp.timestamp() * 1000)
            grouped_data[data_id].data.append(
                TimeSeriesPoint(x=timestamp_ms, y=round(value, 3) if value is not None else 0)
            )
        
        series_list = list(grouped_data.values())
        return HistoricalDataGroupedResponse(series=series_list)

    # --- Logic for aggregated data (day, month, year) ---
    
    # 3. Determine bucket expression for aggregation
    if aggregate_by == "day":
        bucket_expr = func.date(PlcDataHistorical.TIMESTAMP)
    elif aggregate_by == "month":
        bucket_expr = func.concat(
            func.year(PlcDataHistorical.TIMESTAMP), 
            '-', 
            func.lpad(func.month(PlcDataHistorical.TIMESTAMP), 2, '0')
        )
    elif aggregate_by == "year":
        bucket_expr = func.cast(func.year(PlcDataHistorical.TIMESTAMP), type_=str)
    else: # Should not happen due to the check above, but as a fallback
        bucket_expr = func.date(PlcDataHistorical.TIMESTAMP)

    # 4. Query with bucket grouping
    # For daily aggregation, extend the start date by one day earlier to get the baseline for first day's delta
    extended_start = start
    if aggregate_by == "day" and start:
        extended_start = start - datetime.timedelta(days=1)
    
    query = select(
        PlcDataHistorical.DATA_ID,
        bucket_expr.label("bucket"),
        func.max(PlcDataHistorical.TIMESTAMP).label("latest_ts"),
        func.max(PlcDataHistorical.DATA).label("value"),
        func.max(TextList.TEXT_L1).label("label"),
        func.max(TextList.TEXT_L2).label("label_local"),
    ).join(
        TextList,
        and_(
            col(PlcDataHistorical.DATA_ID) == col(TextList.DATA_ID),
            col(TextList.CLASS_ID) == 0,
        ),
        isouter=True,
    ).where(
        col(PlcDataHistorical.PLANT_ID) == target_plant_id
    ).where(
        col(PlcDataHistorical.DATA_ID).between(100,199) #in_(data_ids)
    )

    if extended_start:
        query = query.where(col(PlcDataHistorical.TIMESTAMP) >= extended_start)
    if end:
        query = query.where(col(PlcDataHistorical.TIMESTAMP) <= end)

    query = query.group_by(
        PlcDataHistorical.DATA_ID, "bucket"
    ).order_by(
        PlcDataHistorical.DATA_ID.asc(), "bucket"
    )

    results = await data_session.exec(query)
    rows = results.all()

    # 5. Process results into deltas
    by_id = defaultdict(list)
    id_metadata = {}
    
    for data_id, bucket, latest_ts, value, label, label_local in rows:
        by_id[data_id].append({"bucket": bucket, "timestamp": latest_ts, "value": value})
        if data_id not in id_metadata:
            id_metadata[data_id] = {"label": label, "label_local": label_local}

    # 6. Calculate deltas and build response
    grouped_data: dict[int, TimeSeriesData] = {}
    
    for data_id, entries in by_id.items():
        entries.sort(key=lambda x: x["bucket"])
        
        metadata = id_metadata.get(data_id, {})
        series_name = metadata.get("label_local") or metadata.get("label") or f"Data ID {data_id}"
        
        if data_id not in grouped_data:
            grouped_data[data_id] = TimeSeriesData(data_id=data_id, name=series_name, data=[])
        
        # Process all entries to calculate deltas, but only include results within the original requested date range
        # Also handle the case where the first entry in the requested range doesn't have a previous value
        for i in range(1, len(entries)):
            prev, curr = entries[i - 1], entries[i]
            delta = (curr["value"] or 0) - (prev["value"] or 0)
            
            # Check if the current bucket (date) is within the original requested range
            include_in_result = True
            if start and isinstance(curr["bucket"], datetime.date):
                curr_datetime = datetime.datetime.combine(curr["bucket"], datetime.time.min)
                if curr_datetime.date() < start.date():
                    include_in_result = False
            elif start and isinstance(curr["bucket"], str) and aggregate_by == "month":
                year, month = curr["bucket"].split('-')
                curr_datetime = datetime.datetime(int(year), int(month), 1)
                start_month = datetime.datetime(start.year, start.month, 1)
                if curr_datetime < start_month:
                    include_in_result = False
            elif start and isinstance(curr["bucket"], str) and aggregate_by == "year":
                curr_year = int(curr["bucket"])
                if curr_year < start.year:
                    include_in_result = False
            
            if include_in_result:
                if isinstance(curr["bucket"], datetime.date):
                    timestamp_dt = datetime.datetime.combine(curr["bucket"], datetime.time.min)
                elif isinstance(curr["bucket"], str):
                    if aggregate_by == "month":
                        year, month = curr["bucket"].split('-')
                        timestamp_dt = datetime.datetime(int(year), int(month), 1)
                    else: # year
                        timestamp_dt = datetime.datetime(int(curr["bucket"]), 1, 1)
                else:
                    timestamp_dt = curr["timestamp"]
                
                timestamp_ms = int(timestamp_dt.timestamp() * 1000)
                
                grouped_data[data_id].data.append(
                    TimeSeriesPoint(x=timestamp_ms, y=round(delta, 3))
                )
        
        # Handle the case where the first day in the requested range exists but there's no previous day to calculate delta from
        # If the first entry in entries is within the requested range but there's no previous entry to calculate delta with
        if len(entries) > 0 and start:
            # Find the first entry that falls within the requested range
            for i, entry in enumerate(entries):
                if isinstance(entry["bucket"], datetime.date):
                    entry_datetime = datetime.datetime.combine(entry["bucket"], datetime.time.min)
                    is_in_range = start.date() <= entry_datetime.date() <= end.date() if end else start.date() <= entry_datetime.date()
                elif isinstance(entry["bucket"], str) and aggregate_by == "month":
                    year, month = entry["bucket"].split('-')
                    entry_datetime = datetime.datetime(int(year), int(month), 1)
                    start_month = datetime.datetime(start.year, start.month, 1)
                    end_month = datetime.datetime(end.year, end.month, 1) if end else start_month
                    is_in_range = start_month <= entry_datetime <= end_month
                elif isinstance(entry["bucket"], str) and aggregate_by == "year":
                    entry_year = int(entry["bucket"])
                    end_year = end.year if end else start.year
                    is_in_range = start.year <= entry_year <= end_year
                else:
                    is_in_range = True
                
                # If this entry is in the requested range, but we don't have a previous entry to calculate delta (i.e., i == 0)
                # and it's the first entry in the extended range, we need special handling
                if is_in_range and i == 0:
                    # This case shouldn't happen with our current logic since we extend the start date
                    # But if somehow the first entry in the range has no previous value to calculate delta from
                    # We would need to handle it differently - but for delta calculation, we need a reference point
                    pass
                # If the first entry in requested range is not the first in entries (i > 0), then it will be handled by the main loop
                elif is_in_range and i > 0 and i < len(entries) and entries[i-1]["bucket"] < (start.date() if isinstance(entries[i]["bucket"], datetime.date) else entries[i]["bucket"]):
                    # Handle case where the entry is in range but the previous one was before the requested range
                    # In this case, we calculate delta from the previous entry even if it's outside the range
                    prev = entries[i - 1]
                    curr = entries[i]
                    delta = (curr["value"] or 0) - (prev["value"] or 0)
                    
                    if isinstance(curr["bucket"], datetime.date):
                        timestamp_dt = datetime.datetime.combine(curr["bucket"], datetime.time.min)
                    elif isinstance(curr["bucket"], str):
                        if aggregate_by == "month":
                            year, month = curr["bucket"].split('-')
                            timestamp_dt = datetime.datetime(int(year), int(month), 1)
                        else: # year
                            timestamp_dt = datetime.datetime(int(curr["bucket"]), 1, 1)
                    else:
                        timestamp_dt = curr["timestamp"]
                    
                    timestamp_ms = int(timestamp_dt.timestamp() * 1000)
                    
                    grouped_data[data_id].data.append(
                        TimeSeriesPoint(x=timestamp_ms, y=round(delta, 3))
                    )

    series_list = list(grouped_data.values())
    return HistoricalDataGroupedResponse(series=series_list)
