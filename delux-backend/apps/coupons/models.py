from django.db import models
from common.models import TenantOwnedModel


class Coupon(TenantOwnedModel):
    TYPE_PERCENT = 'PERCENT'
    TYPE_FIXED = 'FIXED'
    TYPES = [
        (TYPE_PERCENT, 'Porcentaje'),
        (TYPE_FIXED, 'Monto fijo'),
    ]

    code = models.CharField(max_length=40)
    type = models.CharField(max_length=10, choices=TYPES)
    value = models.DecimalField(max_digits=10, decimal_places=2)
    min_purchase = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    usage_limit = models.PositiveIntegerField(null=True, blank=True)
    times_used = models.PositiveIntegerField(default=0)
    starts_at = models.DateTimeField(null=True, blank=True)
    ends_at = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        unique_together = [('tenant', 'code')]
