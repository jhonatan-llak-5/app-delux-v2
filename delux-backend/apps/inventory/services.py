"""Helpers para la recepción de mercadería (intake de inventario)."""
import re

from django.utils.text import slugify

from apps.variants.models import Variant


def resolve_tenant(user):
    from apps.tenants.models import Tenant
    return getattr(user, 'tenant', None) or Tenant.objects.filter(is_active=True).first()


def unique_slug(model, tenant, name):
    base = slugify(name) or 'item'
    slug, i = base, 2
    while model.objects.filter(tenant=tenant, slug=slug).exists():
        slug = f'{base}-{i}'
        i += 1
    return slug


def next_sku_number(tenant, prefix='P'):
    """Siguiente número para el código interno tipo P00000249 (por tenant)."""
    pat = re.compile(rf'^{re.escape(prefix)}(\d+)$')
    mx = 0
    for sku in Variant.objects.filter(tenant=tenant, sku__startswith=prefix).values_list('sku', flat=True):
        m = pat.match(sku or '')
        if m:
            mx = max(mx, int(m.group(1)))
    return mx + 1


def resolve_brand(tenant, raw):
    from apps.brands.models import Brand
    if raw.get('brand_id'):
        return Brand.objects.filter(pk=raw['brand_id'], tenant=tenant).first()
    name = (raw.get('brand_name') or '').strip()
    if not name:
        return None
    b = Brand.objects.filter(tenant=tenant, name__iexact=name).first()
    if b:
        return b
    return Brand.objects.create(tenant=tenant, name=name, slug=unique_slug(Brand, tenant, name))


def resolve_category(tenant, raw):
    from apps.categories.models import Category
    if raw.get('category_id'):
        return Category.objects.filter(pk=raw['category_id'], tenant=tenant).first()
    name = (raw.get('category_name') or '').strip()
    if not name:
        return None
    c = Category.objects.filter(tenant=tenant, name__iexact=name).first()
    if c:
        return c
    return Category.objects.create(tenant=tenant, name=name, slug=unique_slug(Category, tenant, name))
