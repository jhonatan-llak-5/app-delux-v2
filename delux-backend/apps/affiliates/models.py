from django.db import models
from common.models import TenantOwnedModel


class CommissionStatus(models.TextChoices):
    APPROVED  = 'APPROVED',  'Por pagar'
    PAID      = 'PAID',      'Pagada'
    CANCELLED = 'CANCELLED', 'Anulada'


class PayoutMethod(models.TextChoices):
    CASH     = 'CASH',     'Efectivo'
    TRANSFER = 'TRANSFER', 'Transferencia'


class CommissionPayout(TenantOwnedModel):
    """Pago MANUAL de comisiones a un afiliado (efectivo/transferencia).

    Lo registra un gerente o superadmin. Al crearse, marca como pagadas las
    comisiones 'por pagar' incluidas y las enlaza a este pago (historial)."""
    affiliate = models.ForeignKey(
        'accounts.User', on_delete=models.CASCADE, related_name='payouts')
    amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    method = models.CharField(
        max_length=10, choices=PayoutMethod.choices, default=PayoutMethod.CASH)
    reference = models.CharField(max_length=160, blank=True,
                                 help_text='Nota / numero de comprobante (opcional)')
    commissions_count = models.PositiveIntegerField(default=0)
    paid_by = models.ForeignKey(
        'accounts.User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='registered_payouts')

    class Meta:
        ordering = ['-created_at']
        indexes = [models.Index(fields=['tenant', 'affiliate'])]

    def __str__(self) -> str:
        return f'Pago {self.amount} -> {self.affiliate_id} ({self.method})'


class Commission(TenantOwnedModel):
    """Comision generada para un afiliado por un pedido atribuido."""
    affiliate = models.ForeignKey(
        'accounts.User', on_delete=models.CASCADE, related_name='commissions')
    order = models.OneToOneField(
        'orders.Order', on_delete=models.CASCADE, related_name='commission')
    base_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    rate = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    status = models.CharField(
        max_length=10, choices=CommissionStatus.choices,
        default=CommissionStatus.APPROVED)
    paid_at = models.DateTimeField(null=True, blank=True)
    payout = models.ForeignKey(
        'affiliates.CommissionPayout', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='commissions')

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['tenant', 'affiliate', 'status']),
        ]

    def __str__(self) -> str:
        return f'Comision {self.amount} -> {self.affiliate_id} ({self.status})'
