import os
from django.core.asgi import get_asgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.prod')
django_asgi_app = get_asgi_application()

from channels.routing import ProtocolTypeRouter, URLRouter  # noqa: E402
from channels.auth import AuthMiddlewareStack              # noqa: E402
from apps.notifications.routing import websocket_urlpatterns as notif_ws  # noqa: E402
from apps.shipping.routing import websocket_urlpatterns as shipping_ws    # noqa: E402

websocket_urlpatterns = notif_ws + shipping_ws

application = ProtocolTypeRouter({
    'http': django_asgi_app,
    'websocket': AuthMiddlewareStack(URLRouter(websocket_urlpatterns)),
})
