from django.db import models
from common.models import TimestampedModel


class Tenant(TimestampedModel):
    """Empresa que opera sobre la plataforma (multi-tenant)."""
    name = models.CharField(max_length=120)
    slug = models.SlugField(max_length=60, unique=True)
    legal_id = models.CharField(max_length=30, blank=True)

    primary_color = models.CharField(max_length=9, default='#22D3EE')
    accent_color  = models.CharField(max_length=9, default='#7C3AED')
    logo_url = models.URLField(blank=True)

    is_active = models.BooleanField(default=True)

    def __str__(self) -> str:
        return self.name
