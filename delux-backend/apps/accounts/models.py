from django.contrib.auth.models import AbstractUser
from django.db import models


class Role(models.TextChoices):
    SUPERADMIN     = 'SUPERADMIN',     'Superadmin'
    TENANT_ADMIN   = 'TENANT_ADMIN',   'Admin Tenant'
    BRANCH_MANAGER = 'BRANCH_MANAGER', 'Gerente Sucursal'
    SALESPERSON    = 'SALESPERSON',    'Vendedor'
    CUSTOMER       = 'CUSTOMER',       'Cliente'
    AFFILIATE      = 'AFFILIATE',      'Vendedor Afiliado'


class User(AbstractUser):
    email = models.EmailField(unique=True)
    full_name = models.CharField(max_length=160, blank=True)
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.CUSTOMER)

    tenant = models.ForeignKey(
        'tenants.Tenant', on_delete=models.PROTECT, null=True, blank=True,
        related_name='users'
    )
    branch = models.ForeignKey(
        'branches.Branch', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='staff'
    )

    is_email_verified = models.BooleanField(default=False)
    activation_code = models.CharField(max_length=10, blank=True)
    activation_expires_at = models.DateTimeField(null=True, blank=True)

    # Staff fields (Sprint 9)
    phone = models.CharField(max_length=30, blank=True)
    document_id = models.CharField(max_length=30, blank=True)
    commission_rate = models.DecimalField(
        max_digits=5, decimal_places=2, default=0,
        help_text='Porcentaje de comision (0-100)'
    )
    monthly_salary = models.DecimalField(
        max_digits=10, decimal_places=2, default=0,
        help_text='Sueldo mensual fijo del empleado'
    )
    hire_date = models.DateField(null=True, blank=True)

    # Afiliado (programa de referidos)
    ref_code = models.CharField(max_length=20, blank=True, db_index=True,
                                help_text='Codigo unico de afiliado (ej. VEND0001)')

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username']

    def __str__(self) -> str:
        return self.email
