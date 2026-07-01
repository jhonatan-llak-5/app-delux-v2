from decimal import Decimal

from django.db import transaction
from django.utils import timezone


def sync_commission_for_order(order):
    """Crea/actualiza la comision de un pedido segun su estado.

    - PAID o DELIVERED  -> genera la comision (o la reactiva si estaba anulada).
    - CANCELLED/REFUNDED -> anula la comision (si no fue pagada).
    """
    from apps.orders.models import OrderStatus
    from apps.settings.models import PlatformSettings
    from .models import Commission, CommissionStatus

    if not order.affiliate_id:
        return

    status = order.status
    generar = status in (OrderStatus.PAID, OrderStatus.DELIVERED)
    anular = status in (OrderStatus.CANCELLED, OrderStatus.REFUNDED)

    existing = Commission.objects.filter(order=order).first()

    if generar:
        if existing:
            if existing.status == CommissionStatus.CANCELLED:
                existing.status = CommissionStatus.APPROVED
                existing.save(update_fields=['status', 'updated_at'])
            return
        rate = Decimal(str(PlatformSettings.load().affiliate_commission_rate or 0))
        base = order.subtotal or Decimal('0')
        amount = (base * rate / Decimal('100')).quantize(Decimal('0.01'))
        commission = Commission.objects.create(
            tenant=order.tenant, affiliate_id=order.affiliate_id, order=order,
            base_amount=base, rate=rate, amount=amount,
            status=CommissionStatus.APPROVED,
        )
        # Notifica al afiliado que gano una comision (no rompe si falla el email).
        try:
            from apps.notifications.services import notify_affiliate_commission
            transaction.on_commit(lambda: notify_affiliate_commission(commission))
        except Exception:
            pass
    elif anular and existing and existing.status == CommissionStatus.APPROVED:
        existing.status = CommissionStatus.CANCELLED
        existing.save(update_fields=['status', 'updated_at'])


@transaction.atomic
def pay_affiliate_commissions(affiliate, method, reference='', paid_by=None,
                             commission_ids=None):
    """Registra un pago MANUAL: marca como pagadas las comisiones 'por pagar'
    del afiliado y crea un registro de pago (historial).

    - commission_ids: si se pasa, paga solo esas; si no, paga TODAS las por pagar.
    Devuelve el CommissionPayout creado.
    Lanza ValueError si no hay nada por pagar o si no se alcanza el minimo.
    """
    from apps.settings.models import PlatformSettings
    from .models import Commission, CommissionStatus, CommissionPayout

    qs = Commission.objects.select_for_update().filter(
        affiliate=affiliate, status=CommissionStatus.APPROVED)
    if commission_ids:
        qs = qs.filter(id__in=commission_ids)

    pending = list(qs)
    if not pending:
        raise ValueError('El afiliado no tiene comisiones por pagar.')

    total = sum((c.amount for c in pending), Decimal('0'))

    # Umbral minimo de pago (si esta configurado y no se paga una seleccion parcial).
    min_payout = Decimal(str(PlatformSettings.load().affiliate_min_payout or 0))
    if not commission_ids and min_payout > 0 and total < min_payout:
        raise ValueError(
            f'El total por pagar (${total}) no alcanza el minimo de pago (${min_payout}).')

    now = timezone.now()
    payout = CommissionPayout.objects.create(
        tenant=affiliate.tenant, affiliate=affiliate,
        amount=total, method=method, reference=reference,
        commissions_count=len(pending), paid_by=paid_by,
    )

    ids = [c.id for c in pending]
    Commission.objects.filter(id__in=ids).update(
        status=CommissionStatus.PAID, paid_at=now, payout=payout, updated_at=now)

    # Notifica al afiliado que se registro su pago (tras confirmar la transaccion).
    try:
        from apps.notifications.services import notify_affiliate_payout
        transaction.on_commit(lambda: notify_affiliate_payout(payout))
    except Exception:
        pass

    return payout
