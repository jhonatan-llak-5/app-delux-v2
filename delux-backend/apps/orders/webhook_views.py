"""Receptor de webhooks de NovaFactura (estado final de la factura).

NovaFactura firma cada webhook con HMAC-SHA256 sobre el cuerpo CRUDO:
    X-NovaFactura-Signature: sha256=<hmac_hex>
Verificamos sobre ``request.body`` sin re-serializar. El campo ``order_ref``
(= el Idempotency-Key que envió DLUX = id de la orden) relaciona el webhook con
la venta.
"""
from __future__ import annotations

import hashlib
import hmac
import json

from django.core.exceptions import ValidationError
from django.http import (
    HttpResponseBadRequest,
    HttpResponseForbidden,
    JsonResponse,
)
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST

# Estado del puente (NovaFactura) -> estado de factura en la orden de DLUX.
_STATUS_MAP = {
    "AUTORIZADA": "AUTHORIZED",
    "RECHAZADA": "REJECTED",
    "ANULADA": "REJECTED",
    "PROCESANDO": "PROCESSING",
}


@csrf_exempt
@require_POST
def novafactura_webhook(request):
    from apps.orders.models import Order
    from apps.settings.models import PlatformSettings

    cfg = PlatformSettings.load()
    secret = (cfg.einvoice_webhook_secret or "").encode("utf-8")
    if not secret:
        return HttpResponseForbidden("Webhook no configurado.")

    signature = request.headers.get("X-NovaFactura-Signature", "")
    expected = "sha256=" + hmac.new(secret, request.body, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, signature):
        return HttpResponseForbidden("Firma inválida.")

    try:
        data = json.loads(request.body.decode("utf-8"))
    except (ValueError, UnicodeDecodeError):
        return HttpResponseBadRequest("JSON inválido.")

    order_ref = str(data.get("order_ref") or "").strip()
    order = None
    if order_ref:
        try:
            order = Order.objects.filter(pk=order_ref).first()
        except (ValueError, TypeError, ValidationError):
            order = None
    if order is None:
        return JsonResponse({"detail": "Orden no encontrada."}, status=404)

    status = _STATUS_MAP.get((data.get("status") or "").upper(), order.invoice_status)
    order.invoice_status = status
    order.invoice_id = data.get("invoice_id") or order.invoice_id
    order.invoice_access_key = data.get("access_key") or order.invoice_access_key
    order.invoice_number = data.get("document_number") or order.invoice_number
    order.invoice_pdf_url = data.get("pdf_url") or order.invoice_pdf_url
    order.invoice_xml_url = data.get("xml_url") or order.invoice_xml_url
    order.invoice_error = (data.get("sri_message") or "") if status == "REJECTED" else ""
    order.invoice_updated_at = timezone.now()
    order.save(update_fields=[
        "invoice_status", "invoice_id", "invoice_access_key", "invoice_number",
        "invoice_pdf_url", "invoice_xml_url", "invoice_error", "invoice_updated_at",
    ])
    return JsonResponse({"ok": True})
