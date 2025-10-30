# # backend/app/core/mqtt.py
# from fastapi_mqtt import FastMQTT, MQTTConfig # <-- Import the real config
# from app.core.config import settings

# # Use the imported MQTTConfig
# mqtt_config = MQTTConfig(
#     host = settings.MQTT_BROKER,
#     port = settings.MQTT_PORT,
#     username = settings.MQTT_USERNAME,
#     password = settings.MQTT_PASSWORD,
#     # Add other settings like keepalive if needed
# )

# # Create the mqtt object
# mqtt = FastMQTT(config=mqtt_config)