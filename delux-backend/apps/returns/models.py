from django.db import models
from common.models import TenantOwnedModel


class ReturnStatus(models.TextChoices):
    REQUESTED = 'REQUESTED', 'Solicitada'
    APPROVED  = 'APPROVED',  'Aprobada'
    REJECTED  = 'REJECTED',  'Rechazada'
    REFUNDED  = 'REFUNDED',  'Reembolsada'
    CLOSED    = 'CLOSED',    'Cerrada'


class ReturnReason(models.TextChoices):
    DEFECTIVE = 'DEFECTIVE', 'Producto defectuoso'
    WRONG     = 'WRONG',     'Producto equivocado'
    SIZE      = 'SIZE',      'Talla incorrecta'
    DISLIKE   = 'DISLIKE',   'No me gustó'
    OTHER     = 'OTHER',     'Otro'


class ReturnRequest(TenantOwnedModel):
    code = models.CharField(max_length=20)
    order = models.ForeignKey(
        'orders.Order', on_delete=models.PROTECT, related_name='returns'
    )
    customer = models.ForeignKey(
        'customers.Customer', on_delete=models.PROTECT, related_name='returns'
    )
    reason = models.CharField(max_length=15, choices=ReturnReason.choices)
    note = models.TextField(blank=True)
    status = models.CharField(max_length=12, choices=ReturnStatus.choices,
                              default=ReturnStatus.REQUESTED)
    refund_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    admin_note = models.TextField(blank=True)

    class Meta:
        unique_together = [('tenant', 'code')]
        ordering = ['-created_at']


class ReturnItem(TenantOwnedModel):
    return_request = models.ForeignKey(
        ReturnRequest, on_delete=models.CASCADE, related_name='items'
    )
    order_item = models.ForeignKey(
        'orders.OrderItem', on_delete=models.PROTECT, related_name='return_items'
    )
    quantity = models.PositiveIntegerField(default=1)
    refund_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)


class SaleChangeType(models.TextChoices):
    PARCIAL = 'PARCIAL', 'Cambio parcial'
    TOTAL   = 'TOTAL',   'Cambio total'


class SaleChange(TenantOwnedModel):
    """Cambio de producto por producto ligado a una venta ya realizada (SIN
    anular ni reembolsar): el/los producto(s) devuelto(s) vuelven al stock y el/
    los entregado(s) salen del stock. Si hay diferencia de precio, se registra
    como ingreso (el cliente paga) o egreso (la tienda devuelve) en el balance.
    Puede haber varios cambios por venta. El detalle de lo devuelto y lo
    entregado se guarda en SaleChangeLine."""
    code = models.CharField(max_length=20, blank=True, default='')
    order = models.ForeignKey(
        'orders.Order', on_delete=models.PROTECT, related_name='changes'
    )
    # Campos legacy (un solo ítem devuelto) — se conservan por compatibilidad
    # con registros antiguos; el nuevo flujo usa SaleChangeLine.
    order_item = models.ForeignKey(
        'orders.OrderItem', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='changes'
    )
    variant = models.ForeignKey(
        'variants.Variant', on_delete=models.PROTECT, null=True, blank=True,
        related_name='+'
    )
    branch = models.ForeignKey(
        'branches.Branch', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='+'
    )
    product_name = models.CharField(max_length=200, blank=True, default='')
    quantity = models.PositiveIntegerField(default=1)
    valor_devuelto = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    tipo = models.CharField(max_length=8, choices=SaleChangeType.choices,
                            default=SaleChangeType.PARCIAL)
    descripcion = models.TextField(blank=True, default='')
    actor = models.ForeignKey(
        'accounts.User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='+'
    )

    # ── Cambio producto-por-producto (nuevo flujo) ──
    # Valor de lo devuelto (R), valor de lo entregado (D) y diferencia (D - R):
    # positiva = el cliente paga extra; negativa = la tienda le devuelve dinero.
    returned_value = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    delivered_value = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    difference = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    # Anulación (deshacer): NO se borra el registro; se marca como anulado y se
    # revierte stock + balance, para conservar el rastro de auditoría.
    annulled = models.BooleanField(default=False, db_index=True)
    annulled_at = models.DateTimeField(null=True, blank=True)
    annulled_by = models.ForeignKey(
        'accounts.User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='+'
    )

    class Meta:
        ordering = ['-created_at']


class SaleChangeLine(TenantOwnedModel):
    """Línea de un cambio: un ítem que el cliente DEVUELVE (RETURN, vuelve al
    stock) o un ítem que la tienda ENTREGA a cambio (DELIVER, sale del stock)."""
    RETURN = 'RETURN'
    DELIVER = 'DELIVER'
    DIRECTION_CHOICES = [(RETURN, 'Devuelto'), (DELIVER, 'Entregado')]

    change = models.ForeignKey(
        SaleChange, on_delete=models.CASCADE, related_name='lines'
    )
    direction = models.CharField(max_length=8, choices=DIRECTION_CHOICES)
    order_item = models.ForeignKey(
        'orders.OrderItem', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='change_lines'
    )
    variant = models.ForeignKey(
        'variants.Variant', on_delete=models.PROTECT, null=True, blank=True,
        related_name='+'
    )
    product_name = models.CharField(max_length=200, blank=True, default='')
    sku = models.CharField(max_length=40, blank=True, default='')
    size = models.CharField(max_length=20, blank=True, default='')
    color = models.CharField(max_length=40, blank=True, default='')
    quantity = models.PositiveIntegerField(default=1)
    unit_price = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    subtotal = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    class Meta:
        ordering = ['direction', 'id']
