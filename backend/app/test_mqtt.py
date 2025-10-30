import asyncio
from gmqtt import Client as MQTTClient

async def test_mqtt():
    client = MQTTClient("test-client-123")
    
    await client.connect("10.8.0.1", port=1883, version=4)
    print("✅ Connected successfully!")
    
    await client.disconnect()

asyncio.run(test_mqtt())