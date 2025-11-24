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
        "tab_config": plant.tab_config,
        "created_at": plant.created_at,
        "updated_at": plant.updated_at,
    }


@router.get("/")
async def read_all_plants(
    current_user: CurrentUser,
    primary_session: SessionDep,
    skip: int = 0,
    limit: int = 100,
    data_session: AsyncSession = Depends(get_data_async_session),
) -> Any:
    """
    Get all plants.
    For superusers: returns all plants.
    For regular users: returns only plants their tenant has access to.
    """
    # For superusers, return all plants
    if current_user.is_superuser or current_user.role in ["admin", "manager"]:
        statement = select(PlantList).offset(skip).limit(limit)
        result = await data_session.exec(statement)
        plants = result.all()

        # Get total count for pagination
        count_statement = select(PlantList)
        count_result = await data_session.exec(count_statement)
        total_count = len(count_result.all())

        return {
            "data": [
                {
                    "ID": plant.ID,
                    "PLANT_ID": plant.PLANT_ID,
                    "latitude": plant.latitude,
                    "longitude": plant.longitude,
                    "timezone": plant.timezone,
                    "TEXT_L1": plant.TEXT_L1,
                    "TEXT_L2": plant.TEXT_L2,
                    "tab_config": plant.tab_config,
                    "created_at": plant.created_at,
                    "updated_at": plant.updated_at,
                }
                for plant in plants
            ],
            "count": total_count
        }

    # For regular users, return only their tenant's plant
    tenant = await primary_session.get(Tenant, current_user.tenant_id)
    if not tenant or not tenant.plant_id:
        return {"data": [], "count": 0}

    statement = select(PlantList).where(PlantList.PLANT_ID == tenant.plant_id)
    result = await data_session.exec(statement)
    plant = result.first()

    if not plant:
        return {"data": [], "count": 0}

    return {
        "data": [
            {
                "ID": plant.ID,
                "PLANT_ID": plant.PLANT_ID,
                "latitude": plant.latitude,
                "longitude": plant.longitude,
                "timezone": plant.timezone,
                "TEXT_L1": plant.TEXT_L1,
                "TEXT_L2": plant.TEXT_L2,
                "tab_config": plant.tab_config,
                "created_at": plant.created_at,
                "updated_at": plant.updated_at,
            }
        ],
        "count": 1
    }


@router.post("/")
async def create_plant(
    plant_data: dict,
    current_user: CurrentUser,
    data_session: AsyncSession = Depends(get_data_async_session),
) -> Any:
    """
    Create a new plant.
    Only superusers can create plants.
    """
    if not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to create plants"
        )

    # Validate required fields
    required_fields = ["PLANT_ID", "timezone"]
    for field in required_fields:
        if field not in plant_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Missing required field: {field}"
            )

    # Check if plant with this ID already exists
    existing_statement = select(PlantList).where(PlantList.PLANT_ID == plant_data["PLANT_ID"])
    existing_result = await data_session.exec(existing_statement)
    existing_plant = existing_result.first()
    if existing_plant:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Plant with ID {plant_data['PLANT_ID']} already exists"
        )

    # Create new plant
    new_plant = PlantList(
        PLANT_ID=plant_data["PLANT_ID"],
        latitude=plant_data.get("latitude"),
        longitude=plant_data.get("longitude"),
        timezone=plant_data.get("timezone", "Europe/Kyiv"),
        TEXT_L1=plant_data.get("TEXT_L1"),
        TEXT_L2=plant_data.get("TEXT_L2"),
        tab_config=plant_data.get("tab_config")
    )

    data_session.add(new_plant)
    await data_session.commit()
    await data_session.refresh(new_plant)

    return {
        "ID": new_plant.ID,
        "PLANT_ID": new_plant.PLANT_ID,
        "latitude": new_plant.latitude,
        "longitude": new_plant.longitude,
        "timezone": new_plant.timezone,
        "TEXT_L1": new_plant.TEXT_L1,
        "TEXT_L2": new_plant.TEXT_L2,
        "tab_config": new_plant.tab_config,
        "created_at": new_plant.created_at,
        "updated_at": new_plant.updated_at,
    }


@router.put("/{plant_id}")
async def update_plant(
    plant_id: int,
    plant_data: dict,
    current_user: CurrentUser,
    data_session: AsyncSession = Depends(get_data_async_session),
) -> Any:
    """
    Update an existing plant.
    Only superusers can update plants.
    """
    if not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to update plants"
        )

    # Fetch existing plant
    statement = select(PlantList).where(PlantList.PLANT_ID == plant_id)
    result = await data_session.exec(statement)
    plant = result.first()

    if not plant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Plant with ID {plant_id} not found"
        )

    # Update plant fields
    update_data = {
        "latitude": plant_data.get("latitude", plant.latitude),
        "longitude": plant_data.get("longitude", plant.longitude),
        "timezone": plant_data.get("timezone", plant.timezone),
        "TEXT_L1": plant_data.get("TEXT_L1", plant.TEXT_L1),
        "TEXT_L2": plant_data.get("TEXT_L2", plant.TEXT_L2),
        "tab_config": plant_data.get("tab_config", plant.tab_config)
    }

    for field, value in update_data.items():
        setattr(plant, field, value)

    await data_session.commit()
    await data_session.refresh(plant)

    return {
        "ID": plant.ID,
        "PLANT_ID": plant.PLANT_ID,
        "latitude": plant.latitude,
        "longitude": plant.longitude,
        "timezone": plant.timezone,
        "TEXT_L1": plant.TEXT_L1,
        "TEXT_L2": plant.TEXT_L2,
        "tab_config": plant.tab_config,
        "created_at": plant.created_at,
        "updated_at": plant.updated_at,
    }


@router.delete("/{plant_id}")
async def delete_plant(
    plant_id: int,
    current_user: CurrentUser,
    data_session: AsyncSession = Depends(get_data_async_session),
) -> Any:
    """
    Delete a plant.
    Only superusers can delete plants.
    """
    if not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to delete plants"
        )

    # Fetch existing plant
    statement = select(PlantList).where(PlantList.PLANT_ID == plant_id)
    result = await data_session.exec(statement)
    plant = result.first()

    if not plant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Plant with ID {plant_id} not found"
        )

    await data_session.delete(plant)
    await data_session.commit()

    return {"message": f"Plant with ID {plant_id} deleted successfully"}
