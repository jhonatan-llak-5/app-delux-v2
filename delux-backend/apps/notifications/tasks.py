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
