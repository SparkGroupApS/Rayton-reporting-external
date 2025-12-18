"""
MQTT Logger Module
Provides enhanced logging and debugging capabilities for MQTT operations
"""
import asyncio
import logging
from datetime import datetime
from typing import Any

from app.api.routes.ws import manager

logger = logging.getLogger(__name__)


class MqttCommandTracker:
    """
    Tracks MQTT commands and their responses for better debugging and monitoring
    """
    def __init__(self):
        self.pending_commands: dict[str, Any] = {}
        self.command_history: dict[str, dict[str, Any]] = {}
        self.timeout_tasks: dict[str, asyncio.Task] = {}  # Store timeout tasks for cancellation
        self.max_history_size = 100  # Keep last 1000 commands in history

    def register_command(self, message_id: str, command_type: str, tenant_id: str,
                         plant_id: int, payload: dict[str, Any], timeout_seconds: int = 30) -> None:
        """Register a new command that's being sent to the device"""
        command_info = {
            'message_id': message_id,
            'command_type': command_type,
            'tenant_id': tenant_id,
            'plant_id': plant_id,
            'payload': payload,
            'timestamp': datetime.utcnow(),
            'status': 'pending'
        }
        self.pending_commands[message_id] = command_info
        logger.debug(f"Registered command {message_id} for {command_type} to plant {plant_id}")

        # Schedule a timeout for this command if not already scheduled
        if message_id not in self.timeout_tasks:
            # Create an asyncio task that will handle the timeout
            timeout_task = asyncio.create_task(
                self._handle_command_timeout(message_id, timeout_seconds)
            )
            self.timeout_tasks[message_id] = timeout_task

    async def _handle_command_timeout(self, message_id: str, timeout_seconds: int) -> None:
        """Handle command timeout after specified seconds"""
        await asyncio.sleep(timeout_seconds)
        # Check if the command is still pending (not yet responded to)
        if message_id in self.pending_commands:
            command_info = self.pending_commands[message_id]
            logger.warning(f"Command {message_id} timed out after {timeout_seconds}s for {command_info['command_type']} to plant {command_info['plant_id']}")

            # Update command status to timed out
            command_info.update({
                'status': 'timeout',
                'error': f'Command timed out after {timeout_seconds} seconds',
                'response_timestamp': datetime.utcnow()
            })
            # Move from pending to history
            self.command_history[message_id] = command_info
            del self.pending_commands[message_id]

            # Remove the timeout task as it's no longer needed
            if message_id in self.timeout_tasks:
                del self.timeout_tasks[message_id]

            # Create a timeout message to broadcast to connected WebSocket clients
            message = {
                "type": "command_response",
                "command_type": command_info['command_type'],
                "message_id": message_id,
                "status": "timeout",
                "error": f"Command timed out after {timeout_seconds} seconds"
            }

            # Broadcast to the tenant that originated this message
            await manager.broadcast_to_message_originator(message, message_id)

    def update_command_status(self, message_id: str, status: str, error: str | None = None) -> None:
        """Update the status of a command when response is received"""
        if message_id in self.pending_commands:
            command_info = self.pending_commands[message_id]
            command_info.update({
                'status': status,
                'error': error,
                'response_timestamp': datetime.utcnow()
            })
            # Move from pending to history
            self.command_history[message_id] = command_info
            del self.pending_commands[message_id]
            logger.info(f"Updated command {message_id} status to {status}{' with error: ' + str(error) if error else ''}")

            # Cancel and remove the timeout task since we received a response
            if message_id in self.timeout_tasks:
                self.timeout_tasks[message_id].cancel()
                del self.timeout_tasks[message_id]

            # Keep history size manageable
            if len(self.command_history) > self.max_history_size:
                # Remove oldest entries
                oldest_keys = sorted(self.command_history.keys(),
                                   key=lambda k: self.command_history[k]['timestamp'])[:-self.max_history_size + 100]
                for key in oldest_keys:
                    del self.command_history[key]

    def get_command_status(self, message_id: str) -> dict[str, Any] | None:
        """Get the status of a specific command"""
        if message_id in self.pending_commands:
            return self.pending_commands[message_id]
        elif message_id in self.command_history:
            return self.command_history[message_id]
        return None

    def get_pending_commands(self) -> dict[str, dict[str, Any]]:
        """Get all pending commands"""
        return self.pending_commands.copy()

    def get_recent_history(self, limit: int = 50) -> dict[str, dict[str, Any]]:
        """Get recent command history"""
        sorted_history = dict(sorted(self.command_history.items(),
                                   key=lambda item: item[1]['timestamp'], reverse=True)[:limit])
        return sorted_history

    def cleanup_expired_commands(self, max_age_minutes: int = 60) -> int:
        """Remove commands that have been pending for too long"""
        expired_commands = []
        current_time = datetime.utcnow()
        max_age = max_age_minutes * 60 # Convert to seconds

        for msg_id, cmd_info in self.pending_commands.items():
            age = (current_time - cmd_info['timestamp']).total_seconds()
            if age > max_age:
                expired_commands.append(msg_id)

        for msg_id in expired_commands:
            # Cancel and remove the timeout task
            if msg_id in self.timeout_tasks:
                self.timeout_tasks[msg_id].cancel()
                del self.timeout_tasks[msg_id]
            del self.pending_commands[msg_id]
            logger.warning(f"Removed expired command {msg_id} after {max_age_minutes} minutes")

        return len(expired_commands)


# Global instance of the command tracker
command_tracker = MqttCommandTracker()


async def log_mqtt_command_response(message_id: str, status: str, error: str | None = None,
                                   command_type: str = "unknown") -> None:
    """
    Log MQTT command response and broadcast to WebSocket clients
    """
    # Update command status in tracker
    command_tracker.update_command_status(message_id, status, error)

    # Create a message to broadcast to connected WebSocket clients
    message = {
        "type": "command_response",
        "command_type": command_type,
        "message_id": message_id,
        "status": status,
        "error": error if status == "error" else None
    }

    # Broadcast to the tenant that originated this message
    await manager.broadcast_to_message_originator(message, message_id)
