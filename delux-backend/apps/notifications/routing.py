from django.urls import path
from .consumers import AdminNotificationsConsumer

websocket_urlpatterns = [
    path('ws/admin/notifications/', AdminNotificationsConsumer.as_asgi()),
]
