# In backend/app/api/routes/historical_data.py

import datetime
import uuid
import logging
#import pytz

from typing import List, Optional, Dict, Any, Literal
from collections import defaultdict
from enum import Enum, StrEnum

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import *
from sqlmodel import select, col, func
from sqlmodel.ext.asyncio.session import AsyncSession
from datetime import datetime, date, time, timedelta


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


class ExportGranularity(StrEnum):
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
    start: datetime | None = Query(None, description="Start timestamp"),
    end: datetime | None = Query(None, description="End timestamp"),
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

    # 4. STEP 1: Query ONLY the numerical data (no JOIN with TextList)
    # For daily aggregation, extend the start date by one day earlier to get the baseline for first day's delta
    extended_start = start
    if aggregate_by == "day" and start:
        extended_start = start - timedelta(days=1)
    
    import time as time_module
    query_start = time_module.time()
    
    # OPTIMIZATION: First, find which DATA_IDs actually have data in the time range
    # This avoids scanning empty ranges for DATA_IDs that don't exist
    data_id_query = select(PlcDataHistorical.DATA_ID.distinct()).where(
        and_(
            col(PlcDataHistorical.PLANT_ID) == target_plant_id,
            col(PlcDataHistorical.DATA_ID).between(100, 199),
            col(PlcDataHistorical.TIMESTAMP) >= extended_start if extended_start else True,
            col(PlcDataHistorical.TIMESTAMP) <= end if end else True,
        )
    )
    
    data_id_result = await data_session.exec(data_id_query)
    active_data_ids = list(data_id_result.all())
    logger.info(f"Found {len(active_data_ids)} active DATA_IDs: {active_data_ids}")
    
    if not active_data_ids:
        # No data found
        query_time = time_module.time() - query_start
        logger.info(f"No data found, query took {query_time:.3f}s")
        return HistoricalDataGroupedResponse(series=[])
    # Main aggregation query
    query = select(
        PlcDataHistorical.DATA_ID,
        bucket_expr.label("bucket"),
        func.max(PlcDataHistorical.TIMESTAMP).label("latest_ts"),
        func.max(PlcDataHistorical.DATA).label("value"),
    ).where(
        and_(
            col(PlcDataHistorical.PLANT_ID) == target_plant_id,
            col(PlcDataHistorical.DATA_ID).in_(active_data_ids),  # Only query IDs with actual data
            col(PlcDataHistorical.TIMESTAMP) >= extended_start if extended_start else True,
            col(PlcDataHistorical.TIMESTAMP) <= end if end else True,
        )
    ).group_by(
        PlcDataHistorical.DATA_ID, "bucket"
    ).order_by(
        PlcDataHistorical.DATA_ID.asc(), "bucket"
    )
    
    # Log the generated SQL for debugging
    from sqlalchemy.dialects import mysql
    compiled_query = query.compile(dialect=mysql.dialect(), compile_kwargs={"literal_binds": True})
    logger.info(f"Generated SQL: {compiled_query}")
    
    results = await data_session.exec(query)
    rows = results.all()

    query_time = time_module.time() - query_start
    logger.info(f"Main aggregation query took {query_time:.3f}s, returned {len(rows)} rows")

    # 5. STEP 2: Collect unique DATA_IDs and fetch labels separately
    label_start = time_module.time()
    unique_data_ids = set()
    by_id = defaultdict(list)
    
    for data_id, bucket, latest_ts, value in rows:
        unique_data_ids.add(data_id)
        by_id[data_id].append({"bucket": bucket, "timestamp": latest_ts, "value": value})
    
    # Fetch labels for all unique DATA_IDs in a single, simple query
    id_metadata = {}
    if unique_data_ids:
        label_query = select(
            TextList.DATA_ID,
            TextList.TEXT_L1,
            TextList.TEXT_L2,
        ).where(
            col(TextList.DATA_ID).in_(unique_data_ids),
            col(TextList.CLASS_ID) == 0,
        )
        label_results = await data_session.exec(label_query)
        label_rows = label_results.all()
        
        for data_id, label, label_local in label_rows:
            id_metadata[data_id] = {"label": label, "label_local": label_local}
    
    label_time = time_module.time() - label_start
    logger.info(f"Label query took {label_time:.3f}s for {len(unique_data_ids)} unique IDs")

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
            if start and isinstance(curr["bucket"], date):
                curr_datetime = datetime.combine(curr["bucket"], time.min)
                if curr_datetime.date() < start.date():
                    include_in_result = False
            elif start and isinstance(curr["bucket"], str) and aggregate_by == "month":
                year, month = curr["bucket"].split('-')
                curr_datetime = datetime(int(year), int(month), 1)
                start_month = datetime(start.year, start.month, 1)
                if curr_datetime < start_month:
                    include_in_result = False
            elif start and isinstance(curr["bucket"], str) and aggregate_by == "year":
                curr_year = int(curr["bucket"])
                if curr_year < start.year:
                    include_in_result = False
            
            if include_in_result:
                if isinstance(curr["bucket"], date):
                    timestamp_dt = datetime.combine(curr["bucket"], time.min)
                elif isinstance(curr["bucket"], str):
                    if aggregate_by == "month":
                        year, month = curr["bucket"].split('-')
                        timestamp_dt = datetime(int(year), int(month), 1)
                    else: # year
                        timestamp_dt = datetime(int(curr["bucket"]), 1, 1)
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
                if isinstance(entry["bucket"], date):
                    entry_datetime = datetime.combine(entry["bucket"], time.min)
                    is_in_range = start.date() <= entry_datetime.date() <= end.date() if end else start.date() <= entry_datetime.date()
                elif isinstance(entry["bucket"], str) and aggregate_by == "month":
                    year, month = entry["bucket"].split('-')
                    entry_datetime = datetime(int(year), int(month), 1)
                    start_month = datetime(start.year, start.month, 1)
                    end_month = datetime(end.year, end.month, 1) if end else start_month
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
                elif is_in_range and i > 0 and i < len(entries) and entries[i-1]["bucket"] < (start.date() if isinstance(entries[i]["bucket"], date) else entries[i]["bucket"]):
                    # Handle case where the entry is in range but the previous one was before the requested range
                    # In this case, we calculate delta from the previous entry even if it's outside the range
                    prev = entries[i - 1]
                    curr = entries[i]
                    delta = (curr["value"] or 0) - (prev["value"] or 0)
                    
                    if isinstance(curr["bucket"], date):
                        timestamp_dt = datetime.combine(curr["bucket"], time.min)
                    elif isinstance(curr["bucket"], str):
                        if aggregate_by == "month":
                            year, month = curr["bucket"].split('-')
                            timestamp_dt = datetime(int(year), int(month), 1)
                        else: # year
                            timestamp_dt = datetime(int(curr["bucket"]), 1, 1)
                    else:
                        timestamp_dt = curr["timestamp"]
                    
                    timestamp_ms = int(timestamp_dt.timestamp() * 1000)
                    
                    grouped_data[data_id].data.append(
                        TimeSeriesPoint(x=timestamp_ms, y=round(delta, 3))
                    )

    series_list = list(grouped_data.values())
    return HistoricalDataGroupedResponse(series=series_list)


@router.get("/export/", response_model=HistoricalDataGroupedResponse)
async def export_historical_data(
    current_user: CurrentUser,
    primary_session: SessionDep,
    tenant_id: uuid.UUID = Query(..., description="Tenant ID for plant lookup"),
    start: datetime | None = Query(None, description="Start timestamp"),
    end: datetime | None = Query(None, description="End timestamp"),
    export_granularity: ExportGranularity = Query(
        ..., description="Granularity for exported data (e.g., hourly)"
    ),
    data_session: AsyncSession = Depends(get_data_async_session),
) -> Any:
    """
    Export hourly consumption deltas using closest-to-hour-boundary logic.
    All timestamps are in local Kyiv time (Europe/Kyiv).
    """
    logger.info(
        f"Initiating export for tenant_id={tenant_id}, "
        f"start={start}, end={end}, granularity={export_granularity}"
    )

    # 1. Permission Check
    if not current_user.is_superuser and current_user.tenant_id != tenant_id:
        raise HTTPException(status_code=403, detail="Not authorized for this tenant")

    # 2. Lookup plant_id
    target_plant_id = await get_plant_id_for_tenant(tenant_id, primary_session)

    # 3. Validate Inputs
    if start and end and start >= end:
        raise HTTPException(status_code=400, detail="Start datetime must be before end datetime.")

    # 4. Granularity Check
    if export_granularity != ExportGranularity.hourly:
        raise HTTPException(
            status_code=400,
            detail="Only 'hourly' granularity is supported."
        )

    # 5. Extend time range for baseline
    extended_start = start - timedelta(hours=1) if start else None
    query_end = end or datetime.now()

    # 6. MariaDB CTE: closest reading to :00:00 per hour
    cte_sql = text("""
        WITH hour_boundaries AS (
            SELECT 
                DATA_ID,
                DATE_FORMAT(TIMESTAMP, '%Y-%m-%d %H:00:00') AS hour_bucket_str,
                TIMESTAMP,
                DATA,
                ABS(TIMESTAMPDIFF(SECOND, TIMESTAMP, 
                    STR_TO_DATE(DATE_FORMAT(TIMESTAMP, '%Y-%m-%d %H:00:00'), '%Y-%m-%d %H:%i:%s')
                )) AS seconds_to_boundary,
                ROW_NUMBER() OVER (
                    PARTITION BY DATA_ID, DATE_FORMAT(TIMESTAMP, '%Y-%m-%d %H:00:00')
                    ORDER BY ABS(TIMESTAMPDIFF(SECOND, TIMESTAMP, 
                        STR_TO_DATE(DATE_FORMAT(TIMESTAMP, '%Y-%m-%d %H:00:00'), '%Y-%m-%d %H:%i:%s')
                    ))
                ) AS rn
            FROM PLC_DATA_HISTORICAL
            WHERE PLANT_ID = :plant_id
              AND DATA_ID BETWEEN 100 AND 199
              AND TIMESTAMP >= :extended_start
              AND TIMESTAMP <= :query_end
        ),
        closest_readings AS (
            SELECT 
                DATA_ID,
                hour_bucket_str,
                DATA,
                LAG(DATA) OVER (PARTITION BY DATA_ID ORDER BY hour_bucket_str) AS prev_data
            FROM hour_boundaries
            WHERE rn = 1
        )
        SELECT 
            cr.DATA_ID,
            cr.hour_bucket_str AS bucket_local,  -- This is 10:00:00 for 10–11
            (cr.DATA - cr.prev_data) AS hourly_delta
        FROM closest_readings cr
        WHERE cr.prev_data IS NOT NULL
          AND STR_TO_DATE(cr.hour_bucket_str, '%Y-%m-%d %H:%i:%s') >= :start
          AND (:end IS NULL OR STR_TO_DATE(cr.hour_bucket_str, '%Y-%m-%d %H:%i:%s') <= :end)
        ORDER BY cr.DATA_ID, cr.hour_bucket_str
    """)

    try:
        result = await data_session.execute(
            cte_sql,
            {
                "plant_id": target_plant_id,
                "extended_start": extended_start,
                "query_end": query_end,
                "start": start,
                "end": end,
            }
        )
        rows = result.fetchall()
        logger.debug(f"Fetched {len(rows)} hourly delta rows (DATA_ID 100–199).")
    except Exception as e:
        logger.error(f"Database error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch export data.")

    # === Fetch labels for all DATA_IDs in result ===
    data_ids_in_result = {row.DATA_ID for row in rows} if rows else set()
    label_map = {}
    if data_ids_in_result:
        label_result = await data_session.execute(
            select(TextList.DATA_ID, TextList.TEXT_L1, TextList.TEXT_L2)
            .where(TextList.DATA_ID.in_(data_ids_in_result), TextList.CLASS_ID == 0)
        )
        label_map = {
            r.DATA_ID: {"label": r.TEXT_L1, "label_local": r.TEXT_L2}
            for r in label_result
        }

    # === Group and convert to response ===
    grouped_data: dict[int, TimeSeriesData] = {}

    kyiv_tz = pytz.timezone("Europe/Kyiv")

    for row in rows:
        data_id = row.DATA_ID
        hour_str = row.bucket_local
        delta = row.hourly_delta

        # Skip invalid deltas
        if delta is None or delta < 0 or delta > 10000:
            continue

        # Parse local time (naive)
        try:
            local_naive = datetime.strptime(hour_str, "%Y-%m-%d %H:%M:%S")
        except ValueError as e:
            logger.warning(f"Invalid timestamp format: {hour_str} — {e}")
            continue

        # Localize to Kyiv time
        local_aware = kyiv_tz.localize(local_naive)
        timestamp_ms = int(local_aware.timestamp() * 1000)

        # Initialize series if not exists
        if data_id not in grouped_data:
            metadata = label_map.get(data_id, {})
            series_name = (
                metadata.get("label_local")
                or metadata.get("label")
                or f"Data ID {data_id}"
            )
            grouped_data[data_id] = TimeSeriesData(
                data_id=data_id,
                name=series_name,
                data=[]
            )

        # Append point
        grouped_data[data_id].data.append(
            TimeSeriesPoint(x=timestamp_ms, y=round(float(delta), 3))
        )

    # Sort series by data_id
    series_list = [grouped_data[k] for k in sorted(grouped_data.keys())]

    logger.info(
        f"Export ready: {sum(len(s.data) for s in series_list)} points "
        f"across {len(series_list)} series (DATA_ID 100–199)."
    )

    return HistoricalDataGroupedResponse(series=series_list)