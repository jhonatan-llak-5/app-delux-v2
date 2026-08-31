"""Caja de mostrador (turnos).

Un turno (`CashSession`) se abre con un fondo inicial contado billete por
billete, acumula durante el día las ventas POS, los gastos en efectivo y los
ingresos/retiros manuales, y se cierra con un segundo conteo físico. La
diferencia entre lo contado y lo esperado es el descuadre del turno.
"""
from decimal import Decimal

from django.db import models
from django.utils import timezone

from common.models import TenantOwnedModel


class PieceType(models.TextChoices):
    BILL = 'BILL', 'Billete'
    COIN = 'COIN', 'Moneda'


class CountStage(models.TextChoices):
    OPENING = 'OPENING', 'Apertura'
    CLOSING = 'CLOSING', 'Cierre'


# Denominaciones en circulación (USD, Ecuador), en el orden en que se muestran
# en la pantalla de conteo. El billete y la moneda de $1 conviven, por eso el
# conteo se guarda por (tipo de pieza, denominación) y no solo por el valor.
DENOMINATIONS: list[tuple[str, Decimal]] = [
    (PieceType.BILL, Decimal('100')),
    (PieceType.BILL, Decimal('50')),
    (PieceType.BILL, Decimal('20')),
    (PieceType.BILL, Decimal('10')),
    (PieceType.BILL, Decimal('5')),
    (PieceType.BILL, Decimal('2')),
    (PieceType.BILL, Decimal('1')),
    (PieceType.COIN, Decimal('1')),
    (PieceType.COIN, Decimal('0.50')),
    (PieceType.COIN, Decimal('0.25')),
    (PieceType.COIN, Decimal('0.10')),
    (PieceType.COIN, Decimal('0.05')),
    (PieceType.COIN, Decimal('0.01')),
]


class CashRegister(TenantOwnedModel):
    """Punto de venta físico dentro de una sucursal: "Caja 1", "Caja 2"."""
    branch = models.ForeignKey(
        'branches.Branch', on_delete=models.CASCADE, related_name='cash_registers')
    name = models.CharField(max_length=60)
    is_active = models.BooleanField(default=True)

    class Meta:
        unique_together = [('branch', 'name')]
        ordering = ['branch__name', 'name']

    def __str__(self) -> str:
        return f'{self.name} · {self.branch.name}'


class CashSession(TenantOwnedModel):
    """Turno de caja: de la apertura al cierre."""

    class Status(models.TextChoices):
        OPEN = 'OPEN', 'Abierta'
        CLOSED = 'CLOSED', 'Cerrada'

    code = models.CharField(max_length=24, blank=True, default='', db_index=True)
    branch = models.ForeignKey(
        'branches.Branch', on_delete=models.PROTECT, related_name='cash_sessions')
    register = models.ForeignKey(
        CashRegister, on_delete=models.PROTECT, null=True, blank=True,
        related_name='sessions')
    status = models.CharField(max_length=8, choices=Status.choices,
                              default=Status.OPEN, db_index=True)

    opened_by = models.ForeignKey(
        'accounts.User', on_delete=models.PROTECT, related_name='opened_cash_sessions')
    opened_at = models.DateTimeField(default=timezone.now)
    opening_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    opening_note = models.CharField(max_length=300, blank=True, default='')

    closed_by = models.ForeignKey(
        'accounts.User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='closed_cash_sessions')
    closed_at = models.DateTimeField(null=True, blank=True)
    closing_note = models.CharField(max_length=300, blank=True, default='')

    # ─── Foto de los totales al cerrar ───
    # Se congelan en el cierre para que el historial siga siendo fiel aunque
    # después se anule una venta o se edite un gasto.
    sales_count = models.PositiveIntegerField(default=0)
    sales_total = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    cash_sales = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    card_sales = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    transfer_sales = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    other_sales = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    change_in = models.DecimalField(
        max_digits=12, decimal_places=2, default=0,
        help_text='Diferencias de cambios que el cliente pagó (entra efectivo).')
    change_out = models.DecimalField(
        max_digits=12, decimal_places=2, default=0,
        help_text='Diferencias de cambios devueltas al cliente (sale efectivo).')
    expenses_cash = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    cash_in = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    cash_out = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    expected_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    counted_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    difference = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    class Meta:
        ordering = ['-opened_at']
        indexes = [
            models.Index(fields=['tenant', 'status']),
            models.Index(fields=['tenant', 'branch', 'status']),
        ]
        constraints = [
            # Una sola caja abierta por punto de venta.
            models.UniqueConstraint(
                fields=['register'], condition=models.Q(status='OPEN'),
                name='unique_open_session_per_register'),
        ]

    def __str__(self) -> str:
        return self.code or f'Caja #{self.pk}'

    @property
    def is_open(self) -> bool:
        return self.status == self.Status.OPEN


class CashCountLine(TenantOwnedModel):
    """Una denominación contada en la apertura o en el cierre de un turno."""
    session = models.ForeignKey(
        CashSession, on_delete=models.CASCADE, related_name='count_lines')
    stage = models.CharField(max_length=8, choices=CountStage.choices)
    piece = models.CharField(max_length=4, choices=PieceType.choices,
                             default=PieceType.BILL)
    denomination = models.DecimalField(max_digits=8, decimal_places=2)
    quantity = models.PositiveIntegerField(default=0)

    class Meta:
        unique_together = [('session', 'stage', 'piece', 'denomination')]
        ordering = ['stage', 'piece', '-denomination']

    @property
    def subtotal(self) -> Decimal:
        return (self.denomination * self.quantity).quantize(Decimal('0.01'))


class CashMovement(TenantOwnedModel):
    """Entrada o salida de efectivo del cajón que no es una venta: retiro a
    bóveda, ingreso de sencillo, adelanto, etc."""

    class Type(models.TextChoices):
        IN = 'IN', 'Ingreso'
        OUT = 'OUT', 'Retiro'

    session = models.ForeignKey(
        CashSession, on_delete=models.CASCADE, related_name='movements')
    type = models.CharField(max_length=4, choices=Type.choices)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    reason = models.CharField(max_length=200, blank=True, default='')
    created_by = models.ForeignKey(
        'accounts.User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='cash_movements')

    class Meta:
        ordering = ['-created_at']

    def __str__(self) -> str:
        return f'{self.get_type_display()} ${self.amount}'
