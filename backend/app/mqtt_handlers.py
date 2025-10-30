# app/mqtt_handlers.py
import logging
from fastapi_mqtt import FastMQTT, MQTTConfig
from app.core.config import settings

logger = logging.getLogger(__name__)

mqtt_config: MQTTConfig = settings.mqtt_config
mqtt = FastMQTT(config=mqtt_config)

@mqtt.on_connect()
def connect(client, flags, rc, properties):
    logger.info(f"🟢 MQTT CONNECTED! RC={rc}")
    if rc == 0:
        logger.info("✅ Connection successful!")
        mqtt.client.subscribe("/mqtt")
        logger.info("📡 Subscribed to /mqtt topic")
    else:
        logger.error(f"❌ Connection failed with code: {rc}")

@mqtt.on_disconnect()
def disconnect(client, packet, exc=None):
    logger.warning(f"🔴 MQTT DISCONNECTED! Exception: {exc}")

@mqtt.on_message()
async def message(client, topic, payload, qos, properties):
    logger.info(f"📨 Received message on '{topic}': {payload.decode()}")