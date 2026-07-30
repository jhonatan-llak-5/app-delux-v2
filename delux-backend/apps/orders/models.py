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

    affiliate = models.ForeignKey(
        'accounts.User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='affiliate_orders',
        help_text='Vendedor afiliado atribuido a este pedido.')
    affiliate_ref = models.CharField(max_length=20, blank=True)
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
    # Motivo al cancelar/anular la venta (Devolución, Defectuoso, Error, ...).
    cancel_reason = models.CharField(max_length=200, blank=True, default='')

    # ─── Factura electrónica (emitida en NovaFactura) ───
    class InvoiceStatus(models.TextChoices):
        NOT_ISSUED = 'NOT_ISSUED', 'No emitida'
        PROCESSING = 'PROCESSING', 'Procesando'
        AUTHORIZED = 'AUTHORIZED', 'Autorizada'
        REJECTED = 'REJECTED', 'Rechazada'
        ERROR = 'ERROR', 'Error'

    invoice_status = models.CharField(
        max_length=12, choices=InvoiceStatus.choices,
        default=InvoiceStatus.NOT_ISSUED, db_index=True)
    invoice_id = models.CharField(max_length=64, blank=True, default='',
                                  help_text='ID de la factura en NovaFactura.')
    invoice_access_key = models.CharField(max_length=64, blank=True, default='',
                                          help_text='Clave de acceso del SRI.')
    invoice_number = models.CharField(max_length=40, blank=True, default='')
    invoice_pdf_url = models.URLField(blank=True, default='')
    invoice_xml_url = models.URLField(blank=True, default='')
    invoice_error = models.CharField(max_length=400, blank=True, default='')
    invoice_updated_at = models.DateTimeField(null=True, blank=True)

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
    branch = models.ForeignKey(
        'branches.Branch', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='order_items',
        help_text='Sucursal desde la que se reserva/despacha este ítem.',
    )
    product_name = models.CharField(max_length=200)
    sku = models.CharField(max_length=40)
    size = models.CharField(max_length=20, blank=True)
    color = models.CharField(max_length=40, blank=True)
    quantity = models.PositiveIntegerField(default=1)
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    subtotal = models.DecimalField(max_digits=10, decimal_places=2)
