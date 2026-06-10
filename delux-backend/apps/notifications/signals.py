"""Django signals → broadcast WebSocket al panel admin."""
from django.db.models.signals import post_save
from django.dispatch import receiver

from .realtime import push_admin_notification

# Cargas perezosas para evitar circular imports en tiempo de import
def _get_models():
    from apps.accounts.models import User
    try:
        from apps.orders.models import Order
    except Exception:
        Order = None
    try:
        from apps.inventory.models import Stock
    except Exception:
        Stock = None
    return User, Order, Stock


@receiver(post_save)
def _on_any_save(sender, instance, created, **kwargs):
    User, Order, Stock = _get_models()

    # ── Nuevo usuario registrado ──
    if User is not None and sender is User and created:
        push_admin_notification(
            type='user_registered',
            title='Nuevo usuario registrado',
            message=f'{getattr(instance, "full_name", "") or instance.email} se acaba de registrar.',
            link='/app/admin/users',
            meta={'user_id': instance.pk, 'email': instance.email},
        )
        return

    # ── Nueva orden creada ──
    if Order is not None and sender is Order and created:
        code = getattr(instance, 'code', None) or f'#{instance.pk}'
        total = getattr(instance, 'total', '')
        push_admin_notification(
            type='order_placed' if getattr(instance, 'channel', '') != 'POS' else 'sale_created',
            title='Nueva venta' if getattr(instance, 'channel', '') == 'POS' else 'Nuevo pedido',
            message=f'Voucher {code} · Total ${total}',
            link='/app/admin/sales',
            meta={'order_id': instance.pk, 'code': code},
        )
        return

    # ── Stock bajo (cuando units <= reorder_level) ──
    if Stock is not None and sender is Stock and not created:
        try:
            units = getattr(instance, 'units', 0)
            min_level = getattr(instance, 'min_level', 0) or 0
            # Sólo notificar al cruzar el umbral hacia abajo
            if min_level and units <= min_level and units > 0:
                product_name = getattr(instance.variant.product, 'name', 'Producto') \
                    if getattr(instance, 'variant', None) else 'Producto'
                branch_name  = getattr(instance.branch, 'name', '') \
                    if getattr(instance, 'branch', None) else ''
                push_admin_notification(
                    type='low_stock',
                    title='Stock bajo',
                    message=f'{product_name} · {branch_name}: {units} unidades restantes',
                    link='/app/admin/inventory',
                    meta={'stock_id': instance.pk, 'product': product_name, 'branch': branch_name},
                )
        except Exception:
            pass
