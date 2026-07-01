from django.db import models
from common.models import TenantOwnedModel


class PayrollStatus(models.TextChoices):
    PENDING = 'PENDING', 'Pendiente'
    PARTIAL = 'PARTIAL', 'Parcial'
    PAID    = 'PAID',    'Pagada'


class PayItemStatus(models.TextChoices):
    PENDING = 'PENDING', 'Pendiente'
    PAID    = 'PAID',    'Pagado'


class PayMethod(models.TextChoices):
    CASH     = 'CASH',     'Efectivo'
    TRANSFER = 'TRANSFER', 'Transferencia'


class PayrollRun(TenantOwnedModel):
    """Nomina de un mes (opcionalmente por sucursal)."""
    year = models.PositiveIntegerField()
    month = models.PositiveSmallIntegerField()  # 1-12
    branch = models.ForeignKey(
        'branches.Branch', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='payroll_runs')
    status = models.CharField(max_length=10, choices=PayrollStatus.choices,
                              default=PayrollStatus.PENDING)
    total_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    generated_by = models.ForeignKey(
        'accounts.User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='generated_payrolls')

    class Meta:
        ordering = ['-year', '-month', '-created_at']
        indexes = [models.Index(fields=['tenant', 'year', 'month'])]

    def __str__(self):
        return f'Nomina {self.month:02d}/{self.year}'


class PayrollItem(TenantOwnedModel):
    """Pago de un empleado dentro de una nomina."""
    run = models.ForeignKey(PayrollRun, on_delete=models.CASCADE, related_name='items')
    employee = models.ForeignKey(
        'accounts.User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='payroll_items')
    employee_name = models.CharField(max_length=160, blank=True)
    role = models.CharField(max_length=20, blank=True)
    base_salary = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    adjustment = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    status = models.CharField(max_length=10, choices=PayItemStatus.choices,
                              default=PayItemStatus.PENDING)
    method = models.CharField(max_length=10, choices=PayMethod.choices, blank=True)
    paid_at = models.DateTimeField(null=True, blank=True)
    notes = models.CharField(max_length=200, blank=True)

    class Meta:
        ordering = ['employee_name']

    def __str__(self):
        return f'{self.employee_name} — {self.amount}'
