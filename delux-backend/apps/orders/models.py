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
    # Suma de los valores devueltos por CAMBIOS (return-to-stock parcial ligado
    # a la venta). La venta NO se anula: solo baja su total NETO (total -
    # total_changes) para las estadísticas.
    total_changes = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    # ─── Forma de pago (SRI tabla 24) ───
    payment_form = models.CharField(max_length=2, default='01')      # código SRI forma de pago
    payment_plazo = models.PositiveIntegerField(default=0)           # >0 = a crédito
    payment_unidad = models.CharField(max_length=8, default='dias')  # 'dias' | 'meses'

    coupon_code = models.CharField(max_length=40, blank=True)
    # Agrupa los sub-pedidos de una misma compra web multi-sucursal (un pedido
    # por sucursal). Vacío en compras normales de una sola sucursal.
    group_code = models.CharField(max_length=40, blank=True, default='', db_index=True)
    notes = models.TextField(blank=True)
    # Motivo al cancelar/anular la venta (Devolución, Defectuoso, Error, ...).
    cancel_reason = models.CharField(max_length=200, blank=True, default='')

    # ─── Factura electrónica (emitida en NovaFactura) ───
    class InvoiceStatus(models.TextChoices):
        NOT_ISSUED = 'NOT_ISSUED', 'No emitida'
        PROCESSING = 'PROCESSING', 'Procesando'
        # El SRI falló por un error temporal (de sistema, no nuestro). NovaFactura
        # reintenta solo; no requiere acción del usuario. No es "procesando" normal.
        PENDING_SRI = 'PENDING_SRI', 'En espera del SRI'
        AUTHORIZED = 'AUTHORIZED', 'Autorizada'
        REJECTED = 'REJECTED', 'Rechazada'
        ANNULLED = 'ANNULLED', 'Anulada'
        ERROR = 'ERROR', 'Error'

    invoice_status = models.CharField(
        max_length=12, choices=InvoiceStatus.choices,
        default=InvoiceStatus.NOT_ISSUED, db_index=True)
    invoice_id = models.CharField(max_length=64, blank=True, default='',
                                  help_text='ID de la factura en NovaFactura.')
    invoice_access_key = models.CharField(max_length=64, blank=True, default='',
                                          help_text='Clave de acceso del SRI.')
    invoice_authorization = models.CharField(max_length=64, blank=True, default='',
                                             help_text='Nro de autorización del SRI.')
    invoice_number = models.CharField(max_length=40, blank=True, default='')
    invoice_pdf_url = models.URLField(blank=True, default='')
    invoice_xml_url = models.URLField(blank=True, default='')
    # Motivo/mensaje real del SRI para CUALQUIER estado (autorizada, rechazada,
    # error temporal). Antes solo se guardaba el error de rechazo en invoice_error.
    invoice_message = models.CharField(max_length=500, blank=True, default='')
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

    @property
    def net_total(self):
        """Total neto de la venta descontando los cambios devueltos al stock."""
        return (self.total or 0) - (self.total_changes or 0)


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
