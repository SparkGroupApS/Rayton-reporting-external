# In: app/api/routers/schedule.py (NEW FILE)
import datetime
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlmodel import delete, select
from sqlmodel.ext.asyncio.session import AsyncSession  # Import AsyncSession

# Adjust these imports to match your project structure
from app.api.deps import CurrentUser, SessionDep

# Use the correct dependency for your external data session
from app.core.db import get_data_async_session
from app.models import Schedule, ScheduleRow, Tenant  # Import both models

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

# @router.get("/", response_model=List[ScheduleRow])
# async def read_schedule(
#     current_user: CurrentUser,
#     tenant_id: uuid.UUID = Query(..., description="Tenant ID to fetch schedule for"),
#     date: datetime.date = Query(..., description="Date (YYYY-MM-DD)"),
#     # --- Inject BOTH sessions ---
#     data_session: AsyncSession = Depends(get_data_async_session), # External data
#     primary_session: SessionDep = Depends(), # Primary DB session (uses default dependency)
# ):

#     # Permission check
#     if not current_user.is_superuser and current_user.tenant_id != tenant_id:
#          raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized for this tenant")

#     # Lookup plant_id using the primary session
#     plant_id = await get_plant_id_for_tenant(tenant_id, primary_session)
#     # Query schedule rows from the external data session
#     # Query schedule using the data session and looked-up plant_id
#     query = (
#         select(Schedule)
#         .where(Schedule.PLANT_ID == plant_id)
#         .where(Schedule.DATE == date)
#         .order_by(Schedule.REC_NO)
#     )
#     schedule_rows_db_result = await data_session.exec(query)
#     db_rows: List[Schedule] = schedule_rows_db_result.all()

#     api_schedule_rows: List[ScheduleRow] = []
#     for db_row in db_rows: # Iterate through the ORM objects returned by the query
#         try:
#             # --- Explicitly Pass ORM Attributes Using Pydantic Field Names ---
#             # Access ORM attributes by their actual names (UPPERCASE) and pass them
#             # to the ScheduleRow constructor using the corresponding Pydantic field names (lowercase/snake_case).
#             # Pydantic's alias definitions (alias="UPPERCASE_NAME") will handle the mapping internally.
#             api_row = ScheduleRow(
#                 # Map ORM attributes (UPPERCASE) to Pydantic model fields (snake_case)
#                 # The left side is the Pydantic field name, the right side accesses the ORM attribute.
#                 id=getattr(db_row, "ID"), # Maps to 'id' field in ScheduleRow (alias="ID")
#                 plant_id=getattr(db_row, "PLANT_ID"), # Maps to 'plant_id' field (assuming alias="PLANT_ID" is added to ScheduleBase or ScheduleRow)
#                 date=getattr(db_row, "DATE"), # Maps to 'date' field (assuming alias="DATE" is added)
#                 rec_no=getattr(db_row, "REC_NO"), # Maps to 'rec_no' field (alias="REC_NO" in ScheduleBase)
#                 start_time=getattr(db_row, "START_TIME"), # Maps to 'start_time' field (alias="START_TIME" in ScheduleBase)
#                 end_time=getattr(db_row, "END_TIME"), # Maps to 'end_time' field (alias="END_TIME" in ScheduleBase) - Handles None correctly
#                 charge_enable=getattr(db_row, "CHARGE_ENABLE"), # Maps to 'charge_enable' (alias="CHARGE_ENABLE")
#                 charge_from_grid=getattr(db_row, "CHARGE_FROM_GRID"), # Maps to 'charge_from_grid' (alias="CHARGE_FROM_GRID")
#                 discharge_enable=getattr(db_row, "DISCHARGE_ENABLE"), # Maps to 'discharge_enable' (alias="DISCHARGE_ENABLE")
#                 allow_to_sell=getattr(db_row, "ALLOW_TO_SELL"), # Maps to 'allow_to_sell' (alias="ALLOW_TO_SELL")
#                 charge_power=getattr(db_row, "CHARGE_POWER"), # Maps to 'charge_power' (alias="CHARGE_POWER")
#                 charge_limit=getattr(db_row, "CHARGE_LIMIT"), # Maps to 'charge_limit' (alias="CHARGE_LIMIT")
#                 discharge_power=getattr(db_row, "DISCHARGE_POWER"), # Maps to 'discharge_power' (alias="DISCHARGE_POWER")
#                 source=getattr(db_row, "SOURCE"), # Maps to 'source' field (alias="SOURCE" in ScheduleBase)
#                 updated_at=getattr(db_row, "UPDATED_AT") # Maps to 'updated_at' field (alias="UPDATED_AT")
#                 # Add any other fields/columns your Schedule model/table has that need to be mapped
#                 # Ensure corresponding aliases are defined in ScheduleRow or ScheduleBase
#             )
#             api_schedule_rows.append(api_row)
#         except AttributeError as ae:
#             # Handle case where an expected attribute is missing on the ORM object
#             # This is an internal consistency error
#             error_msg = f"Missing ORM attribute for row {getattr(db_row, 'ID', 'Unknown ID')}: {ae}"
#             print(error_msg) # Log for debugging
#             raise HTTPException(status_code=500, detail=f"Internal error: ORM model missing expected attribute. {error_msg}")
#         except Exception as e:
#             # Handle other potential errors during conversion (e.g., data type issues, validation errors within Pydantic)
#             error_msg = f"Error converting DB row {getattr(db_row, 'ID', 'Unknown ID')} to ScheduleRow: {e}"
#             print(error_msg) # Log for debugging
#             # Optionally, log the specific db_row data for deeper inspection
#             # print(f"Problematic row data: {vars(db_row)}")
#             raise HTTPException(status_code=500, detail=f"Internal server error processing schedule data. {error_msg}")
#         response_rows: List[ScheduleRow] = [
#         ScheduleRow.model_validate_from_orm(db_row) for db_row in db_rows
#     ]
#     return response_rows # Return the list of correctly converted Pydantic models


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
    current_user: CurrentUser,date: datetime.date,
    schedule_rows_in: list[ScheduleRow],
    tenant_id: uuid.UUID = Query(..., description="Tenant ID to update schedule for"),

    # --- Inject BOTH sessions ---
    data_session: AsyncSession = Depends(get_data_async_session), # External data
):
    """
    Replace schedule for a specific tenant and date (delete-then-insert).
    """
    # Permission check
    if not current_user.is_superuser and current_user.tenant_id != tenant_id:
         raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized for this tenant")

    # Lookup plant_id using the primary session
    plant_id = await get_plant_id_for_tenant(tenant_id, primary_session)

    rows_to_save = sort_schedule_rows_by_start_time(schedule_rows_in)

    try:
        # Perform DB operations using the data_session
        delete_stmt = (
            delete(Schedule)
            .where(Schedule.PLANT_ID == plant_id)
            .where(Schedule.DATE == date)
        )
        await data_session.exec(delete_stmt)

        newly_created_db_rows = []
        for i, row_in in enumerate(rows_to_save):
            # ... (prepare db_model_data, ensure PLANT_ID is set to looked-up plant_id) ...
            db_model_data = row_in.model_dump(by_alias=True)
            db_model_data.pop("ID", None)
            db_model_data.pop("END_TIME", None)
            db_model_data.pop("UPDATED_AT", None)
            db_model_data["PLANT_ID"] = plant_id # Use looked-up plant_id
            db_model_data["DATE"] = date
            db_model_data["REC_NO"] = i + 1

            new_db_row = Schedule(**db_model_data)
            data_session.add(new_db_row)
            newly_created_db_rows.append(new_db_row)

        await data_session.commit()

        # ... (refresh using data_session and return response) ...
        response_rows: list[ScheduleRow] = []
        for db_row in newly_created_db_rows:
            await data_session.refresh(db_row)
            response_rows.append(ScheduleRow.model_validate_from_orm(db_row))
        return response_rows

    except Exception as e:
        await data_session.rollback()
        raise HTTPException(status_code=500, detail=f"Database error during bulk update: {e}")


# --- Helper function to sort rows by start time ---
def sort_schedule_rows_by_start_time(rows: list[ScheduleRow]) -> list[ScheduleRow]:
    def time_key(row: ScheduleRow):
        try:
            return datetime.time.fromisoformat(row.start_time)
        except (ValueError, TypeError):
            # Handle potential invalid time strings or None
            return datetime.time.min  # Sort invalid/missing times first

    return sorted(rows, key=time_key)
