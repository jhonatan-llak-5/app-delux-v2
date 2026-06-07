from django.db import models
from common.models import TenantOwnedModel


class Stock(TenantOwnedModel):
    """Stock por variante por sucursal — corazón del multi-sucursal."""
    variant = models.ForeignKey(
        'variants.Variant', on_delete=models.CASCADE, related_name='stocks'
    )
    branch = models.ForeignKey(
        'branches.Branch', on_delete=models.CASCADE, related_name='stocks'
    )
    quantity = models.IntegerField(default=0)
    reserved = models.IntegerField(default=0)
    min_threshold = models.PositiveIntegerField(default=2)

    class Meta:
        unique_together = [('variant', 'branch')]
        indexes = [models.Index(fields=['branch', 'variant'])]

    @property
    def available(self) -> int:
        return max(self.quantity - self.reserved, 0)


class StockMovement(TenantOwnedModel):
    TYPE_IN = 'IN'
    TYPE_OUT = 'OUT'
    TYPE_ADJ = 'ADJ'
    TYPE_TRANSFER_IN = 'XFER_IN'
    TYPE_TRANSFER_OUT = 'XFER_OUT'
    TYPE_RESERVE = 'RESERVE'
    TYPE_RELEASE = 'RELEASE'

    TYPES = [
        (TYPE_IN, 'Entrada'),
        (TYPE_OUT, 'Salida'),
        (TYPE_ADJ, 'Ajuste'),
        (TYPE_TRANSFER_IN, 'Transferencia entrada'),
        (TYPE_TRANSFER_OUT, 'Transferencia salida'),
        (TYPE_RESERVE, 'Reserva'),
        (TYPE_RELEASE, 'Liberación'),
    ]

    stock = models.ForeignKey(Stock, on_delete=models.CASCADE, related_name='movements')
    type = models.CharField(max_length=10, choices=TYPES)
    quantity = models.IntegerField()
    note = models.CharField(max_length=240, blank=True)
    actor = models.ForeignKey(
        'accounts.User', on_delete=models.SET_NULL, null=True, blank=True
    )
