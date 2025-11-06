from fastapi import APIRouter, Query, Depends, HTTPException, status
from typing import List
from uuid import UUID
from sqlmodel import select
from app.api.deps import CurrentUser, SessionDep
from app.models import PlantConfig, Tenant, PlantConfigResponse, DeviceInfo
from sqlmodel.ext.asyncio.session import AsyncSession
from app.core.db import get_data_async_session


router = APIRouter()

@router.get("/plant-config", response_model=PlantConfigResponse)
async def get_plant_config(
    current_user: CurrentUser,
    primary_session: SessionDep,
    data_session: AsyncSession = Depends(get_data_async_session),
    tenant_id: UUID = Query(..., description="Tenant ID to fetch data for"),
    device_ids: List[int] = Query(None, description="Optional list of DEVICE_IDs to fetch"),
):
    # Проверяем существование тенанта
    tenant = await primary_session.get(Tenant, tenant_id)
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Tenant {tenant_id} not found"
        )

    if tenant.plant_id is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No plant_id configured for tenant {tenant_id}"
        )

    # Получаем устройства для plant_id
    stmt = select(
        PlantConfig.DEVICE_ID,
        PlantConfig.TEXT_L1,
        PlantConfig.TEXT_L2,
        PlantConfig.CLASS_ID,
        PlantConfig.PARENT_ID,
        PlantConfig.PLANT_ID
    ).where(PlantConfig.PLANT_ID == tenant.plant_id)

    if device_ids:
        stmt = stmt.where(PlantConfig.DEVICE_ID.in_(device_ids))

    results = (await data_session.exec(stmt)).all()
    if not results:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No devices found for this plant"
        )

    devices = [
        DeviceInfo(
            device_id=r[0],
            name=r[2] or r[1] or f"Device {r[0]}",
            class_id=r[3],
            parent_id=r[4],
            plant_id=r[5]
        )
        for r in results
    ]

    return PlantConfigResponse(
        tenant_id=str(tenant_id),
        devices=devices
    )
