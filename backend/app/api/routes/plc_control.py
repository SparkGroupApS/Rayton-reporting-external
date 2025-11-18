import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi_mqtt import FastMQTT
from pydantic import BaseModel
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.api.deps import CurrentUser, SessionDep, get_mqtt_client

# Import WebSocket manager to register message-tenant mappings
from app.api.routes.ws import manager
from app.core.db import get_data_async_session

# Import MQTT-related models and WebSocket manager
from app.models import (
    CommandResponse,
    PlantConfig,
    PlcDataControls,
    PlcDataSettingsMqttPayload,
    PlcDataSettingsUpdate,
    Tenant,
    TextList,
)


# Extended response model that includes text values from related tables
class PlcDataControlExtendedRow(BaseModel):
    id: int
    plant_id: int
    control_type: int  # Renamed from device_id to control_type
    data_id: int
    data: float | None
    updated_at: datetime.datetime | None
    updated_by: str | None
    device_text: str | None  # TEXT_L2 from PLANT_CONFIG
    data_text: str | None  # TEXT_L2 from TEXT_LIST where CLASS_ID = 130
    input_type: str  # "number", "textlist", or "boolean"
    textlist_entries: dict[str, str] | None = None  # Only for textlist input_type


# Helper function to get device text from PLANT_CONFIG table
async def get_device_text(
    data_session: AsyncSession, plant_id: int, device_id: int
) -> str | None:
    stmt = select(PlantConfig.TEXT_L2).where(
        PlantConfig.PLANT_ID == plant_id, PlantConfig.DEVICE_ID == device_id
    )
    result = await data_session.exec(stmt)
    return result.first()


# Helper function to get data text and check for CHILD_CLASS_ID from TEXT_LIST table
async def get_data_info(
    data_session: AsyncSession, data_id: int
) -> tuple[str | None, str | None, int | None, dict[str, str] | None]:
    # First, get the main entry for this DATA_ID to check if it has CHILD_CLASS_ID
    stmt = (
        select(TextList)
        .where(TextList.DATA_ID == data_id, TextList.CLASS_ID == 140)
        .limit(1)
    )  # Get any entry for this DATA_ID to check CHILD_CLASS_ID
    result = await data_session.exec(stmt)
    main_entry = result.first()

    if (
        main_entry
        and main_entry.CHILD_CLASS_ID is not None
        and main_entry.CHILD_CLASS_ID != 0
    ):
        # This data_id has a CHILD_CLASS_ID, so we need to fetch the textlist entries
        child_class_id = main_entry.CHILD_CLASS_ID
        # Fetch all entries where CLASS_ID = CHILD_CLASS_ID
        child_stmt = select(TextList).where(TextList.CLASS_ID == child_class_id)
        child_results = await data_session.exec(child_stmt)
        child_entries = child_results.all()

        # Create a mapping of DATA_ID to TEXT_L2 for the textlist entries
        textlist_entries = {}
        for entry in child_entries:
            if entry.DATA_ID is not None and entry.TEXT_L2 is not None:
                textlist_entries[str(entry.DATA_ID)] = entry.TEXT_L2

        # Use the main entry's TEXT_L2 as the data_text
        data_text = main_entry.TEXT_L2
        return data_text, data_text, child_class_id, textlist_entries
    else:
        # No CHILD_CLASS_ID, so it's a regular entry
        stmt = select(TextList.TEXT_L2).where(
            TextList.DATA_ID == data_id, TextList.CLASS_ID == 140
        )
        result = await data_session.exec(stmt)
        data_text = result.first()
        return data_text, data_text, None, None


router = APIRouter(prefix="/control", tags=["control"])


# New endpoint that returns extended data with text values from related tables
@router.get("/plc-data-control", response_model=list[PlcDataControlExtendedRow])
async def get_plc_control(
    current_user: CurrentUser,
    primary_session: SessionDep,
    data_session: AsyncSession = Depends(get_data_async_session),
    tenant_id: UUID = Query(..., description="Tenant ID to fetch data for"),
    plant_ids: list[int] = Query(
        None, description="Optional list of PLANT_IDs to fetch"
    ),
    control_types: list[int] = Query(
        None, description="Optional list of CONTROL_TYPEs to fetch"
    ),
):
    # Проверяем существование тенанта
    tenant = await primary_session.get(Tenant, tenant_id)
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Tenant {tenant_id} not found",
        )

    if tenant.plant_id is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No plant_id configured for tenant {tenant_id}",
        )

    # Build a list of query conditions dynamically
    conditions = [PlcDataControls.PLANT_ID == tenant.plant_id]

    if plant_ids:
        # This adds an additional constraint if plant_ids are specified
        conditions.append(PlcDataControls.PLANT_ID.in_(plant_ids))  # type: ignore

    if control_types:
        # If specific control_types are provided, filter by that list
        conditions.append(PlcDataControls.CONTROL_TYPE.in_(control_types))  # type: ignore
    #else:
        # Otherwise, fall back to the default of CONTROL_TYPE = 1
        #conditions.append(PlcDataControls.CONTROL_TYPE == 1)

    # Construct the final statement from all conditions
    stmt = select(PlcDataControls).where(*conditions)

    results = (await data_session.exec(stmt)).all()
    if not results:
        # Return an empty list instead of 404 if no control are found
        return []

    # Convert DB rows to extended API response models with text values from related tables
    response_data: list[PlcDataControlExtendedRow] = []
    for db_row in results:
        try:
            if db_row is None:
                continue

            # Get the text values from related tables
            device_text = await get_device_text(
                data_session, db_row.PLANT_ID, db_row.CONTROL_TYPE
            )
            data_info = await get_data_info(data_session, db_row.DATA_ID)
            data_text, _, child_class_id, textlist_entries = data_info

            # Determine the input type based on the presence of child_class_id and other factors
            if child_class_id is not None and textlist_entries:
                input_type = "textlist"
            elif (
                textlist_entries
                and len(textlist_entries) == 2
                and all(k in ["0", "1"] for k in textlist_entries.keys())
            ):
                # If there are only 2 entries with keys '0' and '1', treat as boolean
                input_type = "boolean"
            else:
                input_type = "number"

            # Create a dictionary to map DB attributes to Pydantic model fields
            row_dict = {
                "id": db_row.ID,
                "plant_id": db_row.PLANT_ID,
                "control_type": db_row.CONTROL_TYPE,
                "data_id": db_row.DATA_ID,
                "data": db_row.DATA,
                "updated_at": db_row.UPDATED_AT,
                "updated_by": db_row.UPDATED_BY,
                "device_text": device_text,
                "data_text": data_text,
                "input_type": input_type,
                "textlist_entries": textlist_entries
                if input_type == "textlist"
                else None,
            }
            validated_row = PlcDataControlExtendedRow.model_validate(row_dict)
            response_data.append(validated_row)
        except Exception as e:
            # Log the error and the problematic row for debugging
            error_msg = f"Error processing DB row ID {getattr(db_row, 'ID', 'Unknown')}: {str(e)}"
            print(f"{error_msg}. Row Data: {vars(db_row)}")
            raise HTTPException(
                status_code=500,
                detail="Internal server error processing PLC data control.",
            )

    return response_data


@router.put(
    "/plc-data-control",
    response_model=CommandResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def update_plc_control(
    control: list[PlcDataSettingsUpdate],
    current_user: CurrentUser,
    primary_session: SessionDep,
    data_session: AsyncSession = Depends(get_data_async_session),
    tenant_id: UUID = Query(..., description="Tenant ID to update control for"),
    mqtt_client: FastMQTT = Depends(get_mqtt_client),
):
    if not current_user.is_superuser and current_user.tenant_id != tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized for this tenant",
        )

    # Get plant_id for the tenant
    tenant = await primary_session.get(Tenant, tenant_id)
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Tenant {tenant_id} not found",
        )

    if tenant.plant_id is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No plant_id configured for tenant {tenant_id}",
        )

    plant_id = tenant.plant_id

    # Prepare control data for MQTT payload - only include data_id and data
    control_for_mqtt = []
    for setting in control:
        # Find the existing setting to get the actual data_id from the database
        stmt = select(PlcDataControls).where(
            PlcDataControls.PLANT_ID == plant_id,
            PlcDataControls.ID
            == setting.id,  # Using the ID from the frontend as the database ID
        )
        result = await data_session.exec(stmt)
        db_setting = result.first()

        if not db_setting:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Setting with ID {setting.id} not found for plant {plant_id}",
            )

        control_for_mqtt.append(
            {
                "data_id": db_setting.DATA_ID,  # Use the actual DATA_ID from the database
                "data": setting.data,
            }
        )

    # --- PUBLISH TO MQTT ---
    try:
        # Create the PLC data control payload
        # Include current user's email in the payload, with fallback to user ID if email is None
        updated_by_info = current_user.email or str(current_user.id)
        plc_control_payload = PlcDataSettingsMqttPayload(
            plant_id=plant_id, settings=control_for_mqtt, updated_by=updated_by_info
        )

        # Define the specific topic for PLC data control
        topic = f"cmd/cloud-to-site/{plant_id}/plc-control"

        print(
            f"Publishing PLC data control to MQTT topic: {topic} (MsgID: {plc_control_payload.message_id})"
        )

        # Register the message-tenant mapping before publishing
        manager.register_message_tenant_mapping(
            plc_control_payload.message_id, str(tenant_id)
        )

        # Publish the JSON of the PLC control payload
        mqtt_client.publish(
            topic,
            plc_control_payload.model_dump_json(),
            qos=0,  # Use QoS 1 for commands to ensure they arrive
        )

        # Return the 202 response with the tracking ID
        return CommandResponse(
            message="PLC data control update sent",
            message_id=plc_control_payload.message_id,
        )

    except Exception as e:
        print(
            f"CRITICAL: Failed to publish PLC data control to MQTT for plant {plant_id}: {e}"
        )
        raise HTTPException(status_code=500, detail="Failed to publish to MQTT")
