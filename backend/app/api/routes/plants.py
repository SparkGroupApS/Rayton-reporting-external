# backend/app/api/routes/plants.py

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.api.deps import CurrentUser, SessionDep
from app.core.db import get_data_async_session
from app.models import PlantList, Tenant

router = APIRouter(prefix="/plants", tags=["plants"])


@router.get("/{plant_id}")
async def read_plant_by_id(
    plant_id: int,
    current_user: CurrentUser,
    primary_session: SessionDep,
    data_session: AsyncSession = Depends(get_data_async_session),
) -> Any:
    """
    Get plant details by plant_id.
    Checks that the user has access to this plant through their tenant.
    """
    # Check if user's tenant has access to this plant
    if not current_user.is_superuser:
        # Get user's tenant
        tenant = await primary_session.get(Tenant, current_user.tenant_id)
        if not tenant:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Tenant not found"
            )

        # Check if tenant's plant_id matches requested plant_id
        if tenant.plant_id != plant_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to access this plant"
            )

    # Fetch plant from data database
    statement = select(PlantList).where(PlantList.PLANT_ID == plant_id)
    result = await data_session.exec(statement)
    plant = result.first()

    if not plant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Plant with ID {plant_id} not found"
        )

    # Return plant data as dict
    return {
        "ID": plant.ID,
        "PLANT_ID": plant.PLANT_ID,
        "latitude": plant.latitude,
        "longitude": plant.longitude,
        "timezone": plant.timezone,
        "TEXT_L1": plant.TEXT_L1,
        "TEXT_L2": plant.TEXT_L2,
        "created_at": plant.created_at,
        "updated_at": plant.updated_at,
    }


@router.get("/")
async def read_all_plants(
    current_user: CurrentUser,
    primary_session: SessionDep,
    data_session: AsyncSession = Depends(get_data_async_session),
) -> Any:
    """
    Get all plants.
    For superusers: returns all plants.
    For regular users: returns only plants their tenant has access to.
    """
    # For superusers, return all plants
    if current_user.is_superuser or current_user.role in ["admin", "manager"]:
        statement = select(PlantList)
        result = await data_session.exec(statement)
        plants = result.all()

        return [
            {
                "ID": plant.ID,
                "PLANT_ID": plant.PLANT_ID,
                "latitude": plant.latitude,
                "longitude": plant.longitude,
                "timezone": plant.timezone,
                "TEXT_L1": plant.TEXT_L1,
                "TEXT_L2": plant.TEXT_L2,
                "created_at": plant.created_at,
                "updated_at": plant.updated_at,
            }
            for plant in plants
        ]

    # For regular users, return only their tenant's plant
    tenant = await primary_session.get(Tenant, current_user.tenant_id)
    if not tenant or not tenant.plant_id:
        return []

    statement = select(PlantList).where(PlantList.PLANT_ID == tenant.plant_id)
    result = await data_session.exec(statement)
    plant = result.first()

    if not plant:
        return []

    return [
        {
            "ID": plant.ID,
            "PLANT_ID": plant.PLANT_ID,
            "latitude": plant.latitude,
            "longitude": plant.longitude,
            "timezone": plant.timezone,
            "TEXT_L1": plant.TEXT_L1,
            "TEXT_L2": plant.TEXT_L2,
            "created_at": plant.created_at,
            "updated_at": plant.updated_at,
        }
    ]
