from fastapi import APIRouter, Query, Depends, HTTPException, status
import datetime
from typing import List
from uuid import UUID
from sqlmodel import select
from app.api.deps import CurrentUser, SessionDep, get_mqtt_client
from app.models import PlcDataSettings, Tenant, PlcDataSettingsRow, PlcDataSettingsCreate, PlcDataSettingsUpdate, PlantConfig, TextList
from sqlmodel.ext.asyncio.session import AsyncSession
from app.core.db import get_data_async_session
from pydantic import BaseModel

# Import MQTT-related models and WebSocket manager
from app.models import (
    PlcDataSettingsMqttPayload,
    CommandResponse
)
from fastapi_mqtt import FastMQTT
from app.mqtt_handlers import mqtt

# Import WebSocket manager to register message-tenant mappings
from app.api.routes.ws import manager


# Extended response model that includes text values from related tables
class PlcDataSettingsExtendedRow(BaseModel):
    id: int
    plant_id: int
    device_id: int
    data_id: int
    data: float | None
    updated_at: datetime.datetime | None
    updated_by: str | None
    device_text: str | None  # TEXT_L2 from PLANT_CONFIG
    data_text: str | None    # TEXT_L2 from TEXT_LIST where CLASS_ID = 130


# Helper function to get device text from PLANT_CONFIG table
async def get_device_text(data_session: AsyncSession, plant_id: int, device_id: int) -> str | None:
    stmt = select(PlantConfig.TEXT_L2).where(
        PlantConfig.PLANT_ID == plant_id,
        PlantConfig.DEVICE_ID == device_id
    )
    result = await data_session.exec(stmt)
    return result.first()


# Helper function to get data text from TEXT_LIST table where CLASS_ID = 130
async def get_data_text(data_session: AsyncSession, data_id: int) -> str | None:
    stmt = select(TextList.TEXT_L2).where(
        TextList.DATA_ID == data_id,
        TextList.CLASS_ID == 130
    )
    result = await data_session.exec(stmt)
    return result.first()


router = APIRouter(prefix="/settings", tags=["settings"])

# New endpoint that returns extended data with text values from related tables
@router.get("/plc-data-settings", response_model=List[PlcDataSettingsExtendedRow])
async def get_plc_data_settings(
    current_user: CurrentUser,
    primary_session: SessionDep,
    data_session: AsyncSession = Depends(get_data_async_session),
    tenant_id: UUID = Query(..., description="Tenant ID to fetch data for"),
    plant_ids: List[int] = Query(None, description="Optional list of PLANT_IDs to fetch"),
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

    # Получаем настройки для plant_id
    stmt = select(PlcDataSettings).where(PlcDataSettings.PLANT_ID == tenant.plant_id, PlcDataSettings.DEVICE_ID == 0) 

    if plant_ids:
        stmt = stmt.where(PlcDataSettings.PLANT_ID.in_(plant_ids))
    
    if device_ids:
        stmt = stmt.where(PlcDataSettings.DEVICE_ID.in_(device_ids))

    results = (await data_session.exec(stmt)).all()
    if not results:
        # Return an empty list instead of 404 if no settings are found
        return []

    # Convert DB rows to extended API response models with text values from related tables
    response_data: list[PlcDataSettingsExtendedRow] = []
    for db_row in results:
        try:
            if db_row is None:
                continue

            # Get the text values from related tables
            device_text = await get_device_text(data_session, db_row.PLANT_ID, db_row.DEVICE_ID)
            data_text = await get_data_text(data_session, db_row.DATA_ID)

            # Create a dictionary to map DB attributes to Pydantic model fields
            row_dict = {
                "id": db_row.ID,
                "plant_id": db_row.PLANT_ID,
                "device_id": db_row.DEVICE_ID,
                "data_id": db_row.DATA_ID,
                "data": db_row.DATA,
                "updated_at": db_row.UPDATED_AT,
                "updated_by": db_row.UPDATED_BY,
                "device_text": device_text,
                "data_text": data_text,
            }
            validated_row = PlcDataSettingsExtendedRow.model_validate(row_dict)
            response_data.append(validated_row)
        except Exception as e:
            # Log the error and the problematic row for debugging
            error_msg = f"Error processing DB row ID {getattr(db_row, 'ID', 'Unknown')}: {str(e)}"
            print(f"{error_msg}. Row Data: {vars(db_row)}")
            raise HTTPException(
                status_code=500,
                detail="Internal server error processing PLC data settings.",
            )

    return response_data


@router.put("/plc-data-settings", response_model=CommandResponse, status_code=status.HTTP_202_ACCEPTED)
async def update_plc_data_settings(
    settings: List[PlcDataSettingsUpdate],
    current_user: CurrentUser,
    primary_session: SessionDep,
    data_session: AsyncSession = Depends(get_data_async_session),
    tenant_id: UUID = Query(..., description="Tenant ID to update settings for"),
    mqtt_client: FastMQTT = Depends(get_mqtt_client)
):
    if not current_user.is_superuser and current_user.tenant_id != tenant_id:
         raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized for this tenant")

    # Get plant_id for the tenant
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

    plant_id = tenant.plant_id

    # Prepare settings data for MQTT payload - only include data_id and data
    settings_for_mqtt = []
    for setting in settings:
        # Find the existing setting to get the actual data_id from the database
        stmt = select(PlcDataSettings).where(
            PlcDataSettings.PLANT_ID == plant_id,
            PlcDataSettings.ID == setting.id  # Using the ID from the frontend as the database ID
        )
        result = await data_session.exec(stmt)
        db_setting = result.first()
        
        if not db_setting:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Setting with ID {setting.id} not found for plant {plant_id}"
            )
        
        settings_for_mqtt.append({
            "data_id": db_setting.DATA_ID,  # Use the actual DATA_ID from the database
            "data": setting.data
        })

    # --- PUBLISH TO MQTT ---
    try:
        # Create the PLC data settings payload
        # Include current user's email in the payload, with fallback to user ID if email is None
        updated_by_info = current_user.email or str(current_user.id)
        plc_settings_payload = PlcDataSettingsMqttPayload(
            plant_id=plant_id,
            settings=settings_for_mqtt,
            updated_by=updated_by_info
        )
                
        # Define the specific topic for PLC data settings
        topic = f"cmd/cloud-to-site/{plant_id}/plc-settings"
        
        print(f"Publishing PLC data settings to MQTT topic: {topic} (MsgID: {plc_settings_payload.message_id})")
        
        # Register the message-tenant mapping before publishing
        manager.register_message_tenant_mapping(plc_settings_payload.message_id, str(tenant_id))
        
        # Publish the JSON of the PLC settings payload
        mqtt_client.publish(
            topic, 
            plc_settings_payload.model_dump_json(), 
            qos=0 # Use QoS 1 for commands to ensure they arrive
        )
        
        # Return the 202 response with the tracking ID
        return CommandResponse(
            message="PLC data settings update sent",
            message_id=plc_settings_payload.message_id
        )
        
    except Exception as e:
        print(f"CRITICAL: Failed to publish PLC data settings to MQTT for plant {plant_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to publish to MQTT")
