from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import Dict
import uuid
from app.api.routes.ws import manager
from app.mqtt_handlers import handle_schedule_response, handle_action_response

router = APIRouter()

@router.websocket("/ws/{tenant_id}")
async def websocket_endpoint(websocket: WebSocket, tenant_id: str):
    """
    WebSocket endpoint for real-time command status updates.
    Frontend can connect to receive updates about command status.
    """
    # Validate tenant_id format
    try:
        uuid.UUID(tenant_id)
    except ValueError:
        await websocket.close(code=1008, reason="Invalid tenant ID format")
        return
    
    await manager.connect(websocket, tenant_id)
    try:
        # Keep the connection alive
        while True:
            # We don't expect to receive messages from the frontend in this implementation
            # but we keep the connection open to send updates
            # Just wait for messages but we don't process them in this use case
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, tenant_id)
