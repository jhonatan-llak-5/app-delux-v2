from django.db import models
from common.models import TenantOwnedModel


class Brand(TenantOwnedModel):
    """Marca comercializada por el tenant (Nike, Adidas, Puma, etc.)."""
    name = models.CharField(max_length=80)
    slug = models.SlugField(max_length=80)

    # Branding visual
    logo_url = models.URLField(blank=True)
    logo_dark_url = models.URLField(blank=True, help_text='Logo para fondos oscuros')

    # Info comercial
    description = models.TextField(blank=True)
    country_of_origin = models.CharField(max_length=80, blank=True)
    website = models.URLField(blank=True)
    founded_year = models.PositiveSmallIntegerField(null=True, blank=True)

    # Operación
    is_active = models.BooleanField(default=True)
    is_featured = models.BooleanField(default=False, help_text='Aparece en la home')
    sort_order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        unique_together = [('tenant', 'slug')]
        ordering = ['sort_order', 'name']
        indexes = [
            models.Index(fields=['tenant', 'is_active']),
            models.Index(fields=['tenant', 'is_featured']),
        ]

    def __str__(self) -> str:
        return self.name
