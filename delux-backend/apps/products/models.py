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

    gender = models.CharField(
        max_length=10,
        choices=[('UNISEX', 'Unisex'), ('MEN', 'Hombre'), ('WOMEN', 'Mujer'), ('KIDS', 'Niños')],
        default='UNISEX',
    )

    status = models.CharField(max_length=15, choices=ProductStatus.choices,
                              default=ProductStatus.DRAFT)
    tag = models.CharField(max_length=15, choices=ProductTag.choices, blank=True)

    main_image_url = models.URLField(blank=True)

    meta_title = models.CharField(max_length=160, blank=True)
    meta_description = models.CharField(max_length=240, blank=True)

    is_featured = models.BooleanField(default=False)

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
