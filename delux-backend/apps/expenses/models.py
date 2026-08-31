from django.db import models
from django.utils import timezone
from common.models import TenantOwnedModel


class ExpenseCategory(models.TextChoices):
    MOTORIZADO   = 'MOTORIZADO',   'Motorizado / entregas'
    PUBLICIDAD   = 'PUBLICIDAD',   'Publicidad y marketing'
    ONLINE       = 'ONLINE',       'Gastos en linea'
    ALIMENTACION = 'ALIMENTACION', 'Alimentacion'
    SERVICIOS    = 'SERVICIOS',    'Servicios'
    INSUMOS      = 'INSUMOS',      'Insumos / limpieza'
    NOMINA       = 'NOMINA',       'Nomina'
    OTROS        = 'OTROS',        'Otros'


class ExpensePaymentMethod(models.TextChoices):
    CASH     = 'CASH',     'Efectivo'
    TRANSFER = 'TRANSFER', 'Transferencia'
    CARD     = 'CARD',     'Tarjeta'


class Expense(TenantOwnedModel):
    """Gasto del negocio (contabilidad basica). Lo que antes se anotaba en la
    agenda: motorizado, publicidad, alimentacion, servicios, etc."""
    date = models.DateField(default=timezone.localdate)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    category = models.CharField(
        max_length=16, choices=ExpenseCategory.choices,
        default=ExpenseCategory.OTROS)
    payment_method = models.CharField(
        max_length=12, choices=ExpensePaymentMethod.choices,
        default=ExpensePaymentMethod.CASH)
    supplier = models.ForeignKey(
        'inventory.Supplier', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='expenses')
    description = models.CharField(max_length=200, blank=True)
    branch = models.ForeignKey(
        'branches.Branch', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='expenses')
    receipt_url = models.URLField(blank=True)
    # Turno de caja del que salió el dinero (solo gastos en efectivo hechos con
    # la caja abierta). Se usa para cuadrar el cierre.
    cash_session = models.ForeignKey(
        'cashbox.CashSession', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='expenses')
    created_by = models.ForeignKey(
        'accounts.User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='created_expenses')

    class Meta:
        ordering = ['-date', '-created_at']
        indexes = [
            models.Index(fields=['tenant', 'date']),
            models.Index(fields=['tenant', 'category']),
        ]

    def __str__(self) -> str:
        return f'{self.get_category_display()} ${self.amount} ({self.date})'
