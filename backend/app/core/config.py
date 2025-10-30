import secrets
import warnings
from typing import Annotated, Any, Literal, Optional, Union
from ssl import SSLContext

from pydantic import (
    AnyUrl,
    BeforeValidator,
    EmailStr,
    HttpUrl,
    BaseModel,
    computed_field,
    model_validator,
)
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing_extensions import Self
from fastapi_mqtt import FastMQTT, MQTTConfig  # <-- Import the real config


def parse_cors(v: Any) -> list[str] | str:
    if isinstance(v, str) and not v.startswith("["):
        return [i.strip() for i in v.split(",") if i.strip()]
    elif isinstance(v, list | str):
        return v
    raise ValueError(v)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        # Use top level .env file (one level above ./backend/)
        env_file="../.env",
        env_ignore_empty=True,
        extra="ignore",
    )
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = secrets.token_urlsafe(32)
    # 60 minutes * 24 hours * 8 days = 8 days
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 8
    FRONTEND_HOST: str = "http://localhost:5173"
    ENVIRONMENT: Literal["local", "staging", "production"] = "local"

    BACKEND_CORS_ORIGINS: Annotated[list[AnyUrl] | str, BeforeValidator(parse_cors)] = (
        []
    )

    @computed_field  # type: ignore[prop-decorator]
    @property
    def all_cors_origins(self) -> list[str]:
        return [str(origin).rstrip("/") for origin in self.BACKEND_CORS_ORIGINS] + [
            self.FRONTEND_HOST
        ]

    PROJECT_NAME: str
    SENTRY_DSN: HttpUrl | None = None
    MARIADB_SERVER: str  # Or MYSQL_SERVER if you prefer
    MARIADB_PORT: int = 3306  # Default MySQL/MariaDB port
    MARIADB_USER: str
    MARIADB_PASSWORD: str = ""
    MARIADB_DB: str = ""
    MARIADB_DB_DATA: str = ""

    # MQTT Settings
    MQTT_BROKER: str
    MQTT_PORT: int = 1883
    MQTT_USERNAME: Optional[str] = None
    MQTT_PASSWORD: Optional[str] = None
    MQTT_CLIENT_ID: Optional[str] = None
    MQTT_KEEPALIVE: int = 60
    MQTT_VERSION: int = 4  # Add this as a configurable setting

    # --- Property to create the MQTTConfig object ---
    @property
    def mqtt_config(self) -> MQTTConfig:
        """Constructs the MQTTConfig object from individual settings."""
        return MQTTConfig(
            host=self.MQTT_BROKER,
            port=self.MQTT_PORT,
            username=self.MQTT_USERNAME,
            password=self.MQTT_PASSWORD,
            client_id=self.MQTT_CLIENT_ID,
            keepalive=60,
            clean_session=True,
            ssl=False,
            version=4,  # ← ADD THIS! MQTTv3.1.1 (your test_mqtt.py uses version=4)
        )

    # --- END Property ---

    # --- END NEW: MQTT Settings ---

    @computed_field  # type: ignore[prop-decorator]
    @property
    def SQLALCHEMY_DATABASE_URI(
        self,
    ) -> AnyUrl:  # NEW: Use AnyUrl or construct as string
        # Option 1: Construct as string directly (often simpler for different schemes)
        # This avoids the need for a specific DSN type like PostgresDsn
        return f"mariadb+asyncmy://{self.MARIADB_USER}:{self.MARIADB_PASSWORD}@{self.MARIADB_SERVER}:{self.MARIADB_PORT}/{self.MARIADB_DB}"
        # OR if using aiomysql:
        # return f"mysql+aiomysql://{self.MARIADB_USER}:{self.MARIADB_PASSWORD}@{self.MARIADB_SERVER}:{self.MARIADB_PORT}/{self.MARIADB_DB}"

        # Option 2: Use Pydantic's AnyUrl (if validation is desired)
        # from pydantic import AnyUrl
        # return AnyUrl.build(
        #     scheme="mariadb+asyncmy", # Or "mysql+aiomysql"
        #     username=self.MARIADB_USER,
        #     password=self.MARIADB_PASSWORD,
        #     host=self.MARIADB_SERVER,
        #     port=self.MARIADB_PORT,
        #     path=f"/{self.MARIADB_DB}",
        # )
        # Note: AnyUrl.build might require correct path formatting, string construction is often more reliable for custom schemes.

    @computed_field  # type: ignore[prop-decorator]
    @property
    def SQLALCHEMY_DATA_DATABASE_URI(
        self,
    ) -> AnyUrl:  # NEW: Use AnyUrl or construct as string
        # Option 1: Construct as string directly (often simpler for different schemes)
        # This avoids the need for a specific DSN type like PostgresDsn
        return f"mariadb+asyncmy://{self.MARIADB_USER}:{self.MARIADB_PASSWORD}@{self.MARIADB_SERVER}:{self.MARIADB_PORT}/{self.MARIADB_DB_DATA}"

    # --- END NEW MariaDB/MySQL Settings ---

    SMTP_TLS: bool = True
    SMTP_SSL: bool = False
    SMTP_PORT: int = 587
    SMTP_HOST: str | None = None
    SMTP_USER: str | None = None
    SMTP_PASSWORD: str | None = None
    EMAILS_FROM_EMAIL: EmailStr | None = None
    EMAILS_FROM_NAME: EmailStr | None = None

    @model_validator(mode="after")
    def _set_default_emails_from(self) -> Self:
        if not self.EMAILS_FROM_NAME:
            self.EMAILS_FROM_NAME = self.PROJECT_NAME
        return self

    EMAIL_RESET_TOKEN_EXPIRE_HOURS: int = 48

    @computed_field  # type: ignore[prop-decorator]
    @property
    def emails_enabled(self) -> bool:
        return bool(self.SMTP_HOST and self.EMAILS_FROM_EMAIL)

    EMAIL_TEST_USER: EmailStr = "test@example.com"
    FIRST_SUPERUSER: EmailStr
    FIRST_SUPERUSER_PASSWORD: str

    def _check_default_secret(self, var_name: str, value: str | None) -> None:
        if value == "changethis":
            message = (
                f'The value of {var_name} is "changethis", '
                "for security, please change it, at least for deployments."
            )
            if self.ENVIRONMENT == "local":
                warnings.warn(message, stacklevel=1)
            else:
                raise ValueError(message)

    @model_validator(mode="after")
    def _enforce_non_default_secrets(self) -> Self:
        self._check_default_secret("SECRET_KEY", self.SECRET_KEY)
        self._check_default_secret("MARIADB_PASSWORD", self.MARIADB_PASSWORD)
        self._check_default_secret(
            "FIRST_SUPERUSER_PASSWORD", self.FIRST_SUPERUSER_PASSWORD
        )

        return self


settings = Settings()  # type: ignore
