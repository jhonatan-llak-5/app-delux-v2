from django.db import models
from common.models import TenantOwnedModel


class Cart(TenantOwnedModel):
    customer = models.ForeignKey(
        'customers.Customer', on_delete=models.CASCADE,
        related_name='carts', null=True, blank=True
    )
    session_key = models.CharField(max_length=80, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        indexes = [models.Index(fields=['tenant', 'session_key', 'is_active'])]


class CartItem(TenantOwnedModel):
    cart = models.ForeignKey(Cart, on_delete=models.CASCADE, related_name='items')
    variant = models.ForeignKey('variants.Variant', on_delete=models.PROTECT)
    quantity = models.PositiveIntegerField(default=1)
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
