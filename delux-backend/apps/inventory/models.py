from django.db import models
from common.models import TenantOwnedModel


class Stock(TenantOwnedModel):
    """Stock por variante por sucursal — corazón del multi-sucursal."""
    variant = models.ForeignKey(
        'variants.Variant', on_delete=models.CASCADE, related_name='stocks'
    )
    branch = models.ForeignKey(
        'branches.Branch', on_delete=models.CASCADE, related_name='stocks'
    )
    quantity = models.IntegerField(default=0)
    reserved = models.IntegerField(default=0)
    min_threshold = models.PositiveIntegerField(default=2)

    class Meta:
        unique_together = [('variant', 'branch')]
        indexes = [models.Index(fields=['branch', 'variant'])]

    @property
    def available(self) -> int:
        return max(self.quantity - self.reserved, 0)


class StockMovement(TenantOwnedModel):
    TYPE_IN = 'IN'
    TYPE_OUT = 'OUT'
    TYPE_ADJ = 'ADJ'
    TYPE_TRANSFER_IN = 'XFER_IN'
    TYPE_TRANSFER_OUT = 'XFER_OUT'
    TYPE_RESERVE = 'RESERVE'
    TYPE_RELEASE = 'RELEASE'

    TYPES = [
        (TYPE_IN, 'Entrada'),
        (TYPE_OUT, 'Salida'),
        (TYPE_ADJ, 'Ajuste'),
        (TYPE_TRANSFER_IN, 'Transferencia entrada'),
        (TYPE_TRANSFER_OUT, 'Transferencia salida'),
        (TYPE_RESERVE, 'Reserva'),
        (TYPE_RELEASE, 'Liberación'),
    ]

    stock = models.ForeignKey(Stock, on_delete=models.CASCADE, related_name='movements')
    type = models.CharField(max_length=10, choices=TYPES)
    quantity = models.IntegerField()
    note = models.CharField(max_length=240, blank=True)
    actor = models.ForeignKey(
        'accounts.User', on_delete=models.SET_NULL, null=True, blank=True
    )


class Supplier(TenantOwnedModel):
    """Proveedor de mercadería (para recepciones de inventario)."""
    name = models.CharField(max_length=160)
    contact_name = models.CharField(max_length=120, blank=True)
    phone = models.CharField(max_length=40, blank=True)
    email = models.EmailField(blank=True)
    tax_id = models.CharField(max_length=40, blank=True)  # RUC / ID
    notes = models.CharField(max_length=400, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['name']

    def __str__(self) -> str:
        return self.name


class Reception(TenantOwnedModel):
    """Recepción de mercadería: el 'me llegó el contenedor'. Agrupa el ingreso
    de stock por proveedor, sucursal destino y fecha (lote)."""
    STATUS_DRAFT = 'DRAFT'
    STATUS_COMMITTED = 'COMMITTED'
    STATUS = [(STATUS_DRAFT, 'Borrador'), (STATUS_COMMITTED, 'Confirmada')]

    code = models.CharField(max_length=30, blank=True)
    supplier = models.ForeignKey(
        Supplier, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='receptions'
    )
    branch = models.ForeignKey(
        'branches.Branch', on_delete=models.PROTECT, related_name='receptions'
    )
    status = models.CharField(max_length=12, choices=STATUS, default=STATUS_DRAFT)
    note = models.CharField(max_length=300, blank=True)
    created_by = models.ForeignKey(
        'accounts.User', on_delete=models.SET_NULL, null=True, blank=True
    )
    committed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self) -> str:
        return self.code or f'Recepcion #{self.pk}'


class ReceptionItem(TenantOwnedModel):
    """Línea de una recepción: una variante con cantidad y costo unitario."""
    reception = models.ForeignKey(
        Reception, on_delete=models.CASCADE, related_name='items'
    )
    variant = models.ForeignKey(
        'variants.Variant', on_delete=models.CASCADE, related_name='reception_items'
    )
    branch = models.ForeignKey(
        'branches.Branch', on_delete=models.PROTECT, null=True, blank=True,
        related_name='reception_items'
    )
    quantity = models.PositiveIntegerField(default=0)
    unit_cost = models.DecimalField(max_digits=10, decimal_places=2, default=0)
