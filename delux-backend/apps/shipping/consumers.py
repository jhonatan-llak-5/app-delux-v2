"""
WebSocket público para tracking en vivo.

URL: ws/tracking/<tracking_code>/
- No requiere autenticación: cualquiera con el código puede suscribirse.
- Recibe broadcasts del backend cuando hay nuevos eventos o se mueve el repartidor.
"""
from channels.generic.websocket import AsyncJsonWebsocketConsumer


def tracking_group_name(tracking_code: str) -> str:
    """Sanitiza el código para usarlo como nombre de grupo en Channels."""
    safe = ''.join(c for c in tracking_code.upper() if c.isalnum() or c == '-')
    return f'tracking_{safe[:80]}'


class ShipmentTrackingConsumer(AsyncJsonWebsocketConsumer):
    """Cliente se conecta y recibe push: event_added (nuevo evento) + courier_moved (lat/lon)."""

    async def connect(self):
        self.tracking_code = self.scope['url_route']['kwargs']['tracking_code']
        self.group = tracking_group_name(self.tracking_code)
        await self.channel_layer.group_add(self.group, self.channel_name)
        await self.accept()
        await self.send_json({
            'type': 'connected',
            'tracking_code': self.tracking_code,
        })

    async def disconnect(self, code):
        await self.channel_layer.group_discard(self.group, self.channel_name)

    async def tracking_update(self, event):
        """Recibe broadcast del backend."""
        await self.send_json(event['payload'])
