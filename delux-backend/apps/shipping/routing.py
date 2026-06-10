from django.urls import path
from .consumers import ShipmentTrackingConsumer

# El tracking_code es alfanumérico con guiones (formato DLX-TR-YYMMDD-XXXX).
websocket_urlpatterns = [
    path('ws/tracking/<str:tracking_code>/', ShipmentTrackingConsumer.as_asgi()),
]
