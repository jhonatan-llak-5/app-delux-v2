"""Tareas Celery de órdenes."""
from celery import shared_task


@shared_task(bind=True, max_retries=5, default_retry_delay=120)
def emit_invoice_task(self, order_id):
    """Emite la factura electrónica de una orden en NovaFactura.

    Reintenta ante fallos de red/servidor (backoff). La emisión es idempotente
    por el id de la orden, así que reintentar no duplica facturas.
    """
    from apps.orders.models import Order
    from apps.orders.einvoice import emit_invoice

    order = Order.objects.filter(id=order_id).first()
    if not order:
        return
    try:
        emit_invoice(order)
    except Exception as exc:
        try:
            raise self.retry(exc=exc)
        except self.MaxRetriesExceededError:
            # Ya quedó marcada como ERROR en la orden; se puede reintentar manual.
            return
