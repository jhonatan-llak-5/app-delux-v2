from django.db import models
from common.models import TenantOwnedModel


class Variant(TenantOwnedModel):
    """Variante vendible de un producto: SKU único por (producto, talla, color)."""
    product = models.ForeignKey(
        'products.Product', on_delete=models.CASCADE, related_name='variants'
    )
    sku = models.CharField(max_length=40)
    size = models.CharField(max_length=20, blank=True)      # 41, M, L, 9.5 US, etc.
    color = models.CharField(max_length=40, blank=True)
    material = models.CharField(max_length=80, blank=True)

    price_override = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True
    )
    barcode = models.CharField(max_length=40, blank=True)
    weight_grams = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        unique_together = [('tenant', 'sku')]
        indexes = [models.Index(fields=['product', 'size', 'color'])]

    def __str__(self) -> str:
        return f'{self.sku} · {self.product.name}'
