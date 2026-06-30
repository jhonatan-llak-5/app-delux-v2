import secrets

from django.db import models
from common.models import TenantOwnedModel


class Branch(TenantOwnedModel):
    """Sucursal física del tenant (ej: Delux Norte, Delux Cuenca)."""
    code = models.CharField(max_length=10)
    name = models.CharField(max_length=80)
    city = models.CharField(max_length=80)
    address = models.CharField(max_length=200)
    latitude = models.DecimalField(max_digits=12, decimal_places=8, null=True, blank=True)
    longitude = models.DecimalField(max_digits=12, decimal_places=8, null=True, blank=True)
    phone = models.CharField(max_length=30, blank=True)
    email = models.EmailField(blank=True)
    opening_hours = models.CharField(max_length=120, blank=True)

    manager = models.ForeignKey(
        'accounts.User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='managed_branches'
    )
    allows_pickup = models.BooleanField(default=True)
    is_active = models.BooleanField(default=True)

    # Kiosko de consulta: token único en la URL + PIN opcional de acceso.
    kiosk_token = models.CharField(max_length=32, blank=True, db_index=True)
    kiosk_pin = models.CharField(max_length=8, blank=True)

    class Meta:
        unique_together = [('tenant', 'code')]
        ordering = ['name']

    def save(self, *args, **kwargs):
        if not self.kiosk_token:
            self.kiosk_token = secrets.token_urlsafe(12)[:24]
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return f'{self.name} ({self.city})'


class BranchSchedule(TenantOwnedModel):
    """Horario de atencion por dia de la semana."""
    WEEKDAY_CHOICES = [
        (0, 'Lunes'), (1, 'Martes'), (2, 'Miercoles'),
        (3, 'Jueves'), (4, 'Viernes'), (5, 'Sabado'), (6, 'Domingo'),
    ]
    branch = models.ForeignKey(
        Branch, on_delete=models.CASCADE, related_name='schedules'
    )
    weekday = models.PositiveSmallIntegerField(choices=WEEKDAY_CHOICES)
    open_time = models.TimeField(null=True, blank=True)
    close_time = models.TimeField(null=True, blank=True)
    is_closed = models.BooleanField(default=False)

    class Meta:
        unique_together = [('branch', 'weekday')]
        ordering = ['branch', 'weekday']

    def __str__(self) -> str:
        return f'{self.branch.name} - {self.get_weekday_display()}'
