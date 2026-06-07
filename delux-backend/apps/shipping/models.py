from django.db import models
from common.models import TenantOwnedModel


class ShipmentStatus(models.TextChoices):
    CREATED    = 'CREATED',    'Creado'
    PREPARING  = 'PREPARING',  'Preparando'
    SHIPPED    = 'SHIPPED',    'Enviado'
    IN_TRANSIT = 'IN_TRANSIT', 'En tránsito'
    DELIVERED  = 'DELIVERED',  'Entregado'
    FAILED     = 'FAILED',     'Fallido'
    RETURNED   = 'RETURNED',   'Devuelto'


class Carrier(models.TextChoices):
    SERVIENTREGA   = 'SERVIENTREGA',   'Servientrega'
    LAARCOURIER    = 'LAARCOURIER',    'Laar Courier'
    URBANOEXPRESS  = 'URBANOEXPRESS',  'Urbano Express'
    INHOUSE        = 'INHOUSE',        'Mensajería propia'
    PICKUP         = 'PICKUP',         'Retiro en tienda'


class Shipment(TenantOwnedModel):
    order = models.OneToOneField(
        'orders.Order', on_delete=models.PROTECT, related_name='shipment'
    )
    tracking_code = models.CharField(max_length=40, unique=True)
    carrier = models.CharField(max_length=20, choices=Carrier.choices,
                               default=Carrier.SERVIENTREGA)
    status = models.CharField(max_length=15, choices=ShipmentStatus.choices,
                              default=ShipmentStatus.CREATED)
    estimated_delivery = models.DateField(null=True, blank=True)
    shipping_cost = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    # Destino
    recipient_name = models.CharField(max_length=160)
    recipient_phone = models.CharField(max_length=30, blank=True)
    address_line1 = models.CharField(max_length=200)
    address_line2 = models.CharField(max_length=200, blank=True)
    city = models.CharField(max_length=80)
    region = models.CharField(max_length=80, blank=True)
    country = models.CharField(max_length=80, default='Ecuador')

    notes = models.TextField(blank=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.tracking_code} - {self.get_status_display()}'


class ShipmentEvent(TenantOwnedModel):
    """Timeline de eventos del envío."""
    shipment = models.ForeignKey(
        Shipment, on_delete=models.CASCADE, related_name='events'
    )
    status = models.CharField(max_length=15, choices=ShipmentStatus.choices)
    description = models.CharField(max_length=240)
    location = models.CharField(max_length=120, blank=True)
    actor = models.ForeignKey(
        'accounts.User', on_delete=models.SET_NULL, null=True, blank=True
    )

    class Meta:
        ordering = ['-created_at']
