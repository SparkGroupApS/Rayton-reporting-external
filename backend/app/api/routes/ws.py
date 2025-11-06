from typing import Dict, Set
import asyncio
import json
from fastapi import WebSocket, WebSocketDisconnect

class WebSocketManager:
    def __init__(self):
        self.active_connections: Dict[str, Set[WebSocket]] = {}
        # Store mappings between message IDs and tenant IDs
        self.message_to_tenant_map: Dict[str, str] = {}
    
    async def connect(self, websocket: WebSocket, tenant_id: str):
        await websocket.accept()
        if tenant_id not in self.active_connections:
            self.active_connections[tenant_id] = set()
        self.active_connections[tenant_id].add(websocket)
        print(f"WebSocket connected for tenant {tenant_id}. Total connections: {len(self.active_connections[tenant_id])}")
    
    def disconnect(self, websocket: WebSocket, tenant_id: str):
        if tenant_id in self.active_connections:
            self.active_connections[tenant_id].discard(websocket)
            print(f"WebSocket disconnected for tenant {tenant_id}. Remaining connections: {len(self.active_connections[tenant_id])}")
            if len(self.active_connections[tenant_id]) == 0:
                del self.active_connections[tenant_id]
    
    def register_message_tenant_mapping(self, message_id: str, tenant_id: str):
        """Register a mapping between a message ID and a tenant ID."""
        self.message_to_tenant_map[message_id] = tenant_id
    
    def get_tenant_by_message_id(self, message_id: str) -> str:
        """Get the tenant ID associated with a message ID."""
        return self.message_to_tenant_map.get(message_id)
    
    def remove_message_tenant_mapping(self, message_id: str):
        """Remove a mapping between a message ID and a tenant ID."""
        if message_id in self.message_to_tenant_map:
            del self.message_to_tenant_map[message_id]
    
    async def broadcast_to_tenant(self, message: dict, tenant_id: str):
        """Broadcast a message to all WebSocket connections for a specific tenant."""
        if tenant_id in self.active_connections:
            disconnected = set()
            for connection in self.active_connections[tenant_id]:
                try:
                    await connection.send_text(json.dumps(message))
                except WebSocketDisconnect:
                    disconnected.add(connection)
            
            # Remove disconnected connections
            for connection in disconnected:
                self.disconnect(connection, tenant_id)
    
    async def broadcast_to_message_originator(self, message: dict, message_id: str):
        """Broadcast a message to the tenant that originated a specific message ID."""
        tenant_id = self.get_tenant_by_message_id(message_id)
        if tenant_id:
            await self.broadcast_to_tenant(message, tenant_id)
            # Clean up the mapping after broadcasting
            self.remove_message_tenant_mapping(message_id)

# Create a global instance of the WebSocket manager
manager = WebSocketManager()
