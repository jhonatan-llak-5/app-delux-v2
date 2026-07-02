"""WebSocket consumer de notificaciones (una conexion por usuario autenticado)."""
from channels.generic.websocket import AsyncJsonWebsocketConsumer


class AdminNotificationsConsumer(AsyncJsonWebsocketConsumer):
    """Cada usuario se une SOLO a su grupo (notif_user_<id>). El backend resuelve
    los destinatarios y envia a esos grupos, asi cada quien recibe solo lo suyo."""

    async def connect(self):
        user = self.scope.get('user')
        if not user or not getattr(user, 'is_authenticated', False):
            await self.close()
            return
        self.user_group = f'notif_user_{user.id}'
        await self.channel_layer.group_add(self.user_group, self.channel_name)
        await self.accept()
        await self.send_json({'type': 'welcome', 'message': 'Conectado a notificaciones.'})

    async def disconnect(self, code):
        group = getattr(self, 'user_group', None)
        if group:
            await self.channel_layer.group_discard(group, self.channel_name)

    async def notify(self, event):
        """Recibe el broadcast del backend y lo reenvia al cliente."""
        await self.send_json(event['payload'])
