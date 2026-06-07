from django.db import models
from common.models import TenantOwnedModel


class OrderStatus(models.TextChoices):
    PENDING   = 'PENDING',   'Pendiente de pago'
    PAID      = 'PAID',      'Pagado'
    PREPARING = 'PREPARING', 'Preparando'
    READY     = 'READY',     'Listo para retirar'
    SHIPPED   = 'SHIPPED',   'Enviado'
    DELIVERED = 'DELIVERED', 'Entregado'
    CANCELLED = 'CANCELLED', 'Cancelado'
    REFUNDED  = 'REFUNDED',  'Devuelto'


class OrderChannel(models.TextChoices):
    WEB = 'WEB', 'Web'
    POS = 'POS', 'POS'


class FulfillmentType(models.TextChoices):
    SHIPPING = 'SHIPPING', 'Envío'
    PICKUP   = 'PICKUP',   'Retiro en tienda'


class Order(TenantOwnedModel):
    code = models.CharField(max_length=20)
    customer = models.ForeignKey(
        'customers.Customer', on_delete=models.PROTECT, related_name='orders',
        null=True, blank=True,
    )
    branch = models.ForeignKey(
        'branches.Branch', on_delete=models.PROTECT, related_name='orders'
    )
    seller = models.ForeignKey(
        'accounts.User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='sold_orders'
    )

    channel = models.CharField(max_length=4, choices=OrderChannel.choices)
    fulfillment = models.CharField(max_length=10, choices=FulfillmentType.choices)
    status = models.CharField(max_length=12, choices=OrderStatus.choices,
                              default=OrderStatus.PENDING)

    subtotal = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    discount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    shipping_fee = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    tax = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    total = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    coupon_code = models.CharField(max_length=40, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        unique_together = [('tenant', 'code')]
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['tenant', 'status']),
            models.Index(fields=['tenant', 'branch']),
            models.Index(fields=['tenant', 'channel']),
        ]


class OrderItem(TenantOwnedModel):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='items')
    variant = models.ForeignKey('variants.Variant', on_delete=models.PROTECT)
    product_name = models.CharField(max_length=200)
    sku = models.CharField(max_length=40)
    size = models.CharField(max_length=20, blank=True)
    color = models.CharField(max_length=40, blank=True)
    quantity = models.PositiveIntegerField(default=1)
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    subtotal = models.DecimalField(max_digits=10, decimal_places=2)
