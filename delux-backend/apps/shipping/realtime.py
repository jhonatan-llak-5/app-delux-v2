"""Broadcasts WebSocket para tracking en vivo."""
from typing import Any, Dict, Optional

from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync

from .consumers import tracking_group_name


def _send(group: str, payload: Dict[str, Any]) -> None:
    layer = get_channel_layer()
    if layer is None:
        return
    try:
        async_to_sync(layer.group_send)(
            group, {'type': 'tracking_update', 'payload': payload}
        )
    except Exception:
        pass


def push_shipment_event(shipment, event) -> None:
    """Notifica nuevo evento de timeline al grupo del tracking_code."""
    _send(tracking_group_name(shipment.tracking_code), {
        'type': 'event_added',
        'tracking_code': shipment.tracking_code,
        'shipment_status': shipment.status,
        'shipment_status_label': shipment.get_status_display(),
        'event': {
            'status': event.status,
            'status_label': event.get_status_display(),
            'description': event.description,
            'location': event.location,
            'latitude':  float(event.latitude)  if event.latitude  is not None else None,
            'longitude': float(event.longitude) if event.longitude is not None else None,
            'created_at': event.created_at.isoformat(),
        },
    })


def push_courier_moved(shipment, lat: float, lon: float) -> None:
    """Notifica nueva posición del repartidor (INHOUSE)."""
    _send(tracking_group_name(shipment.tracking_code), {
        'type': 'courier_moved',
        'tracking_code': shipment.tracking_code,
        'latitude': float(lat),
        'longitude': float(lon),
        'updated_at': (shipment.courier_updated_at.isoformat()
                       if shipment.courier_updated_at else None),
    })
