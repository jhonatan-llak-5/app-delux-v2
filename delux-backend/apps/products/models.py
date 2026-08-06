from django.db import models
from common.models import TenantOwnedModel, TimestampedModel


class ProductStatus(models.TextChoices):
    DRAFT     = 'DRAFT',     'Borrador'
    PUBLISHED = 'PUBLISHED', 'Publicado'
    PAUSED    = 'PAUSED',    'Pausado'
    ARCHIVED  = 'ARCHIVED',  'Archivado'


class ProductTag(models.TextChoices):
    NEW       = 'NEW',       'Nuevo'
    DROP      = 'DROP',      'Drop'
    SALE      = 'SALE',      'Oferta'
    EXCLUSIVE = 'EXCLUSIVE', 'Exclusivo'


class ProductKind(models.TextChoices):
    CALZADO   = 'CALZADO',   'Calzado'
    ROPA      = 'ROPA',      'Ropa'
    GORRA     = 'GORRA',     'Gorras'
    MOCHILA   = 'MOCHILA',   'Mochilas'
    BISUTERIA = 'BISUTERIA', 'Bisutería'
    ACCESORIO = 'ACCESORIO', 'Accesorios'
    OTRO      = 'OTRO',      'Otro'


class Product(TenantOwnedModel):
    name = models.CharField(max_length=160)
    slug = models.SlugField(max_length=180)
    short_description = models.CharField(max_length=240, blank=True)
    description = models.TextField(blank=True)

    brand = models.ForeignKey(
        'brands.Brand', on_delete=models.PROTECT, related_name='products'
    )
    category = models.ForeignKey(
        'categories.Category', on_delete=models.PROTECT, related_name='products'
    )

    base_price = models.DecimalField(max_digits=10, decimal_places=2)
    compare_at_price = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True
    )
    tax_rate = models.DecimalField(
        max_digits=5, decimal_places=2, null=True, blank=True,
        help_text='IVA %% de este producto. Vacio = usa el IVA global de Configuracion.')

    gender = models.CharField(
        max_length=10,
        choices=[('UNISEX', 'Unisex'), ('MEN', 'Hombre'), ('WOMEN', 'Mujer'), ('KIDS', 'Niños')],
        default='UNISEX',
    )

    kind = models.CharField(
        max_length=15, choices=ProductKind.choices, default=ProductKind.OTRO,
        help_text='Tipo de producto: define las tallas/medidas en la carga.'
    )

    status = models.CharField(max_length=15, choices=ProductStatus.choices,
                              default=ProductStatus.DRAFT)
    tag = models.CharField(max_length=15, choices=ProductTag.choices, blank=True)

    main_image_url = models.URLField(blank=True)

    meta_title = models.CharField(max_length=160, blank=True)
    meta_description = models.CharField(max_length=240, blank=True)

    is_featured = models.BooleanField(default=False)

    # Visibilidad en el sitio web público. True = aparece en la tienda en línea
    # (catálogo, buscador, chatbot, PDF). False = "vender solo en tienda física":
    # se oculta de la web pero SIGUE disponible en POS y en el kiosko. Es
    # independiente del `status` (un producto Publicado puede estar oculto de la web).
    online_visible = models.BooleanField(
        default=True, db_index=True,
        help_text='Si está desactivado, el producto no aparece en el sitio web '
                  'pero sigue vendiéndose en tienda física (POS) y kiosko.')

    # Dimensiones de variante personalizadas (estilo Treinta). Lista de
    # {"name": "Talla", "values": ["38","39","40"]}. Vacío = producto simple o
    # con las dimensiones clásicas talla/color.
    variant_options = models.JSONField(default=list, blank=True)

    # Oferta GLOBAL del producto: % de descuento que se aplica al precio de
    # CADA variante (POS, tienda, kiosko). 0 = sin oferta.
    discount_percent = models.DecimalField(max_digits=5, decimal_places=2, default=0)

    @property
    def on_offer(self) -> bool:
        return bool(self.discount_percent and self.discount_percent > 0)

    def offer_price(self, base):
        """Precio final tras aplicar el descuento de la oferta a un precio base."""
        from decimal import Decimal
        d = self.discount_percent or 0
        b = Decimal(str(base or 0))
        if d and d > 0:
            return (b * (Decimal('1') - Decimal(str(d)) / Decimal('100'))).quantize(Decimal('0.01'))
        return b.quantize(Decimal('0.01'))

    # Borrado lógico: si tiene fecha, el producto está "eliminado" (oculto en
    # todos lados) pero su registro se conserva para no perder el historial de
    # ventas asociado. None = activo.
    deleted_at = models.DateTimeField(null=True, blank=True, db_index=True)

    def effective_tax_rate(self):
        """IVA % de este producto: el propio, o el global si esta vacio."""
        from decimal import Decimal
        if self.tax_rate is not None:
            return Decimal(str(self.tax_rate))
        from apps.settings.models import PlatformSettings
        return Decimal(str(PlatformSettings.load().tax_rate or 0))

    class Meta:
        unique_together = [('tenant', 'slug')]
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['tenant', 'status']),
            models.Index(fields=['brand', 'category']),
        ]

    def __str__(self) -> str:
        return self.name


class ProductImage(TimestampedModel):
    """Imagen de galería para un producto."""
    product = models.ForeignKey(
        Product, on_delete=models.CASCADE, related_name='images'
    )
    url = models.URLField()
    thumb_url = models.URLField(blank=True)
    alt = models.CharField(max_length=160, blank=True)
    sort_order = models.PositiveSmallIntegerField(default=0)
    is_main = models.BooleanField(default=False)

    class Meta:
        ordering = ['sort_order', 'id']

    def __str__(self) -> str:
        return f'Image #{self.id} for {self.product.name}'
