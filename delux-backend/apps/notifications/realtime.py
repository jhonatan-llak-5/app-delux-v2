"""Helper para emitir notificaciones en tiempo real al panel admin."""
from typing import Optional, Dict, Any
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync


def push_admin_notification(
    *,
    type: str,
    title: str,
    message: str = '',
    link: Optional[str] = None,
    meta: Optional[Dict[str, Any]] = None,
) -> None:
    """
    Envía una notificación al grupo WebSocket 'admin_notifications'.
    Tipos sugeridos: sale_created, user_registered, low_stock, order_placed, review_posted.
    """
    channel_layer = get_channel_layer()
    if channel_layer is None:
        return
    payload = {
        'type': type,
        'title': title,
        'message': message,
    }
    if link is not None:
        payload['link'] = link
    if meta is not None:
        payload['meta'] = meta
    try:
        async_to_sync(channel_layer.group_send)(
            'admin_notifications',
            {'type': 'notify', 'payload': payload},
        )
    except Exception:
        # No interrumpir flujo principal si broadcast falla
        pass
