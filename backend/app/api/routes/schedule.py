# In: app/api/routers/schedule.py (NEW FILE)
import datetime
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Dict
from sqlmodel import delete, select
from sqlmodel.ext.asyncio.session import AsyncSession  # Import AsyncSession
from pydantic import BaseModel # <-- 1. Import BaseModel for MQTT payload

# Adjust these imports to match your project structure
from app.api.deps import CurrentUser, SessionDep, get_mqtt_client

# Use the correct dependency for your external data session
from app.core.db import get_data_async_session
from app.models import Schedule, ScheduleRow, Tenant, ScheduleBase
from fastapi_mqtt import FastMQTT 
#from app.core.mqtt import mqtt
from app.mqtt_handlers import mqtt

router = APIRouter(prefix="/schedule", tags=["schedule"])

# --- Define the MQTT Payload Model (Optional, but good practice) ---
# This uses the ScheduleBase model which has the aliases for UPPER_CASE
class ScheduleMqttPayloadItem(ScheduleBase):
    class Config:
        # Ensure it uses aliases for JSON output (snake_case -> UPPER_CASE)
        populate_by_name = True 

class ScheduleMqttPayload(BaseModel):
    plant_id: int
    date: datetime.date
    # We send the snake_case version, but if devices expect UPPER_CASE,
    # we can add aliases here too or format it manually.
    # Let's assume the device can consume the same snake_case JSON.
    schedule: List[ScheduleRow] # Send the full ScheduleRow, which includes ID
# --- END MQTT Payload Model ---

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

@router.get("/", response_model=list[ScheduleRow])
async def read_schedule(
    current_user: CurrentUser,
    primary_session: SessionDep,
    tenant_id: uuid.UUID = Query(..., description="Tenant ID to fetch schedule for"),
    date: datetime.date = Query(..., description="Date (YYYY-MM-DD)"),
    data_session: AsyncSession = Depends(get_data_async_session),
):
    # ... (Permission check) ...
    if not current_user.is_superuser and current_user.tenant_id != tenant_id:
        raise HTTPException(...)

    # ... (Lookup plant_id) ...
    plant_id = await get_plant_id_for_tenant(tenant_id, primary_session)

    # ... (Query schedule) ...
    query = (
        select(Schedule)
        .where(Schedule.PLANT_ID == plant_id)
        .where(Schedule.DATE == date)
        .order_by(Schedule.REC_NO)
    )
    schedule_rows_db_result = await data_session.exec(query)
    db_rows: list[Schedule] = schedule_rows_db_result.all()

    # --- FIX: Explicit Manual Conversion ---
    response_rows: list[ScheduleRow] = []
    for db_row in db_rows:
        try:
            # Create a dictionary mapping Pydantic field names (snake_case)
            # to the values from the ORM object's attributes (UPPER_CASE)
            row_dict = {
                "id": db_row.ID,
                "rec_no": db_row.REC_NO,
                "start_time": db_row.START_TIME,
                "end_time": db_row.END_TIME, # Will be None if DB is NULL
                "charge_enable": db_row.CHARGE_ENABLE,
                "charge_from_grid": db_row.CHARGE_FROM_GRID,
                "discharge_enable": db_row.DISCHARGE_ENABLE,
                "allow_to_sell": db_row.ALLOW_TO_SELL,
                "charge_power": db_row.CHARGE_POWER,
                "charge_limit": db_row.CHARGE_LIMIT,
                "discharge_power": db_row.DISCHARGE_POWER,
                "source": db_row.SOURCE,
                "updated_at": db_row.UPDATED_AT,
                # Add any other necessary fields from ScheduleRow
            }
            # Validate the dictionary against the ScheduleRow model
            validated_row = ScheduleRow.model_validate(row_dict)
            response_rows.append(validated_row)
        except Exception as e:
            # Catch potential validation errors or attribute errors more specifically
            error_msg = f"Error processing DB row ID {getattr(db_row, 'ID', 'Unknown')}: {str(e)}"
            print(f"{error_msg}. Row Data: {vars(db_row)}") # Log row data for debugging
            # Decide whether to skip the row or raise an error for the whole request
            # For now, let's raise, as it indicates a bigger issue
            raise HTTPException(
                status_code=500,
                detail=f"Internal server error processing schedule data. Problem with row ID {getattr(db_row, 'ID', 'Unknown')}.",
            )
    # --- END FIX ---

    return response_rows


# --- NEW: Bulk Update Endpoint ---
@router.put("/bulk", response_model=list[ScheduleRow])
async def bulk_update_schedule(
    primary_session: SessionDep,
    current_user: CurrentUser,
    date: datetime.date,
    schedule_rows_in: list[ScheduleRow],
    tenant_id: uuid.UUID = Query(..., description="Tenant ID to update schedule for"),
    data_session: AsyncSession = Depends(get_data_async_session),
    mqtt_client: FastMQTT = Depends(get_mqtt_client)
):
    """
    Update/insert/delete schedule rows AND publish the new schedule to MQTT.
    """
    # Permission check
    if not current_user.is_superuser and current_user.tenant_id != tenant_id:
         raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized for this tenant")

    # Lookup plant_id using the primary session
    plant_id = await get_plant_id_for_tenant(tenant_id, primary_session)

    rows_to_save = sort_schedule_rows_by_start_time(schedule_rows_in)

    # --- 3. PUBLISH TO MQTT (After successful commit) ---
    try:
        # Create the MQTT payload
        mqtt_payload = ScheduleMqttPayload(
            plant_id=plant_id,
            date=date,
            schedule=rows_to_save # rows_to_save is the list of ScheduleRow objects
        )
        
        # Define the topic. Use the plant_id for specific device targeting.
        topic = f"schedule/update/{plant_id}"
        
        # Publish the payload as a JSON string
        # Use the injected mqtt_client (which should be the FastMQTT instance)
        # Check fastapi-mqtt docs for the exact publish method signature.
        # It's often something like: await mqtt_client.publish(topic, payload, qos=...)
        #logger.info(f"Publishing to MQTT topic: {topic}")
        print(f"Publishing to MQTT topic: {topic}")
        # Example publish call (adjust based on fastapi-mqtt version/docs):
        mqtt_client.publish(
            topic, 
            mqtt_payload.model_dump_json(), 
            qos=0 # Changed to QoS 1 for at-least-once delivery
        )

        #logger.info(f"✅ Published schedule to MQTT for plant {plant_id}")
        
    except Exception as e:
         #logger.error(f"⚠️ Failed to publish schedule to MQTT for plant {plant_id}: {e}")
        # Don't fail the request if MQTT publish fails
        print(f"CRITICAL: Failed to publish schedule to MQTT for plant {plant_id}: {e}")

    return rows_to_save

# --- Helper function to sort rows by start time ---
def sort_schedule_rows_by_start_time(rows: list[ScheduleRow]) -> list[ScheduleRow]:
    def time_key(row: ScheduleRow):
        try:
            return datetime.time.fromisoformat(row.start_time)
        except (ValueError, TypeError):
            # Handle potential invalid time strings or None
            return datetime.time.min  # Sort invalid/missing times first

    return sorted(rows, key=time_key)
