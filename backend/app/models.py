import uuid
import datetime
from decimal import Decimal
from typing import Optional, List, Dict # Import Dict
from pydantic import EmailStr, BaseModel
from enum import Enum
from sqlmodel import Field, Relationship, SQLModel
from sqlalchemy import MetaData
import sqlalchemy as sa

# 1. NEW TENANT MODELS
# ##############################################################################

# Shared properties for a Tenant
class TenantBase(SQLModel):
    name: str = Field(unique=True, index=True, max_length=255)
    description: str | None = Field(default=None, max_length=1024)

# Properties to return via API
class TenantPublic(TenantBase):
    id: uuid.UUID

# Database model for Tenant
class Tenant(TenantBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    
    # A tenant has many users
    users: list["User"] = Relationship(back_populates="tenant")
    # A tenant has many items (through its users, but a direct link is cleaner)
    items: list["Item"] = Relationship(back_populates="tenant")

class TenantsPublic(SQLModel):
    data: list[TenantPublic]
    count: int

# Properties to receive on tenant creation
class TenantCreate(TenantBase):
    pass

# Properties to receive on tenant update (optional)
class TenantUpdate(TenantBase):
    name: str | None = Field(default=None, max_length=255) # Allow updating name
    description: str | None = Field(default=None, max_length=1024)
# ##############################################################################

# Shared properties
class UserBase(SQLModel):
    email: EmailStr = Field(unique=True, index=True, max_length=255)
    is_active: bool = True
    is_superuser: bool = False
    full_name: str | None = Field(default=None, max_length=255)
    role: str = Field(default="client", index=True, max_length=50) # e.g., admin, client, viewer


# Properties to receive via API on creation
class UserCreate(UserBase):
    password: str = Field(min_length=8, max_length=40)
    tenant_id: uuid.UUID
    role: str | None = Field(default=None, max_length=50) # Allow setting role on creation

class UserRegister(SQLModel):
    email: EmailStr = Field(max_length=255)
    password: str = Field(min_length=8, max_length=40)
    full_name: str | None = Field(default=None, max_length=255)


# Properties to receive via API on update, all are optional
class UserUpdate(SQLModel): # Changed UserUpdate to inherit from SQLModel directly 
    email: EmailStr | None = Field(default=None, max_length=255) # Keep these optional
    password: str | None = Field(default=None, min_length=8, max_length=40)
    full_name: str | None = Field(default=None, max_length=255) # Added optional full_name
    is_active: bool | None = Field(default=None) # Added optional is_active
    is_superuser: bool | None = Field(default=None) # Added optional is_superuser
    role: str | None = Field(default=None, max_length=50) # <-- ADD THIS (Optional update)
    # NOTE: We intentionally DO NOT include tenant_id here
    #tenant_id: uuid.UUID | None = Field(default=None)

class UserUpdateMe(SQLModel):
    full_name: str | None = Field(default=None, max_length=255)
    email: EmailStr | None = Field(default=None, max_length=255)


class UpdatePassword(SQLModel):
    current_password: str = Field(min_length=8, max_length=40)
    new_password: str = Field(min_length=8, max_length=40)


# Database model, database table inferred from class name
class User(UserBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    hashed_password: str = Field(max_length=255) 
    tenant_id: uuid.UUID = Field(foreign_key="tenant.id", nullable=False)
    tenant: Optional["Tenant"] = Relationship(back_populates="users") # NEW relationship link
    items: list["Item"] = Relationship(back_populates="owner", cascade_delete=True)
    # 'role' is inherited from UserBase


# Properties to return via API, id is always required
class UserPublic(UserBase):
    id: uuid.UUID
    tenant_id: uuid.UUID  # <-- ADD THIS LINE


class UsersPublic(SQLModel):
    data: list[UserPublic]
    count: int


# Shared properties
class ItemBase(SQLModel):
    title: str = Field(min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=255)


# Properties to receive on item creation
class ItemCreate(ItemBase):
    pass


# Properties to receive on item update
class ItemUpdate(ItemBase):
    title: str | None = Field(default=None, min_length=1, max_length=255)  # type: ignore


# Database model, database table inferred from class name
class Item(ItemBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    
    # --- MODIFICATION START ---
    # Add the foreign key to the Tenant table
    # This creates data isolation at the DB level
    tenant_id: uuid.UUID = Field(foreign_key="tenant.id", nullable=False)
    
    # Add the relationship link
    tenant: Optional["Tenant"] = Relationship(back_populates="items")
     # --- MODIFICATION END ---
    
    owner_id: uuid.UUID = Field(
        foreign_key="user.id", nullable=False
        # We remove ondelete="CASCADE" from here.
        # Deleting a user should be handled by logic, not a cascade
        # Or, if you keep it, ensure deleting a user doesn't break tenant items.
        # For now, let's remove it to be safe.
    )
    owner: User | None = Relationship(back_populates="items")


# Properties to return via API, id is always required
class ItemPublic(ItemBase):
    id: uuid.UUID
    owner_id: uuid.UUID
    tenant_id: uuid.UUID  # <-- ADD THIS LINE


class ItemsPublic(SQLModel):
    data: list[ItemPublic]
    count: int


# Generic message
class Message(SQLModel):
    message: str = Field(max_length=255)


# JSON payload containing access token
class Token(SQLModel):
    access_token: str = Field(max_length=1024)
    token_type: str = "bearer"


# Contents of JWT token
class TokenPayload(SQLModel):
    sub: str | None = None


class NewPassword(SQLModel):
    token: str = Field(max_length=1024)
    new_password: str = Field(min_length=8, max_length=40)

# Models for Dashboard Data
class DashboardCardData(SQLModel):
    total_users: int
    total_items: int
    active_users: int
    inactive_items: int

class RevenueData(SQLModel):
    month: str
    revenue: int

class DashboardData(SQLModel):
    cards: DashboardCardData
    revenue: list[RevenueData]
    items: list[ItemPublic] # Using existing ItemPublic for "latest invoices"

# --- Models for Historical Energy Data ---
# --- 2. CREATE SEPARATE METADATA FOR EXTERNAL TABLE ---
external_metadata = MetaData()

# --- 3. DEFINE YOUR EXTERNALLY MANAGED TABLE MODEL ---
# This model represents the existing table in your 'MARIADB_DB_DATA' database
class ClassList(SQLModel, table=True, metadata=external_metadata):
    __tablename__ = "CLASS_LIST" # Explicit table name

    ID: Optional[int] = Field(default=None, primary_key=True, sa_column_kwargs={"name": "ID"}) # Match BIGINT, primary key handles auto_increment
    CLASS_ID: Optional[int] = Field(default=None, unique=True, index=True) # Unique key implies index
    TEXT_L1: Optional[str] = Field(default=None, max_length=32)
    TEXT_L2: Optional[str] = Field(default=None, max_length=32)
    created_at: datetime.datetime = Field(default_factory=datetime.datetime.utcnow, nullable=False) # Let DB handle default
    updated_at: datetime.datetime = Field(default_factory=datetime.datetime.utcnow, nullable=False) # Let DB handle default/update

class ElectricityCost(SQLModel, table=True, metadata=external_metadata):
    __tablename__ = "ELECTRICITY_COST"

    id: Optional[int] = Field(default=None, primary_key=True) # Primary key handles auto_increment
    price_date: datetime.date = Field(nullable=False, index=True) # Part of unique key
    hour_of_day: int = Field(nullable=False, index=True) # Use int for TINYINT, part of unique key
    price_UAH_per_MWh: Decimal = Field(nullable=False, decimal_places=4, max_digits=10)
    received_at: Optional[datetime.datetime] = Field(default=None) # Timestamp allows NULL, let DB handle default

class PlantConfig(SQLModel, table=True, metadata=external_metadata):
    __tablename__ = "PLANT_CONFIG"

    ID: Optional[int] = Field(default=None, primary_key=True, sa_column_kwargs={"name": "ID"})
    PLANT_ID: Optional[int] = Field(default=None, index=True) # Part of unique key
    DEVICE_ID: Optional[int] = Field(default=None, index=True, sa_column_kwargs={"comment": "XXYYZZ\nXX - PARENT_ID\nYY - CLASS_ID\nZZ - DEVICE NUMBER"}) # Part of unique key
    CLASS_ID: Optional[int] = Field(default=None)
    PARENT_ID: Optional[int] = Field(default=None)
    TEXT_L1: Optional[str] = Field(default=None, max_length=32)
    TEXT_L2: Optional[str] = Field(default=None, max_length=32)
    created_at: datetime.datetime = Field(default_factory=datetime.datetime.utcnow, nullable=False)
    updated_at: datetime.datetime = Field(default_factory=datetime.datetime.utcnow, nullable=False)

class PlantList(SQLModel, table=True, metadata=external_metadata):
    __tablename__ = "PLANT_LIST"

    ID: Optional[int] = Field(default=None, primary_key=True, sa_column_kwargs={"name": "ID"})
    PLANT_ID: Optional[int] = Field(default=None) # Consider adding index=True if frequently queried
    latitude: Optional[Decimal] = Field(default=None, decimal_places=6, max_digits=9)
    longitude: Optional[Decimal] = Field(default=None, decimal_places=6, max_digits=9)
    timezone: str = Field(default='Europe/Kyiv', nullable=False, max_length=64)
    TEXT_L1: Optional[str] = Field(default=None, max_length=32)
    TEXT_L2: Optional[str] = Field(default=None, max_length=32)
    created_at: datetime.datetime = Field(default_factory=datetime.datetime.utcnow, nullable=False)
    updated_at: datetime.datetime = Field(default_factory=datetime.datetime.utcnow, nullable=False)

class PlcDataHistorical(SQLModel, table=True, metadata=external_metadata):
    __tablename__ = "PLC_DATA_HISTORICAL"

    # NOTE: Composite primary key (ID, PLANT_ID). SQLModel might need adjustments
    # or handle this primarily through querying specific IDs/PLANT_IDs.
    # Defining ID as the main PK for model interaction simplicity.
    ID: Optional[int] = Field(default=None, primary_key=True, sa_column_kwargs={"name": "ID"})
    TIMESTAMP: Optional[datetime.datetime] = Field(default=None, index=True) # Indexed based on keys
    PLANT_ID: int = Field(nullable=False, primary_key=True, index=True) # Part of composite PK and indexed
    DEVICE_ID: int = Field(default=0, nullable=False)
    DATA_ID: Optional[int] = Field(default=None, index=True) # Indexed
    DATA: Optional[float] = Field(default=None)
    STATUS: Optional[int] = Field(default=None)

class PlcDataRealtime(SQLModel, table=True, metadata=external_metadata):
    __tablename__ = "PLC_DATA_REALTIME"

    # NOTE: Composite primary key (ID, PLANT_ID). Defining ID as main PK.
    ID: Optional[int] = Field(default=None, primary_key=True, sa_column_kwargs={"name": "ID"})
    TIMESTAMP: Optional[datetime.datetime] = Field(default=None)
    PLANT_ID: int = Field(nullable=False, primary_key=True, index=True) # Part of composite PK and unique key
    DEVICE_ID: int = Field(nullable=False, index=True) # Part of unique key
    DATA_ID: Optional[int] = Field(default=None, index=True) # Part of unique key
    DATA: Optional[float] = Field(default=None)
    STATUS: Optional[int] = Field(default=None)

class Schedule(SQLModel, table=True, metadata=external_metadata):
    __tablename__ = "SCHEDULE"

    ID: Optional[int] = Field(default=None, primary_key=True, unique=True, sa_column_kwargs={"name": "ID"}) # unique=True based on key
    PLANT_ID: Optional[int] = Field(default=None, index=True) # Part of unique key
    DATE: Optional[datetime.date] = Field(default=None, index=True) # Part of unique key
    REC_NO: Optional[int] = Field(default=None, index=True) # Part of unique key
    START_TIME: Optional[datetime.time] = Field(default=None)
    END_TIME: Optional[datetime.time] = Field(default=None)
    CHARGE_ENABLE: Optional[bool] = Field(default=None) # TINYINT(1) maps to bool
    CHARGE_FROM_GRID: Optional[bool] = Field(default=None)
    DISCHARGE_ENABLE: Optional[bool] = Field(default=None)
    ALLOW_TO_SELL: Optional[bool] = Field(default=None)
    CHARGE_POWER: Optional[float] = Field(default=None) # DOUBLE maps to float
    CHARGE_LIMIT: Optional[float] = Field(default=None)
    DISCHARGE_POWER: Optional[float] = Field(default=None)
    SOURCE: Optional[int] = Field(default=None)
    UPDATED_AT: datetime.datetime = Field(default_factory=datetime.datetime.utcnow, nullable=False)

class TextList(SQLModel, table=True, metadata=external_metadata):
    __tablename__ = "TEXT_LIST"

    ID: Optional[int] = Field(default=None, primary_key=True, sa_column_kwargs={"name": "ID"})
    CLASS_ID: Optional[int] = Field(default=None, index=True) # Part of unique key, also foreign key target
    DATA_ID: Optional[int] = Field(default=None, index=True) # Part of unique key
    TEXT_ID: Optional[str] = Field(default=None, max_length=100)
    TEXT_L1: Optional[str] = Field(default=None, max_length=100)
    TEXT_L2: Optional[str] = Field(default=None, max_length=100)
    created_at: datetime.datetime = Field(default_factory=datetime.datetime.utcnow, nullable=False)
    updated_at: datetime.datetime = Field(default_factory=datetime.datetime.utcnow, nullable=False)

# --- Models for OPTIMIZED Detailed Historical Data ---

class TimeSeriesPoint(BaseModel):
    # Represents a single point [timestamp_ms, value] for Highcharts
    # Using tuple format directly might be slightly more efficient than dict
    x: int # Timestamp in milliseconds
    y: float | int | None # Value

class TimeSeriesData(BaseModel):
    # Represents data for a single series (e.g., 'Generation', 'Consumption')
    data_id: int
    name: str # Use label or text_id as the series name
    data: List[TimeSeriesPoint] # List of [timestamp_ms, value] points
    # You could add other Highcharts series options here if needed (e.g., type: 'spline')

class HistoricalDataGroupedResponse(BaseModel):
    # The main response containing multiple series
    series: List[TimeSeriesData]
    # Optionally include requested range or other metadata
    # start_iso: str
    # end_iso: str

# --- End Optimized Models ---