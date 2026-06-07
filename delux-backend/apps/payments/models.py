from django.db import models
from common.models import TenantOwnedModel


class PaymentMethod(models.TextChoices):
    PAYPHONE = 'PAYPHONE', 'PayPhone'
    CARD     = 'CARD',     'Tarjeta'
    TRANSFER = 'TRANSFER', 'Transferencia'
    CASH     = 'CASH',     'Efectivo'


class PaymentStatus(models.TextChoices):
    PENDING   = 'PENDING',   'Pendiente'
    SUCCEEDED = 'SUCCEEDED', 'Confirmado'
    FAILED    = 'FAILED',    'Fallido'
    REFUNDED  = 'REFUNDED',  'Devuelto'


class Payment(TenantOwnedModel):
    order = models.ForeignKey(
        'orders.Order', on_delete=models.PROTECT, related_name='payments'
    )
    method = models.CharField(max_length=10, choices=PaymentMethod.choices)
    status = models.CharField(max_length=10, choices=PaymentStatus.choices,
                              default=PaymentStatus.PENDING)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    external_id = models.CharField(max_length=120, blank=True)
    raw_payload = models.JSONField(default=dict, blank=True)
