"""Django signals -> notificaciones persistentes + WebSocket (por destinatario).

Fase 1 (P1 + afiliado):
  - Venta POS / Pedido web         -> staff de la sucursal (P1)
  - Stock bajo (al cruzar umbral)  -> staff de la sucursal (P1)
  - Comision de afiliado generada  -> el afiliado (P2)

Fase 2 (operativas / relacion, P2):
  - Pedido web confirmado/pagado   -> staff de la sucursal
  - Devolucion / cambio solicitado -> staff de la sucursal
  - Nueva resena de producto       -> admins del tenant
  - Pago de comision registrado    -> el afiliado
  - Nuevo afiliado registrado      -> admins (global)
"""
from django.db import transaction
from django.utils import timezone
from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver

from .push import push_notification, staff_recipients, admin_recipients


def _get_models():
    from apps.orders.models import Order
    from apps.inventory.models import Stock
    from apps.affiliates.models import Commission
    return Order, Stock, Commission


# ══════════════════════════ FASE 1 ══════════════════════════

# -- Nueva venta POS / Nuevo pedido web --
@receiver(post_save, dispatch_uid='notif_order_created')
def _on_order_created(sender, instance, created, **kwargs):
    Order, _, _ = _get_models()
    if sender is not Order or not created:
        return
    order = instance
    branch = getattr(order, 'branch', None)
    tenant = getattr(order, 'tenant', None)
    code = getattr(order, 'code', None) or f'#{order.pk}'
    branch_name = getattr(branch, 'name', '') if branch else ''
    is_pos = getattr(order, 'channel', '') == 'POS'

    def _send():
        # El total se lee aquí (en on_commit), no al crearse la orden: en el POS
        # la orden nace con total 0 y se calcula después, dentro de la misma
        # transacción. Al commit ya tiene el valor real.
        total = getattr(order, 'total', '')
        push_notification(
            type='sale' if is_pos else 'order',
            priority='P1',
            title='Nueva venta' if is_pos else 'Nuevo pedido',
            message=f'{code} - ${total}' + (f' - {branch_name}' if branch_name else ''),
            link=f'/app/admin/sales/{order.pk}',
            meta={'order_id': order.pk, 'code': code},
            recipients=staff_recipients(tenant, branch),
            tenant=tenant, branch=branch,
        )
    transaction.on_commit(_send)


# -- Stock bajo: cruce del umbral --
@receiver(pre_save, dispatch_uid='notif_stock_prev')
def _stock_remember_prev(sender, instance, **kwargs):
    _, Stock, _ = _get_models()
    if sender is not Stock or not instance.pk:
        return
    try:
        instance._prev_quantity = Stock.objects.only('quantity').get(pk=instance.pk).quantity
    except Stock.DoesNotExist:
        instance._prev_quantity = None


@receiver(post_save, dispatch_uid='notif_stock_low')
def _on_stock_low(sender, instance, created, **kwargs):
    _, Stock, _ = _get_models()
    if sender is not Stock:
        return
    stock = instance
    threshold = getattr(stock, 'min_threshold', 0) or 0
    if threshold <= 0:
        return
    qty = getattr(stock, 'quantity', 0)
    from .models import Notification

    # Por encima del umbral -> auto-resuelve alertas pendientes de este stock.
    if qty > threshold:
        def _resolve():
            Notification.objects.filter(
                type='low_stock', is_read=False, meta__stock_id=stock.pk,
            ).update(is_read=True, read_at=timezone.now())
        transaction.on_commit(_resolve)
        return

    # No notificar en la creacion: recepcion crea el stock en 0 y luego suma;
    # avisar aqui daria una falsa alarma antes de sumar lo recibido.
    if created:
        return

    branch = getattr(stock, 'branch', None)
    tenant = getattr(stock, 'tenant', None)
    variant = getattr(stock, 'variant', None)
    product = getattr(variant, 'product', None) if variant else None
    pname = getattr(product, 'name', 'Producto') if product else 'Producto'
    bname = getattr(branch, 'name', '') if branch else ''

    def _send():
        # Dedup: una sola alerta sin leer por stock (evita spam en cada venta).
        if Notification.objects.filter(
            type='low_stock', is_read=False, meta__stock_id=stock.pk,
        ).exists():
            return
        push_notification(
            type='low_stock', priority='P1',
            title='Stock bajo' if qty > 0 else 'Producto agotado',
            message=f'{pname}' + (f' - {bname}' if bname else '') + f': {qty} unidades',
            link='/app/admin/inventory',
            meta={'stock_id': stock.pk, 'product': pname, 'quantity': qty},
            recipients=staff_recipients(tenant, branch),
            tenant=tenant, branch=branch,
        )
    transaction.on_commit(_send)


# -- Comision de afiliado generada --
@receiver(post_save, dispatch_uid='notif_affiliate_commission')
def _on_commission_created(sender, instance, created, **kwargs):
    _, _, Commission = _get_models()
    if sender is not Commission or not created:
        return
    commission = instance
    affiliate = getattr(commission, 'affiliate', None)
    if not affiliate:
        return
    amount = getattr(commission, 'amount', '')
    order = getattr(commission, 'order', None)
    ocode = getattr(order, 'code', None) if order else None

    def _send():
        push_notification(
            type='affiliate_commission', priority='P2', title='Nueva comision',
            message=f'Ganaste ${amount}' + (f' por la venta {ocode}' if ocode else ''),
            link='/app/affiliate/comisiones',
            meta={'commission_id': commission.pk, 'amount': str(amount)},
            recipients=[affiliate], tenant=getattr(commission, 'tenant', None),
        )
    transaction.on_commit(_send)


# ══════════════════════════ FASE 2 ══════════════════════════

# -- Pedido web confirmado / pagado (transicion a PAID) --
@receiver(pre_save, dispatch_uid='notif_order_prev_status')
def _order_remember_status(sender, instance, **kwargs):
    Order, _, _ = _get_models()
    if sender is not Order or not instance.pk:
        return
    try:
        instance._prev_status = Order.objects.only('status').get(pk=instance.pk).status
    except Order.DoesNotExist:
        instance._prev_status = None


@receiver(post_save, dispatch_uid='notif_order_paid')
def _on_order_paid(sender, instance, created, **kwargs):
    Order, _, _ = _get_models()
    if sender is not Order or created:
        return
    order = instance
    if getattr(order, 'channel', '') == 'POS':
        return  # el POS ya nace pagado
    prev = getattr(order, '_prev_status', None)
    if getattr(order, 'status', '') != 'PAID' or prev == 'PAID':
        return
    branch = getattr(order, 'branch', None)
    tenant = getattr(order, 'tenant', None)
    code = getattr(order, 'code', None) or f'#{order.pk}'
    bname = getattr(branch, 'name', '') if branch else ''

    def _send():
        push_notification(
            type='order_paid', priority='P2', title='Pedido pagado',
            message=f'{code} confirmado' + (f' - {bname}' if bname else ''),
            link=f'/app/admin/sales/{order.pk}',
            meta={'order_id': order.pk, 'code': code},
            recipients=staff_recipients(tenant, branch),
            tenant=tenant, branch=branch,
        )
    transaction.on_commit(_send)


# -- Devolucion / cambio solicitado --
@receiver(post_save, dispatch_uid='notif_return_created')
def _on_return_created(sender, instance, created, **kwargs):
    from apps.returns.models import ReturnRequest
    if sender is not ReturnRequest or not created:
        return
    rr = instance
    order = getattr(rr, 'order', None)
    branch = getattr(order, 'branch', None) if order else None
    tenant = getattr(rr, 'tenant', None)
    code = getattr(rr, 'code', None) or f'#{rr.pk}'

    def _send():
        push_notification(
            type='return', priority='P2', title='Devolucion solicitada',
            message=f'Solicitud {code}',
            link='/app/admin/returns',
            meta={'return_id': rr.pk, 'code': code},
            recipients=staff_recipients(tenant, branch),
            tenant=tenant, branch=branch,
        )
    transaction.on_commit(_send)


# -- Nueva resena de producto --
@receiver(post_save, dispatch_uid='notif_review_created')
def _on_review_created(sender, instance, created, **kwargs):
    from apps.reviews.models import Review
    if sender is not Review or not created:
        return
    rv = instance
    tenant = getattr(rv, 'tenant', None)
    product = getattr(rv, 'product', None)
    pname = getattr(product, 'name', 'un producto') if product else 'un producto'
    rating = getattr(rv, 'rating', '')

    def _send():
        push_notification(
            type='review', priority='P2', title='Nueva resena',
            message=f'{rating}/5 en {pname}',
            link='/app/admin/reviews',
            meta={'review_id': rv.pk, 'rating': rating},
            recipients=staff_recipients(tenant, None),
            tenant=tenant,
        )
    transaction.on_commit(_send)


# -- Pago de comision registrado -> el afiliado --
@receiver(post_save, dispatch_uid='notif_payout_created')
def _on_payout_created(sender, instance, created, **kwargs):
    from apps.affiliates.models import CommissionPayout
    if sender is not CommissionPayout or not created:
        return
    payout = instance
    affiliate = getattr(payout, 'affiliate', None)
    if not affiliate:
        return
    amount = getattr(payout, 'amount', '')
    method = getattr(payout, 'method', '')

    def _send():
        push_notification(
            type='affiliate_payout', priority='P2', title='Pago recibido',
            message=f'Se registro tu pago de ${amount}' + (f' ({method})' if method else ''),
            link='/app/affiliate/pagos',
            meta={'payout_id': payout.pk, 'amount': str(amount)},
            recipients=[affiliate], tenant=getattr(payout, 'tenant', None),
        )
    transaction.on_commit(_send)


# -- Nuevo afiliado registrado -> admins (global) --
@receiver(post_save, dispatch_uid='notif_affiliate_registered')
def _on_affiliate_registered(sender, instance, created, **kwargs):
    from apps.accounts.models import User, Role
    if sender is not User or not created:
        return
    if getattr(instance, 'role', None) != Role.AFFILIATE:
        return
    name = getattr(instance, 'full_name', '') or getattr(instance, 'email', '')

    def _send():
        push_notification(
            type='affiliate_new', priority='P2', title='Nuevo afiliado',
            message=f'{name} se registro como afiliado',
            link='/app/admin/affiliates',
            meta={'user_id': instance.pk, 'email': getattr(instance, 'email', '')},
            recipients=admin_recipients(),
            tenant=getattr(instance, 'tenant', None),
        )
    transaction.on_commit(_send)


# ══════════════════════════ FASE 3 ══════════════════════════

# -- Nuevo cliente registrado -> admins (P3, sin sonido) --
@receiver(post_save, dispatch_uid='notif_customer_registered')
def _on_customer_registered(sender, instance, created, **kwargs):
    from apps.accounts.models import User, Role
    if sender is not User or not created:
        return
    if getattr(instance, 'role', None) != Role.CUSTOMER:
        return
    name = getattr(instance, 'full_name', '') or getattr(instance, 'email', '')

    def _send():
        push_notification(
            type='customer_new', priority='P3', title='Nuevo cliente',
            message=f'{name} se registro',
            link='/app/admin/users',
            meta={'user_id': instance.pk, 'email': getattr(instance, 'email', '')},
            recipients=admin_recipients(),
            tenant=getattr(instance, 'tenant', None),
        )
    transaction.on_commit(_send)
