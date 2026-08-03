"""Puente de facturación electrónica: DLUX → NovaFactura.

Al confirmarse una venta pagada se emite (en segundo plano) la factura
electrónica en NovaFactura. El estado real final (autorizada/rechazada) NO llega
en la respuesta del emit: llega después por webhook. Aquí solo se hace el acuse
y se guarda la referencia en la orden.
"""
from __future__ import annotations

import logging
from decimal import Decimal, ROUND_HALF_UP

import requests
from django.utils import timezone

logger = logging.getLogger(__name__)

# Porcentaje de IVA -> código de porcentaje del SRI (tabla 17).
_IVA_CODE_BY_RATE = {0: "0", 12: "2", 14: "3", 15: "4"}


def iva_code_for_rate(rate) -> str:
    try:
        r = int(round(float(rate or 0)))
    except (TypeError, ValueError):
        r = 0
    return _IVA_CODE_BY_RATE.get(r, "0")


def _q4(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)


def build_emit_payload(order, cfg) -> dict:
    """Arma el payload que espera NovaFactura (`POST /invoices/emit/`).

    Los precios de DLUX incluyen IVA; el SRI factura con precio unitario NETO por
    línea, así que se desglosa el IVA según el impuesto propio de cada producto.
    """
    customer = order.customer
    ident = (getattr(customer, "document_id", "") or "").strip() or "9999999999999"
    name = (
        (getattr(customer, "business_name", "") or "").strip()
        or (getattr(customer, "full_name", "") or "").strip()
        or "CONSUMIDOR FINAL"
    )
    # Consumidor Final: la razón social del comprobante debe ser "CONSUMIDOR FINAL".
    if ident == "9999999999999":
        name = "CONSUMIDOR FINAL"

    details = []
    for it in order.items.select_related("variant__product").all():
        prod = getattr(it.variant, "product", None)
        try:
            rate = Decimal(str(prod.effective_tax_rate())) if prod else Decimal("0")
        except Exception:
            rate = Decimal(str(cfg.tax_rate or 0))
        factor = Decimal("1") + rate / Decimal("100")
        gross = Decimal(str(it.unit_price or 0))
        net = _q4(gross / factor) if factor else gross
        details.append({
            "main_code": it.sku or "",
            "description": it.product_name or "Producto",
            "quantity": int(it.quantity or 1),
            "unit_price": str(net),
            "discount": "0",
            "iva_code": iva_code_for_rate(rate),
        })

    return {
        "company": cfg.einvoice_company_uuid,
        "branch": cfg.einvoice_branch_uuid,
        "emission_point": cfg.einvoice_emission_point_uuid,
        "issue_date": (order.created_at.date() if order.created_at else timezone.localdate()).isoformat(),
        "customer_identification": ident,
        "customer_name": name,
        "customer_email": getattr(customer, "email", "") or "",
        "customer_address": getattr(customer, "address", "") or "",
        "customer_phone": getattr(customer, "phone", "") or "",
        "payment_form": order.payment_form or '01',  # SRI tabla 24
        "payments": [{
            "forma_pago": order.payment_form or '01',
            "total": str(order.total),
            "plazo": order.payment_plazo or 0,
            "unidad_tiempo": order.payment_unidad or 'dias',
        }],
        "details": details,
    }


def _mark(order, *, status, invoice_id=None, invoice_number=None, error=None):
    from apps.orders.models import Order
    fields = ["invoice_status", "invoice_updated_at"]
    order.invoice_status = status
    order.invoice_updated_at = timezone.now()
    if invoice_id is not None:
        order.invoice_id = invoice_id or ""
        fields.append("invoice_id")
    if invoice_number is not None:
        order.invoice_number = invoice_number or ""
        fields.append("invoice_number")
    if error is not None:
        order.invoice_error = (error or "")[:400]
        fields.append("invoice_error")
    order.save(update_fields=fields)


def emit_invoice(order) -> None:
    """Llama a NovaFactura para emitir la factura de la orden. Idempotente por
    `order.id` (header Idempotency-Key)."""
    from apps.orders.models import Order
    from apps.settings.models import PlatformSettings

    cfg = PlatformSettings.load()
    if not cfg.einvoice_enabled:
        return
    if not (cfg.einvoice_base_url and cfg.einvoice_api_key
            and cfg.einvoice_company_uuid and cfg.einvoice_branch_uuid
            and cfg.einvoice_emission_point_uuid):
        logger.warning("einvoice: configuración incompleta; se omite la orden %s", order.code)
        _mark(order, status=Order.InvoiceStatus.ERROR, error="Configuración de facturación incompleta.")
        return

    payload = build_emit_payload(order, cfg)
    url = cfg.einvoice_base_url.rstrip("/") + "/api/v1/invoices/emit/"
    headers = {
        "Authorization": f"Api-Key {cfg.einvoice_api_key}",
        "Idempotency-Key": str(order.id),
        "Content-Type": "application/json",
    }
    try:
        resp = requests.post(url, json=payload, headers=headers, timeout=30)
    except requests.RequestException as exc:
        _mark(order, status=Order.InvoiceStatus.ERROR, error=f"Error de red: {exc}")
        raise

    if resp.status_code in (200, 201):
        try:
            body = resp.json()
        except ValueError:
            body = {}
        data = (body.get("data") if isinstance(body, dict) else None) or {}
        _mark(
            order, status=Order.InvoiceStatus.PROCESSING,
            invoice_id=data.get("invoice_id", ""),
            invoice_number=data.get("document_number", ""),
            error="",
        )
    else:
        _mark(order, status=Order.InvoiceStatus.ERROR,
              error=f"HTTP {resp.status_code}: {resp.text[:300]}")
        resp.raise_for_status()


def enqueue_invoice(order) -> None:
    """Encola la emisión en Celery/Redis (async). Nunca bloquea ni rompe el cobro
    del POS: si la facturación está apagada, no hace nada; si el broker está caído,
    se registra y la factura queda para reintento manual desde el detalle de venta.

    A diferencia de otros dispatch de la app, aquí NO se ejecuta en línea como
    fallback: emitir contra el SRI puede tardar y no debe frenar la venta.
    """
    from apps.settings.models import PlatformSettings
    if not PlatformSettings.load().einvoice_enabled:
        return
    from apps.orders.tasks import emit_invoice_task
    try:
        emit_invoice_task.delay(str(order.id))
    except Exception as exc:
        # El broker (Redis) no está disponible. No bloqueamos la venta, pero la
        # dejamos marcada como ERROR (no en silencio) para que se vea el estado y
        # el botón de reintentar en el detalle de la venta.
        logger.warning(
            'einvoice: no se pudo encolar la factura de %s (¿broker caído?): %s',
            order.code, exc,
        )
        from apps.orders.models import Order
        _mark(
            order, status=Order.InvoiceStatus.ERROR,
            error='No se pudo encolar la emisión (servicio de tareas no disponible). Reintenta.',
        )
