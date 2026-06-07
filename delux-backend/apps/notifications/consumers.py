"""WebSocket consumers para notificaciones en tiempo real."""
import json
from channels.generic.websocket import AsyncJsonWebsocketConsumer


class AdminNotificationsConsumer(AsyncJsonWebsocketConsumer):
    """Notificaciones para el panel admin: nuevas ventas, alertas de stock."""
    group_name = 'admin_notifications'

    async def connect(self):
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()
        await self.send_json({
            'type': 'welcome',
            'message': 'Conectado a notificaciones en tiempo real.',
        })

    async def disconnect(self, code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def notify(self, event):
        """Recibe broadcast del backend."""
        await self.send_json(event['payload'])
