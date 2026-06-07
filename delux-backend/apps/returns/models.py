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
