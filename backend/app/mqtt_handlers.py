# app/mqtt_handlers.py
import logging
from fastapi_mqtt import FastMQTT, MQTTConfig
from app.core.config import settings
from pydantic import ValidationError

# Import the response model from our new central file
from app.models import MqttResponsePayload

# Import WebSocket manager to broadcast updates
from app.api.routes.ws import manager

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
            logger.warning(f"⚠️ Device reported ERROR for MsgID {response_data.message_id}: {response_data.error}")

        # 3. Create a message to broadcast to connected WebSocket clients
        message = {
            "type": "command_response",
            "command_type": "schedule",
            "message_id": response_data.message_id,
            "status": response_data.status,
            "error": response_data.error if response_data.status == "error" else None
        }
        
        # Broadcast to the tenant that originated this message
        await manager.broadcast_to_message_originator(message, response_data.message_id)

        # 4. TODO: Update command status in the database
        # Example:
        # await db.execute(
        #     "UPDATE command_log SET status = :status, error = :error "
        #     "WHERE message_id = :message_id",
        #     values={
        #         "status": response_data.status,
        #         "error": response_data.error,
        #         "message_id": response_data.message_id
        #     }
        # )
        # await db.commit()

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
            logger.warning(f"⚠️ Device reported ERROR for MsgID {response_data.message_id}: {response_data.error}")

        # Create a message to broadcast to connected WebSocket clients
        message = {
            "type": "command_response",
            "command_type": "action",
            "message_id": response_data.message_id,
            "status": response_data.status,
            "error": response_data.error if response_data.status == "error" else None
        }
        
        # Broadcast to the tenant that originated this message
        await manager.broadcast_to_message_originator(message, response_data.message_id)

        # 3. TODO: Update command status in the database
        # (Same logic as in handle_schedule_response)
        # await update_command_status_in_db(response_data)

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
            logger.warning(f"⚠️ Device reported ERROR for MsgID {response_data.message_id}: {response_data.error}")

        # 3. Create a message to broadcast to connected WebSocket clients
        message = {
            "type": "command_response",
            "command_type": "plc_settings",
            "message_id": response_data.message_id,
            "status": response_data.status,
            "error": response_data.error if response_data.status == "error" else None
        }
        
        # Broadcast to the tenant that originated this message
        await manager.broadcast_to_message_originator(message, response_data.message_id)

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
