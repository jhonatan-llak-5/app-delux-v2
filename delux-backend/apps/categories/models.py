from django.db import models
from common.models import TenantOwnedModel


class Category(TenantOwnedModel):
    """Categoría jerárquica del catálogo (Zapatillas → Running)."""
    name = models.CharField(max_length=80)
    slug = models.SlugField(max_length=80)
    parent = models.ForeignKey(
        'self', on_delete=models.CASCADE, null=True, blank=True,
        related_name='children'
    )
    icon = models.CharField(max_length=40, blank=True)
    sort_order = models.PositiveSmallIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        unique_together = [('tenant', 'slug')]
        ordering = ['sort_order', 'name']

    def __str__(self) -> str:
        return self.name
