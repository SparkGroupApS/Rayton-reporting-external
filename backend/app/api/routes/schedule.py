# In: app/api/routers/schedule.py (NEW FILE)
import datetime
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi_mqtt import FastMQTT
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession  # Import AsyncSession

# Adjust these imports to match your project structure
from app.api.deps import CurrentUser, SessionDep, get_mqtt_client

# Import WebSocket manager to register message-tenant mappings
from app.api.routes.ws import manager

# Use the correct dependency for your external data session
from app.core.db import get_data_async_session
from app.models import (
    #RebootPayload, # This needs to be defined in mqtt_models now
    CommandResponse,
    Schedule,
    ScheduleMqttPayload,
    ScheduleRow,
    Tenant,
)

# Import MQTT command tracker for better monitoring
from app.mqtt_logger import command_tracker

router = APIRouter(prefix="/schedule", tags=["schedule"])

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
        raise HTTPException(status_code=403, detail="Not authorized for this tenant")

    # ... (Lookup plant_id) ...
    plant_id = await get_plant_id_for_tenant(tenant_id, primary_session)

    # ... (Query schedule) ...
    query = (
        select(Schedule)
        .where(Schedule.PLANT_ID == plant_id)
        .where(Schedule.DATE == date)
        .order_by(Schedule.REC_NO)  # type: ignore
    )
    schedule_rows_db_result = await data_session.exec(query)
    db_rows = schedule_rows_db_result.all()

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
                "charge_from_grid": db_row.CHARGE_FROM_GRID,
                "allow_to_sell": db_row.ALLOW_TO_SELL,
                "charge_power": db_row.CHARGE_POWER,
                "charge_limit": db_row.CHARGE_LIMIT,
                "discharge_power": db_row.DISCHARGE_POWER,
                "source": db_row.SOURCE,
                "updated_at": db_row.UPDATED_AT,
                "updated_by": db_row.UPDATED_BY,
                # Add any other necessary fields from ScheduleRow
            }
            # Validate the dictionary against the ScheduleRow model
            validated_row = ScheduleRow.model_validate(row_dict)
            response_rows.append(validated_row)
        except Exception as e:
            # Catch potential validation errors or attribute errors more specifically
            error_msg = f"Error processing DB row ID {getattr(db_row, 'ID', 'Unknown')}: {str(e)}"
            print(
                f"{error_msg}. Row Data: {vars(db_row)}"
            )  # Log row data for debugging
            # Decide whether to skip the row or raise an error for the whole request
            # For now, let's raise, as it indicates a bigger issue
            raise HTTPException(
                status_code=500,
                detail=f"Internal server error processing schedule data. Problem with row ID {getattr(db_row, 'ID', 'Unknown')}.",
            )
    # --- END FIX ---

    return response_rows


# --- NEW: Bulk Update Endpoint ---
@router.put("/bulk", response_model=CommandResponse, status_code=status.HTTP_202_ACCEPTED)
async def bulk_update_schedule(
    primary_session: SessionDep,
    current_user: CurrentUser,
    date: datetime.date,
    schedule_rows_in: list[ScheduleRow],
    tenant_id: uuid.UUID = Query(..., description="Tenant ID to update schedule for"),
    data_session: AsyncSession = Depends(get_data_async_session),
    mqtt_client: FastMQTT = Depends(get_mqtt_client)
):
    if not current_user.is_superuser and current_user.tenant_id != tenant_id:
         raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized for this tenant")

    plant_id = await get_plant_id_for_tenant(tenant_id, primary_session)
    # Preserve the original order of schedule rows as sent by the frontend
    # Do not sort by start_time as this disrupts the rec_no sequence expected by the device
    rows_to_save = schedule_rows_in

    # --- 3. PUBLISH TO MQTT (Using Option 1: Sub-topic) ---
    try:
        # 3a. Create the schedule payload (this is the *entire* message)
        # The message_id is now generated automatically by the model
        # Include current user's email in the payload, with fallback to user ID if email is None
        updated_by_info = current_user.email or str(current_user.id)
        schedule_payload = ScheduleMqttPayload(
            plant_id=plant_id,
            date=date,
            schedule=rows_to_save,
            updated_by=updated_by_info
        )

        # 3b. Define the *specific* topic for schedules
        topic = f"cmd/cloud-to-site/{plant_id}/schedule"

        print(f"Publishing schedule to MQTT topic: {topic} (MsgID: {schedule_payload.message_id})")

        # Register the message-tenant mapping before publishing
        manager.register_message_tenant_mapping(schedule_payload.message_id, str(tenant_id))

        # Register command with the MQTT logger for tracking
        command_tracker.register_command(
            message_id=schedule_payload.message_id,
            command_type="schedule",
            tenant_id=str(tenant_id),
            plant_id=plant_id,
            payload=schedule_payload.model_dump()
        )

        # 3c. Publish the JSON of the schedule payload
        mqtt_client.publish(
            topic,
            schedule_payload.model_dump_json(),
            qos=0 # Use QoS 1 for commands to ensure they arrive
        )

        # 3d. Return the 202 response with the tracking ID
        return CommandResponse(
            message="Schedule update sent",
            message_id=schedule_payload.message_id
        )

    except Exception as e:
        print(f"CRITICAL: Failed to publish schedule to MQTT for plant {plant_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to publish to MQTT")





# --- UPDATED: Example endpoint for sending OTHER commands ---
# @router.post("/{plant_id}/reboot", response_model=CommandResponse, status_code=status.HTTP_202_ACCEPTED)
# async def send_reboot_command(
#     plant_id: int,
#     command_data: RebootCommand,
#     current_user: CurrentUser, # TODO: Add permission check
#     primary_session: SessionDep,
#     mqtt_client: FastMQTT = Depends(get_mqtt_client)
# ):
#     """
#     Sends a REBOOT command to a plant using the ".../action" sub-topic.
#     Returns a 202 Accepted with a message_id.
#     """
#     # --- Permission Check (Example) ---
#     print(f"User {current_user.id} attempting to reboot plant {plant_id}")
#     # ... (Add your permission logic here) ...


#     # 1. Create the inner payload
#     reboot_payload = RebootPayload(delay_seconds=command_data.delay_seconds)

#     # 2. Wrap it in the "ActionEnvelope"
#     # The message_id is generated automatically
#     action_envelope = ActionEnvelope(
#         command=ActionCommand.REBOOT_DEVICE,
#         payload=reboot_payload.model_dump() # Send the reboot data as the payload
#     )

#     # 3. Define the *specific* topic for actions
#     topic = f"cmd/cloud-to-site/{plant_id}/action"

#     try:
#         print(f"Publishing REBOOT_DEVICE to MQTT topic: {topic} (MsgID: {action_envelope.message_id})")
#         # Register the message-tenant mapping before publishing
#         manager.register_message_tenant_mapping(action_envelope.message_id, str(tenant_id))
#         mqtt_client.publish(
#             topic,
#             action_envelope.model_dump_json(),
#             qos=1 # Use QoS 1 for commands
#         )

#         # 4. Return the 202 response with the tracking ID
#         return CommandResponse(
#             message="Reboot command sent",
#             message_id=action_envelope.message_id
#         )

#     except Exception as e:
#         print(f"CRITICAL: Failed to publish REBOOT command to {topic}: {e}")
#         raise HTTPException(
#             status_code=500,
#             detail="Failed to send command to MQTT broker."
#         )
