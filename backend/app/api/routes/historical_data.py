# In backend/app/api/routes/historical_data.py

import datetime
import uuid
import logging
from typing import List, Optional, Dict, Any, Literal
from collections import defaultdict
from enum import Enum

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

class ExportGranularity(str, Enum):
    hourly = "hourly"
    # daily = "daily" # Add others if needed for different export types
    # raw = "raw" # If you want to differentiate raw from hourly

logger = logging.getLogger(__name__)
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

@router.get("/export/")
async def export_historical_data(
    # --- Query Parameters ---
    tenant_id: uuid.UUID = Query(..., description="Tenant ID for plant lookup"),
    # plant_id: Optional[int] = Query(None, description="Plant ID (alternative to tenant_id lookup)"),
    data_ids: list[int] = Query(..., description="List of DATA_IDs to fetch"),
    start: datetime.datetime | None = Query(None, description="Start timestamp"),
    end: datetime.datetime | None = Query(None, description="End timestamp"),
    export_granularity: ExportGranularity = Query(..., description="Granularity for exported data (e.g., hourly)"),
    # export_format: Optional[str] = Query("json", description="Desired export format (json/csv/xlsx)") # Handled by frontend for now

    # --- Dependencies ---
    data_session: AsyncSession = Depends(get_data_async_session), # Use the external data session
    # current_user: CurrentUser = Depends(get_current_active_user), # Add auth if needed
):
    """
    Endpoint to fetch and potentially pre-process data for export.
    Currently focuses on fetching raw/hourly data for hourly delta calculations.
    The frontend will handle final XLSX generation.
    """
    logger.info(f"Initiating data export request for tenant_id={tenant_id}, "
                f"data_ids={data_ids}, start={start}, end={end}, granularity={export_granularity}")

    # --- 1. Authorization & Plant ID Lookup (if needed) ---
    # Add logic here to verify `current_user` has access to `tenant_id`
    # if not current_user.is_superuser and current_user.tenant_id != tenant_id:
    #     logger.warning(f"Unauthorized export attempt by user {current_user.id} for tenant {tenant_id}")
    #     raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized for this tenant")

    # Lookup plant_id based on tenant_id (reuse logic from schedule.py or create a helper)
    # plant_id = await get_plant_id_for_tenant(tenant_id, primary_session) # You need primary_session or a helper
    # Placeholder: Assume plant_id is derived or passed, or implement lookup
    # For now, let's assume the frontend provides correct data_ids for the tenant's plant
    # or the data_session is correctly scoped to the tenant's data DB.
    # plant_id_from_lookup = await some_helper_function_to_get_plant_id(tenant_id, primary_session)
    # if not plant_id_from_lookup:
    #     raise HTTPException(status_code=404, detail="Plant configuration not found for tenant")

    # --- 2. Validate Inputs ---
    if start >= end:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Start datetime must be before end datetime.")

    # --- 3. Fetch Data Based on Granularity ---
    if export_granularity == ExportGranularity.hourly:
        # --- Fetch Raw/Hourly Data for Delta Calculation ---
        logger.debug("Fetching hourly/raw data for export...")

        # --- Construct Query for PLC_DATA_HISTORICAL ---
        # Fetch data points within the time range for the specified data_ids
        # We order by TIMESTAMP and DATA_ID to facilitate processing
        statement = (
            select(PlcDataHistorical)
            .where(PlcDataHistorical.TIMESTAMP >= start)
            .where(PlcDataHistorical.TIMESTAMP <= end)
            .where(PlcDataHistorical.DATA_ID.in_(data_ids))
            # .where(PlcDataHistorical.PLANT_ID == plant_id_from_lookup) # Add if scoping by plant_id is needed/possible here
            .order_by(PlcDataHistorical.TIMESTAMP, PlcDataHistorical.DATA_ID)
        )

        try:
            # --- Execute Query ---
            logger.debug(f"Executing export query for {len(data_ids)} data_ids between {start} and {end}")
            result = await data_session.exec(statement)
            raw_data_points: List[PlcDataHistorical] = result.all()
            logger.debug(f"Fetched {len(raw_data_points)} raw data points for export.")
        except Exception as e:
            logger.error(f"Database error fetching data for export: {e}", exc_info=True)
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to fetch data for export.")

        # --- 4. Process Data (Optional Pre-processing) ---
        # The core logic for calculating hourly deltas (Consumption = Meter(t) - Meter(t-1h))
        # is best done in the frontend using the raw data fetched.
        # However, you *could* do some pre-processing here if beneficial, e.g., grouping by timestamp.
        # For now, we'll return the raw data points grouped by DATA_ID.
        # The frontend (React) will receive this structured data and use the xlsx library to create the file.

        # Group raw data by DATA_ID for easier frontend handling
        grouped_data: Dict[int, List[PlcDataHistorical]] = {}
        for point in raw_data_points:
            if point.DATA_ID not in grouped_data:
                grouped_data[point.DATA_ID] = []
            grouped_data[point.DATA_ID].append(point)

        # Prepare data for JSON response (frontend will convert to XLSX)
        # Return a structure that's easy for the frontend to consume.
        # Example: List of dictionaries, one per data point, with timestamp and values for each requested data_id
        export_ready_data = []
        # Get all unique timestamps
        unique_timestamps = sorted(set(point.TIMESTAMP for point in raw_data_points))
        data_id_set = set(data_ids)

        # Create a map for quick lookup: (timestamp, data_id) -> DATA value
        data_map: Dict[tuple[datetime.datetime, int], float] = {
            (point.TIMESTAMP, point.DATA_ID): point.DATA for point in raw_data_points if point.DATA is not None
        }

        # Build the export data structure (list of rows, each row has timestamp and data columns)
        for timestamp in unique_timestamps:
            row = {"timestamp": timestamp.isoformat()} # Use ISO format for easy parsing in frontend
            for data_id in data_ids:
                # Get the data value for this timestamp and data_id
                value = data_map.get((timestamp, data_id))
                # Add the value to the row (keyed by data_id string)
                row[str(data_id)] = value # Handle None if needed (e.g., keep as None, or use "")
            export_ready_data.append(row)

        logger.info(f"Prepared {len(export_ready_data)} rows for export.")
        # Return the structured data. Frontend will handle XLSX creation.
        return export_ready_data

    else:
        # Handle other granularities if added (daily, monthly, etc. for direct export aggregates)
        # For now, only hourly/raw is supported for detailed export
        logger.warning(f"Unsupported export_granularity requested: {export_granularity}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Export granularity '{export_granularity}' is not currently supported for detailed export. Use 'hourly'."
        )

# --- END NEW: Export Endpoint ---