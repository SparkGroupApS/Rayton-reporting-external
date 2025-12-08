# app/mqtt_handlers.py
import logging

from fastapi_mqtt import FastMQTT, MQTTConfig
from pydantic import ValidationError

# Import WebSocket manager to broadcast updates
from app.core.config import settings

# Import the response model from our new central file
from app.models import MqttResponsePayload

# Import MQTT command tracker for better monitoring
from app.mqtt_logger import log_mqtt_command_response

logger = logging.getLogger(__name__)

mqtt_config: MQTTConfig = settings.mqtt_config
mqtt = FastMQTT(config=mqtt_config)

# Topics for the slave device to send responses TO
# We use a wildcard '+' for the plant_id
SCHEDULE_RESPONSE_TOPIC = "status/site-to-cloud/+/schedule"
ACTION_RESPONSE_TOPIC = "status/site-to-cloud/+/action"
PLC_SETTINGS_RESPONSE_TOPIC = "status/site-to-cloud/+/plc-settings"

@mqtt.on_connect()
def connect(client, flags, rc, properties):
    logger.info(f"🟢 MQTT CONNECTED! RC={rc}")
    if rc == 0:
        logger.info("✅ Connection successful!")

        # --- Subscribe to the new response topics ---
        mqtt.client.subscribe(SCHEDULE_RESPONSE_TOPIC)
        logger.info(f"📡 Subscribed to {SCHEDULE_RESPONSE_TOPIC}")

        mqtt.client.subscribe(ACTION_RESPONSE_TOPIC)
        logger.info(f"📡 Subscribed to {ACTION_RESPONSE_TOPIC}")

        mqtt.client.subscribe(PLC_SETTINGS_RESPONSE_TOPIC)
        logger.info(f"📡 Subscribed to {PLC_SETTINGS_RESPONSE_TOPIC}")

    else:
        logger.error(f"❌ Connection failed with code: {rc}")

@mqtt.on_disconnect()
def disconnect(client, packet, exc=None):
    logger.warning(f"🔴 MQTT DISCONNECTED! Exception: {exc}")

# --- New Specific Handlers ---

@mqtt.subscribe(SCHEDULE_RESPONSE_TOPIC)
async def handle_schedule_response(client, topic, payload, qos, properties):
    """Handles 'OK'/'ERROR' responses for schedule updates."""
    logger.info(f"📨 Received SCHEDULE ACK on '{topic}'")
    try:
        # 1. Parse the response payload
        response_data = MqttResponsePayload.model_validate_json(payload)

        # 2. Log the correlated command
        logger.info(f"✅ SCHEDULE ACK received for MsgID: {response_data.message_id} "
                    f"-> Status: {response_data.status.upper()}")

        if response_data.status == "error":
            # Enhanced error handling with specific error code interpretation
            error_detail = response_data.error
            error_message = f"Device reported ERROR for MsgID {response_data.message_id}: {error_detail}"

            # Interpret specific error codes if they are integers
            if isinstance(error_detail, int):
                if error_detail == -1:
                    error_message += " (General error or command not recognized)"
                elif error_detail == -2:
                    error_message += " (Invalid schedule format or parameters)"
                elif error_detail == -3:
                    error_message += " (Device busy or unable to process)"
                # Add more specific error code interpretations as needed

            logger.warning(f"⚠️ {error_message}")

        # Use the new MQTT logger to track the command response
        # Convert error to string if it's an integer
        error_str = str(response_data.error) if response_data.error is not None else None
        await log_mqtt_command_response(response_data.message_id, response_data.status, error_str, "schedule")

    except ValidationError as e:
        logger.error(f"❌ Invalid ACK payload on {topic}: {payload.decode()}. Error: {e}")
    except Exception as e:
        logger.error(f"❌ Error processing ACK on {topic}: {e}")


@mqtt.subscribe(ACTION_RESPONSE_TOPIC)
async def handle_action_response(client, topic, payload, qos, properties):
    """Handles 'OK'/'ERROR' responses for action commands."""
    logger.info(f"📨 Received ACTION ACK on '{topic}'")
    try:
        # 1. Parse the response payload
        response_data = MqttResponsePayload.model_validate_json(payload)

        # 2. Log the correlated command
        logger.info(f"✅ ACTION ACK received for MsgID: {response_data.message_id} "
                    f"-> Status: {response_data.status.upper()}")

        if response_data.status == "error":
            # Enhanced error handling with specific error code interpretation
            error_detail = response_data.error
            error_message = f"Device reported ERROR for MsgID {response_data.message_id}: {error_detail}"

            # Interpret specific error codes if they are integers
            if isinstance(error_detail, int):
                if error_detail == -1:
                    error_message += " (General error or command not recognized)"
                elif error_detail == -2:
                    error_message += " (Invalid action parameters)"
                elif error_detail == -3:
                    error_message += " (Device busy or unable to process)"
                # Add more specific error code interpretations as needed

            logger.warning(f"⚠️ {error_message}")

        # Use the new MQTT logger to track the command response
        # Convert error to string if it's an integer
        error_str = str(response_data.error) if response_data.error is not None else None
        await log_mqtt_command_response(response_data.message_id, response_data.status, error_str, "action")

    except ValidationError as e:
        logger.error(f"❌ Invalid ACK payload on {topic}: {payload.decode()}. Error: {e}")
    except Exception as e:
        logger.error(f"❌ Error processing ACK on {topic}: {e}")


@mqtt.subscribe(PLC_SETTINGS_RESPONSE_TOPIC)
async def handle_plc_settings_response(client, topic, payload, qos, properties):
    """Handles 'OK'/'ERROR' responses for PLC data settings updates."""
    logger.info(f"📨 Received PLC SETTINGS ACK on '{topic}'")
    try:
        # 1. Parse the response payload
        response_data = MqttResponsePayload.model_validate_json(payload)

        # 2. Log the correlated command
        logger.info(f"✅ PLC SETTINGS ACK received for MsgID: {response_data.message_id} "
                    f"-> Status: {response_data.status.upper()}")

        if response_data.status == "error":
            # Enhanced error handling with specific error code interpretation
            error_detail = response_data.error
            error_message = f"Device reported ERROR for MsgID {response_data.message_id}: {error_detail}"

            # Interpret specific error codes if they are integers
            if isinstance(error_detail, int):
                if error_detail == -1:
                    error_message += " (General error or command not recognized)"
                elif error_detail == -2:
                    error_message += " (Invalid settings format or parameters)"
                elif error_detail == -3:
                    error_message += " (Device busy or unable to process)"
                # Add more specific error code interpretations as needed

            logger.warning(f"⚠️ {error_message}")

        # Use the new MQTT logger to track the command response
        # Convert error to string if it's an integer
        error_str = str(response_data.error) if response_data.error is not None else None
        await log_mqtt_command_response(response_data.message_id, response_data.status, error_str, "plc_settings")

    except ValidationError as e:
        logger.error(f"❌ Invalid ACK payload on {topic}: {payload.decode()}. Error: {e}")
    except Exception as e:
        logger.error(f"❌ Error processing ACK on {topic}: {e}")


# We remove the generic @mqtt.on_message() handler
# as all messages are now handled by the specific @mqtt.on_topic() handlers.
#
# @mqtt.on_message()
# async def message(client, topic, payload, qos, properties):
#     logger.info(f"📨 Received message on '{topic}': {payload.decode()}")
