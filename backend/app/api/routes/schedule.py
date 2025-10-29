# In: app/api/routers/schedule.py (NEW FILE)
from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import List, Dict
import datetime

# Adjust these imports to match your project structure
from app.api.deps import SessionDep, CurrentUser
from app.models import Schedule, ScheduleRow  # Import both models
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession  # Import AsyncSession

# Use the correct dependency for your external data session
from app.core.db import get_data_async_session

router = APIRouter(prefix="/schedule", tags=["schedule"])


@router.get("/", response_model=List[ScheduleRow])
async def read_schedule(
    current_user: CurrentUser,
    plant_id: int,
    tenant_db: str,  # This param comes from your frontend
    date: datetime.date = Query(
        ..., description="The date to fetch schedule for, in YYYY-MM-DD format"
    ),
    session: AsyncSession = Depends(get_data_async_session),
):
    """
    Get schedule rows for a specific plant and date.
    """
    query = (
        select(Schedule)
        .where(Schedule.PLANT_ID == plant_id)
        .where(Schedule.DATE == date)  # Use the 'date' parameter
        .order_by(Schedule.REC_NO)
    )
    schedule_rows_db = await session.exec(query)
    rows = schedule_rows_db.all() # List of Schedule ORM instances

    api_schedule_rows: List[ScheduleRow] = []
    for db_row in rows: # Iterate through the ORM objects returned by the query
        try:
            # --- Explicitly Pass ORM Attributes Using Pydantic Field Names ---
            # Access ORM attributes by their actual names (UPPERCASE) and pass them
            # to the ScheduleRow constructor using the corresponding Pydantic field names (lowercase/snake_case).
            # Pydantic's alias definitions (alias="UPPERCASE_NAME") will handle the mapping internally.
            api_row = ScheduleRow(
                # Map ORM attributes (UPPERCASE) to Pydantic model fields (snake_case)
                # The left side is the Pydantic field name, the right side accesses the ORM attribute.
                id=getattr(db_row, "ID"), # Maps to 'id' field in ScheduleRow (alias="ID")
                plant_id=getattr(db_row, "PLANT_ID"), # Maps to 'plant_id' field (assuming alias="PLANT_ID" is added to ScheduleBase or ScheduleRow)
                date=getattr(db_row, "DATE"), # Maps to 'date' field (assuming alias="DATE" is added)
                rec_no=getattr(db_row, "REC_NO"), # Maps to 'rec_no' field (alias="REC_NO" in ScheduleBase)
                start_time=getattr(db_row, "START_TIME"), # Maps to 'start_time' field (alias="START_TIME" in ScheduleBase)
                end_time=getattr(db_row, "END_TIME"), # Maps to 'end_time' field (alias="END_TIME" in ScheduleBase) - Handles None correctly
                charge_enable=getattr(db_row, "CHARGE_ENABLE"), # Maps to 'charge_enable' (alias="CHARGE_ENABLE")
                charge_from_grid=getattr(db_row, "CHARGE_FROM_GRID"), # Maps to 'charge_from_grid' (alias="CHARGE_FROM_GRID")
                discharge_enable=getattr(db_row, "DISCHARGE_ENABLE"), # Maps to 'discharge_enable' (alias="DISCHARGE_ENABLE")
                allow_to_sell=getattr(db_row, "ALLOW_TO_SELL"), # Maps to 'allow_to_sell' (alias="ALLOW_TO_SELL")
                charge_power=getattr(db_row, "CHARGE_POWER"), # Maps to 'charge_power' (alias="CHARGE_POWER")
                charge_limit=getattr(db_row, "CHARGE_LIMIT"), # Maps to 'charge_limit' (alias="CHARGE_LIMIT")
                discharge_power=getattr(db_row, "DISCHARGE_POWER"), # Maps to 'discharge_power' (alias="DISCHARGE_POWER")
                source=getattr(db_row, "SOURCE"), # Maps to 'source' field (alias="SOURCE" in ScheduleBase)
                updated_at=getattr(db_row, "UPDATED_AT") # Maps to 'updated_at' field (alias="UPDATED_AT")
                # Add any other fields/columns your Schedule model/table has that need to be mapped
                # Ensure corresponding aliases are defined in ScheduleRow or ScheduleBase
            )
            api_schedule_rows.append(api_row)
        except AttributeError as ae:
            # Handle case where an expected attribute is missing on the ORM object
            # This is an internal consistency error
            error_msg = f"Missing ORM attribute for row {getattr(db_row, 'ID', 'Unknown ID')}: {ae}"
            print(error_msg) # Log for debugging
            raise HTTPException(status_code=500, detail=f"Internal error: ORM model missing expected attribute. {error_msg}")
        except Exception as e:
            # Handle other potential errors during conversion (e.g., data type issues, validation errors within Pydantic)
            error_msg = f"Error converting DB row {getattr(db_row, 'ID', 'Unknown ID')} to ScheduleRow: {e}"
            print(error_msg) # Log for debugging
            # Optionally, log the specific db_row data for deeper inspection
            # print(f"Problematic row data: {vars(db_row)}")
            raise HTTPException(status_code=500, detail=f"Internal server error processing schedule data. {error_msg}")

    return api_schedule_rows # Return the list of correctly converted Pydantic models


# @router.put("/", response_model=ScheduleRow)
# async def update_schedule(
#     current_user: CurrentUser,
#     plant_id: int,
#     tenant_db: str,
#     schedule_row_in: ScheduleRow,  # <-- Receives the snake_case model
#     session: AsyncSession = Depends(get_data_async_session),
# ):
#     """
#     Update a single schedule row.
#     """
#     # Find the row in the DB using the 'id'
#     db_row = await session.get(Schedule, schedule_row_in.id)
#     if not db_row:
#         raise HTTPException(
#             status_code=status.HTTP_404_NOT_FOUND, detail="Schedule row not found"
#         )

#     # Check permissions (plant_id from URL must match row's plant_id)
#     if db_row.PLANT_ID != plant_id:
#         raise HTTPException(
#             status_code=status.HTTP_403_FORBIDDEN,
#             detail="Not authorized for this plant",
#         )

#     # Get update data. by_alias=True converts snake_case to UPPER_CASE
#     update_data = schedule_row_in.model_dump(exclude_unset=True, by_alias=True)

#     # Don't allow changing primary key or plant/date
#     update_data.pop("ID", None)
#     update_data.pop("PLANT_ID", None)
#     update_data.pop("DATE", None)

#     # Update the DB model
#     db_row.sqlmodel_update(update_data)

#     session.add(db_row)
#     await session.commit()
#     await session.refresh(db_row)

#     return db_row  # FastAPI converts this back to ScheduleRow

# --- NEW: Bulk Update Endpoint ---
@router.put("/bulk", response_model=List[ScheduleRow])
async def bulk_update_schedule(
    current_user: CurrentUser,
    plant_id: int,
    tenant_db: str,
    date: datetime.date,
    schedule_rows_in: List[ScheduleRow], # List from frontend (can have temp negative IDs)
    session: AsyncSession = Depends(get_data_async_session),
):
    """
    Update existing schedule rows, insert new ones, and delete removed ones
    for a specific plant and date.
    """
    # 1. Fetch existing DB rows for this plant and date
    existing_query = (
        select(Schedule)
        .where(Schedule.PLANT_ID == plant_id)
        .where(Schedule.DATE == date)
    )
    existing_result = await session.exec(existing_query)
    existing_db_rows: List[Schedule] = existing_result.all()
    existing_rows_map: Dict[int, Schedule] = {row.ID: row for row in existing_db_rows if row.ID is not None} # Map by ID

    # 2. Process incoming rows (updates and inserts)
    input_ids = set() # Keep track of IDs present in the input
    rows_to_process = sort_schedule_rows_by_start_time(schedule_rows_in) # Helper function needed (see below)

    newly_created_db_rows = [] # To store newly inserted rows for later refresh

    for i, row_in in enumerate(rows_to_process):
        rec_no = i + 1 # Recalculate REC_NO based on sorted order

        if row_in.id > 0 and row_in.id in existing_rows_map:
            # --- UPDATE EXISTING ROW ---
            db_row = existing_rows_map[row_in.id]
            input_ids.add(row_in.id) # Mark this ID as processed

            update_data = row_in.model_dump(exclude_unset=True, by_alias=True)
            # Ensure critical fields aren't changed accidentally
            update_data.pop("ID", None)
            update_data.pop("PLANT_ID", None)
            update_data.pop("DATE", None)
            update_data["REC_NO"] = rec_no # Update REC_NO

            # Remove end_time for storage if your DB logic requires it
            # update_data.pop("END_TIME", None)

            db_row.sqlmodel_update(update_data)
            session.add(db_row)

        elif row_in.id <= 0: # Check for temporary negative ID or potentially 0
            # --- INSERT NEW ROW ---
            db_model_data = row_in.model_dump(by_alias=True)
            db_model_data.pop("ID", None) # Remove temporary ID
            db_model_data.pop("END_TIME", None) # Remove end_time if needed
            db_model_data.pop("UPDATED_AT", None)
            db_model_data["PLANT_ID"] = plant_id
            db_model_data["DATE"] = date
            db_model_data["REC_NO"] = rec_no

            new_db_row = Schedule(**db_model_data)
            session.add(new_db_row)
            newly_created_db_rows.append(new_db_row) # Add to list for refreshing later

        else:
            # Handle unexpected case: positive ID from frontend not in DB
            print(f"Warning: Input row with ID {row_in.id} not found in DB for update.")
            input_ids.add(row_in.id) # Still mark as "processed" to avoid deletion


    # 3. Delete rows that were in the DB but not in the input
    ids_to_delete = set(existing_rows_map.keys()) - input_ids
    for row_id in ids_to_delete:
        await session.delete(existing_rows_map[row_id])

    # 4. Commit all changes (updates, inserts, deletes)
    try:
        await session.commit()
    except Exception as e:
        await session.rollback() # Rollback on error
        raise HTTPException(status_code=500, detail=f"Database error during bulk update: {e}")


    # 5. Fetch the final state from DB to return
    final_query = (
        select(Schedule)
        .where(Schedule.PLANT_ID == plant_id)
        .where(Schedule.DATE == date)
        .order_by(Schedule.REC_NO)
    )
    final_result = await session.exec(final_query)
    final_db_rows: List[Schedule] = final_result.all()

    # Convert final DB rows back to API models
    response_rows: List[ScheduleRow] = [
        ScheduleRow.model_validate_from_orm(db_row) for db_row in final_db_rows
    ]

    return response_rows

# --- Helper function to sort rows by start time ---
def sort_schedule_rows_by_start_time(rows: List[ScheduleRow]) -> List[ScheduleRow]:
    def time_key(row: ScheduleRow):
        try:
            return datetime.time.fromisoformat(row.start_time)
        except (ValueError, TypeError):
            # Handle potential invalid time strings or None
            return datetime.time.min # Sort invalid/missing times first
    return sorted(rows, key=time_key)