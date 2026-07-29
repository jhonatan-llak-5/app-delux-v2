"""URLs de integración de facturación electrónica (webhooks entrantes)."""
from django.urls import path

from .webhook_views import novafactura_webhook

urlpatterns = [
    path("webhook/", novafactura_webhook, name="novafactura-webhook"),
]
