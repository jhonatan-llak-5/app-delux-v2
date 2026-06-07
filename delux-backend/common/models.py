"""
Mixins de modelo comunes.
TenantOwnedModel  -> todo modelo de dominio incluye tenant_id.
TimestampedModel  -> created_at / updated_at.
"""
from django.db import models


class TimestampedModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class TenantOwnedModel(TimestampedModel):
    """Cada submodelo obtiene reverse accessor tenant.<modelname>_set
    (ej. tenant.branch_set, tenant.product_set)."""
    tenant = models.ForeignKey(
        'tenants.Tenant',
        on_delete=models.PROTECT,
        related_name='%(class)s_set',
        related_query_name='%(class)s',
    )

    class Meta:
        abstract = True
