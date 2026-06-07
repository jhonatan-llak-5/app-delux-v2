"""Endpoints públicos para búsqueda y listado del shop."""
from django.db.models import Q, Min, Max
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.brands.models import Brand
from apps.categories.models import Category
from .models import Product, ProductStatus


def filter_products(request):
    qs = Product.objects.filter(status=ProductStatus.PUBLISHED).select_related('brand', 'category')

    params = request.query_params
    q = params.get('q')
    if q:
        qs = qs.filter(Q(name__icontains=q) | Q(short_description__icontains=q) | Q(brand__name__icontains=q) | Q(category__name__icontains=q))

    brand_csv = params.get('brand')
    if brand_csv:
        ids = [int(x) for x in brand_csv.split(',') if x.isdigit()]
        if ids: qs = qs.filter(brand_id__in=ids)

    cat_csv = params.get('category')
    if cat_csv:
        slugs = [s for s in cat_csv.split(',') if s]
        if slugs: qs = qs.filter(category__slug__in=slugs)

    gender = params.get('gender')
    if gender: qs = qs.filter(gender=gender.upper())

    price_min = params.get('price_min')
    price_max = params.get('price_max')
    if price_min: qs = qs.filter(base_price__gte=price_min)
    if price_max: qs = qs.filter(base_price__lte=price_max)

    size = params.get('size')
    color = params.get('color')
    if size or color:
        vq = Q()
        if size: vq &= Q(variants__size__iexact=size)
        if color: vq &= Q(variants__color__iexact=color)
        qs = qs.filter(vq).distinct()

    sort = params.get('sort', 'new')
    if sort == 'price-asc': qs = qs.order_by('base_price')
    elif sort == 'price-desc': qs = qs.order_by('-base_price')
    elif sort == 'featured': qs = qs.order_by('-is_featured', '-created_at')
    else: qs = qs.order_by('-created_at')

    return qs


class PublicProductsView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        qs = filter_products(request)
        results = [{
            'id': p.id, 'name': p.name, 'slug': p.slug,
            'brand_id': p.brand_id, 'brand_name': p.brand.name,
            'category_id': p.category_id, 'category_name': p.category.name,
            'base_price': str(p.base_price),
            'compare_at_price': str(p.compare_at_price) if p.compare_at_price else None,
            'gender': p.gender, 'tag': p.tag,
            'main_image_url': p.main_image_url,
            'is_featured': p.is_featured,
        } for p in qs[:200]]
        return Response({'count': qs.count(), 'results': results})


class SearchAutocompleteView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        q = request.query_params.get('q', '').strip()
        if len(q) < 2:
            return Response({'products': [], 'brands': [], 'categories': []})
        products = Product.objects.filter(
            status=ProductStatus.PUBLISHED, name__icontains=q
        ).select_related('brand')[:6]
        brands = Brand.objects.filter(is_active=True, name__icontains=q)[:4]
        cats = Category.objects.filter(is_active=True, name__icontains=q)[:4]
        return Response({
            'products': [{'id': p.id, 'name': p.name, 'brand_name': p.brand.name,
                          'main_image_url': p.main_image_url,
                          'base_price': str(p.base_price)} for p in products],
            'brands': [{'id': b.id, 'name': b.name, 'slug': b.slug, 'logo_url': b.logo_url} for b in brands],
            'categories': [{'id': c.id, 'name': c.name, 'slug': c.slug, 'icon': c.icon} for c in cats],
        })


class ProductFacetsView(APIView):
    """Devuelve facets disponibles para filtros."""
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        qs = Product.objects.filter(status=ProductStatus.PUBLISHED)
        agg = qs.aggregate(min_price=Min('base_price'), max_price=Max('base_price'))
        brands = list(Brand.objects.filter(is_active=True, products__status=ProductStatus.PUBLISHED)
                      .values('id', 'name', 'slug').distinct())
        cats = list(Category.objects.filter(is_active=True)
                    .values('id', 'name', 'slug', 'parent_id'))
        return Response({
            'min_price': float(agg['min_price'] or 0),
            'max_price': float(agg['max_price'] or 500),
            'brands': brands,
            'categories': cats,
        })
