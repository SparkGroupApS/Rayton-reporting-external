# app/mqtt_handlers.py
import logging
from typing import Any
from gmqtt import Client as MQTTClient # For type hints in callbacks
from fastapi_mqtt import FastMQTT, MQTTConfig

from app.core.config import settings # Import your application settings

logger = logging.getLogger(__name__)

# --- Create the FastMQTT instance ---
# Use the settings.mqtt_config property which returns a correctly configured MQTTConfig Pydantic model instance
# Ensure the field names in MQTTConfig (host, port, etc.) match what fastapi-mqtt expects.
mqtt_config: MQTTConfig = settings.mqtt_config

# Initialize the FastMQTT instance with the configuration
mqtt = FastMQTT(config=mqtt_config)
# --- End Create FastMQTT instance ---

@mqtt.on_connect()
async def on_mqtt_connect(client: MQTTClient, flags: int, rc: int, properties: Any):
    """
    Callback triggered when the MQTT client connects (or fails to connect) to the broker.
    Args:
        client: The underlying gmqtt Client instance.
        flags: Connect flags.
        rc: Result code. 0 means success.
        properties: MQTTv5 properties (dict-like).
    """
    if rc == 0:
        logger.info(f"MQTT Client '{client._client_id}' connected successfully to broker at {client._host}:{client._port}")
        # Example: Subscribe to topics upon successful connection
        # client.subscribe("device/status/#", qos=1)
        # logger.info("Subscribed to 'device/status/#'")
    else:
        # Common rc values (can vary slightly):
        # 1: Connection refused - incorrect protocol version
        # 2: Connection refused - invalid client identifier
        # 3: Connection refused - server unavailable
        # 4: Connection refused - bad username or password
        # 5: Connection refused - not authorised
        logger.error(f"MQTT Client failed to connect. Result code (rc): {rc}. Check broker address, port, credentials.")

@mqtt.on_disconnect()
async def on_mqtt_disconnect(client: MQTTClient, packet, exc=None):
    """
    Callback triggered when the MQTT client disconnects from the broker.
    Args:
        client: The underlying gmqtt Client instance.
        packet: The DISCONNECT packet (if clean disconnect) or None.
        exc: Exception object if disconnection was caused by an error.
    """
    if exc:
        logger.warning(f"MQTT Client '{client._client_id}' disconnected unexpectedly. Reason: {exc}")
    else:
        logger.info(f"MQTT Client '{client._client_id}' disconnected cleanly.")

# Example: Handling incoming messages on *any* subscribed topic
# @mqtt.on_message()
# async def handle_incoming_message(client: MQTTClient, topic: str, payload: bytes, qos: int, properties: Any):
#     """
#     Callback triggered for *any* message received on a subscribed topic.
#     Args:
#         client: The underlying gmqtt Client instance.
#         topic: The topic the message was received on.
#         payload: The message payload (bytes).
#         qos: The QoS level of the message.
#         properties: MQTTv5 properties (dict-like).
#     """
#     payload_str = payload.decode('utf-8', errors='ignore') # Decode payload bytes to string
#     logger.debug(f"MQTT Message Received on '{topic}': {payload_str} (QoS: {qos})")
#     # --- Process the message ---
#     # Add your logic here to handle the message based on topic/payload.
#     # This might involve:
#     # - Parsing JSON payload
#     # - Updating database records
#     # - Sending notifications
#     # - Calling other services
#     # Example:
#     # if topic.startswith("sensor/"):
#     #     # Process sensor data
#     #     pass
#     # elif topic == "device/alert":
#     #     # Handle alert
#     #     pass
#     # --- End Process ---

# Example: Handling messages on specific topics or patterns
# You can define multiple handlers, potentially using decorators provided by fastapi-mqtt
# if it supports direct topic subscription in decorators (check library docs).
# Otherwise, use @mqtt.on_message() and implement topic filtering inside the handler.

# Example: Handling messages for the schedule update topic
# @mqtt.subscribe("schedule/update/+") # Example pattern subscription if supported by library
# async def handle_schedule_update(client: MQTTClient, topic: str, payload: bytes, qos: int, properties: Any):
#     """
#     Callback triggered for messages on topics matching 'schedule/update/+'.
#     The '+' wildcard captures the plant_id.
#     Args:
#         client: The underlying gmqtt Client instance.
#         topic: The specific topic matched (e.g., 'schedule/update/123').
#         payload: The message payload (bytes).
#         qos: The QoS level of the message.
#         properties: MQTTv5 properties (dict-like).
#     """
#     try:
#         payload_str = payload.decode('utf-8', errors='ignore')
#         # Extract plant_id from topic if needed (topic.split('/')[-1])
#         logger.info(f"Schedule update received on '{topic}': {payload_str}")
#         # Process the schedule update payload
#         # This might involve parsing JSON, validating data, updating the database.
#         # Example:
#         # import json
#         # schedule_data = json.loads(payload_str)
#         # update_schedule_in_database(schedule_data, plant_id_from_topic)
#
#     except Exception as e:
#         logger.error(f"Error processing schedule update from topic '{topic}': {e}")

# --- End MQTT Event Callbacks ---