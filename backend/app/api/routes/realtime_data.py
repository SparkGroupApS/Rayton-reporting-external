# backend/app/api/routes/realtime_data.py

import uuid
from typing import Any  # Import Dict

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import case, func
from sqlalchemy.orm import aliased
from sqlmodel import and_, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.api.deps import CurrentUser, SessionDep
from app.core.db import get_data_async_session
from app.models import (
    PlantConfig,
    PlcDataRealtime,
    RealtimeDataPoint,
    RealtimeDataResponse,
    Tenant,
    TextList,
)


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


router = APIRouter(prefix="/realtime-data", tags=["realtime-data"])


@router.get("/latest", response_model=RealtimeDataResponse)
async def read_realtime_latest(
    current_user: CurrentUser,
    primary_session: SessionDep,
    data_session: AsyncSession = Depends(get_data_async_session),
    tenant_id: uuid.UUID = Query(..., description="Tenant ID to fetch data for"),
    device_ids: list[int] = Query(..., description="List of DEVICE_IDs to fetch"),
) -> Any:
    """
    Fetch the latest realtime data points for given DEVICE_IDs and tenant.
    """

    # 1. Permission Check
    if not current_user.is_superuser and current_user.tenant_id != tenant_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized for this tenant")

    # 2. Lookup plant_id for tenant
    target_plant_id = await get_plant_id_for_tenant(tenant_id, primary_session)

    # 3. Build subquery to get the latest TIMESTAMP per DATA_ID for this plant
    subquery = (
        select(
            PlcDataRealtime.DATA_ID,
            func.max(PlcDataRealtime.TIMESTAMP).label("latest_timestamp"),
        )
        .where(PlcDataRealtime.PLANT_ID == target_plant_id)
        .where(PlcDataRealtime.DEVICE_ID.in_(device_ids))
        .group_by(PlcDataRealtime.DATA_ID)
        .subquery()
    )

    TextListChild = aliased(TextList)

    # print("target_plant_id:", target_plant_id)
    # print("device_ids:", device_ids)



    # 4. Main query
    # -- Дополнительный alias для второго TextList (если CHILD_CLASS_ID не NULL)



    # CASE: если есть CHILD_CLASS_ID, то берём текст из дочернего TextListChild
    text_value_expr = case(
        (
            TextList.CHILD_CLASS_ID.isnot(None),
            TextListChild.TEXT_L2,
        ),
        else_=PlcDataRealtime.DATA,
    ).label("resolved_text")


    statement = (
        select(
            PlcDataRealtime.DATA_ID,
            PlcDataRealtime.PLANT_ID,
            PlcDataRealtime.DEVICE_ID,
            PlcDataRealtime.TIMESTAMP,
            PlcDataRealtime.DATA,
            text_value_expr,  # ← теперь используем
            TextList.TEXT_L1,
            TextList.TEXT_L2,
            TextList.TEXT_ID,
        )
        .join(
            subquery,
            and_(
                PlcDataRealtime.DATA_ID == subquery.c.DATA_ID,
                PlcDataRealtime.TIMESTAMP == subquery.c.latest_timestamp,
                PlcDataRealtime.PLANT_ID == target_plant_id,
                PlcDataRealtime.DEVICE_ID.in_(device_ids),
            ),
        )
        .join(
            PlantConfig,
            and_(
                PlcDataRealtime.PLANT_ID == PlantConfig.PLANT_ID,
                PlcDataRealtime.DEVICE_ID == PlantConfig.DEVICE_ID,
            ),
            isouter=True,
        )
        # основной TEXT_LIST
        .join(
            TextList,
            and_(
                PlcDataRealtime.DATA_ID == TextList.DATA_ID,
                TextList.CLASS_ID == PlantConfig.CLASS_ID,
            ),
            isouter=True,
        )
        # self join — дочерний TEXT_LIST
        .join(
            TextListChild,
            and_(
                TextListChild.CLASS_ID == TextList.CHILD_CLASS_ID,
                TextListChild.DATA_ID == PlcDataRealtime.DATA,
            ),
            isouter=True,
        )
        .order_by(
            # PlcDataRealtime.DEVICE_ID.asc(),
            PlcDataRealtime.DATA_ID.asc()
        )
    )


    # Выполняем
    results = await data_session.exec(statement)
    rows = results.all()

    # 6. Transform results
    latest_values = []
    for row in rows:
        dt_id, pl_id, dv_id, ts, d, resolved_text, tl1, tl2, tid = row  # добавили resolved_text
        series_name = tl2 or tid or f"Data ID {dt_id}"
        latest_values.append(
            RealtimeDataPoint(
                data_id=dt_id,
                plant_id=pl_id,
                device_id=dv_id,
                name=series_name,
                timestamp=int(ts.timestamp() * 1000),
                value=resolved_text,
            )
        )

    return RealtimeDataResponse(values=latest_values)
