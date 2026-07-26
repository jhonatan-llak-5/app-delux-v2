"""Tareas Celery de notificaciones (resumenes)."""
from datetime import timedelta

from celery import shared_task
from django.utils import timezone


@shared_task
def newsletter_daily_digest():
    """Resumen diario: cuantos suscriptores nuevos hubo en las ultimas 24 h.
    Evita mandar una notificacion por cada suscriptor (seria ruido)."""
    from apps.settings.models import NewsletterSubscriber
    from .push import push_notification, admin_recipients

    since = timezone.now() - timedelta(days=1)
    n = NewsletterSubscriber.objects.filter(created_at__gte=since, is_active=True).count()
    if n <= 0:
        return 0
    push_notification(
        type='newsletter_digest', priority='P3',
        title='Nuevos suscriptores',
        message=f'{n} nuevo(s) suscriptor(es) al newsletter en las ultimas 24 h',
        link='/app/admin/subscribers',
        recipients=admin_recipients(),
    )
    return n


@shared_task
def send_order_state_email(order_id, new_status, tracking_code=''):
    """Envia el email de cambio de estado en segundo plano (no bloquea la API)."""
    from apps.orders.models import Order
    from .services import notify_order_state_change
    order = Order.objects.filter(pk=order_id).select_related('customer').first()
    if order:
        notify_order_state_change(order, new_status, tracking_code=tracking_code)


@shared_task
def send_pos_receipt_email(order_id):
    """Envía el comprobante de una venta POS en segundo plano (no bloquea el
    cobro en el punto de venta)."""
    from apps.orders.models import Order
    from .services import notify_pos_receipt
    order = (Order.objects.filter(pk=order_id)
             .select_related('customer', 'branch')
             .prefetch_related('items')
             .first())
    if order:
        notify_pos_receipt(order)


@shared_task(name='notifications.deliver_email')
def deliver_email(from_email, to_email, raw_message):
    """Envía por SMTP un correo ya renderizado, en segundo plano."""
    from .services import _smtp_send_raw
    return _smtp_send_raw(from_email, to_email, raw_message)


@shared_task
def cleanup_old_notifications(days=60):
    """Poda mensual: elimina notificaciones YA LEÍDAS con más de `days` días.
    Evita que la tabla crezca sin límite. No toca las no leídas."""
    from .models import Notification
    cutoff = timezone.now() - timedelta(days=days)
    deleted, _ = Notification.objects.filter(
        is_read=True, created_at__lt=cutoff).delete()
    return deleted
