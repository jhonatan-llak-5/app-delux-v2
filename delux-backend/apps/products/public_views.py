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

    # Filtro estricto solo por sucursal específica (uso admin).
    # La ciudad NO filtra: el catálogo público es híbrido (muestra todo y marca
    # la disponibilidad por ciudad en la vista).
    branch = params.get('branch')
    if branch:
        qs = qs.filter(
            variants__stocks__branch_id=branch,
            variants__stocks__quantity__gt=0,
        ).distinct()

    sort = params.get('sort', 'new')
    if sort == 'price-asc': qs = qs.order_by('base_price')
    elif sort == 'price-desc': qs = qs.order_by('-base_price')
    elif sort == 'featured': qs = qs.order_by('-is_featured', '-created_at')
    else: qs = qs.order_by('-created_at')

    return qs


class PublicProductsView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        from django.db.models import Sum
        from apps.inventory.models import Stock

        qs = filter_products(request)
        params = request.query_params
        branch_id = params.get('branch')
        city = params.get('city')

        products = list(qs[:200])
        pids = [p.id for p in products]

        # Miniatura principal por producto (para grilla / vistas pequeñas).
        from .models import ProductImage
        thumb_rows = (ProductImage.objects
                      .filter(product_id__in=pids, is_main=True)
                      .values('product_id', 'thumb_url', 'url'))
        thumb_map = {r['product_id']: (r['thumb_url'] or r['url']) for r in thumb_rows}

        # Mapa de stock por ciudad o sucursal (para disponibilidad).
        stock_map = {}
        zone_active = False
        if branch_id:
            zone_active = True
            rows = (Stock.objects.filter(branch_id=branch_id, variant__product_id__in=pids)
                    .values('variant__product_id').annotate(total=Sum('quantity')))
            stock_map = {r['variant__product_id']: r['total'] or 0 for r in rows}
        elif city:
            zone_active = True
            rows = (Stock.objects.filter(branch__city__iexact=city, variant__product_id__in=pids)
                    .values('variant__product_id').annotate(total=Sum('quantity')))
            stock_map = {r['variant__product_id']: r['total'] or 0 for r in rows}

        def serialize(p):
            stock = stock_map.get(p.id, 0)
            return {
                'id': p.id, 'name': p.name, 'slug': p.slug,
                'brand_id': p.brand_id, 'brand_name': p.brand.name,
                'category_id': p.category_id, 'category_name': p.category.name,
                'base_price': str(p.base_price),
                'compare_at_price': str(p.compare_at_price) if p.compare_at_price else None,
                'gender': p.gender, 'tag': p.tag,
                'main_image_url': p.main_image_url,
                'thumb_url': thumb_map.get(p.id) or p.main_image_url,
                'is_featured': p.is_featured,
                'branch_stock': stock if zone_active else None,
                'available_in_city': (stock > 0) if zone_active else True,
            }

        results = [serialize(p) for p in products]
        # Híbrido: prioriza los disponibles en la ciudad (orden estable).
        if zone_active:
            results.sort(key=lambda r: 0 if r['available_in_city'] else 1)

        return Response({'count': len(results), 'results': results})


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


class PublicProductDetailView(APIView):
    """Detalle público de un producto: imágenes, variantes (tallas/colores), rating."""
    permission_classes = [permissions.AllowAny]

    def get(self, request, pk):
        from django.db.models import Avg, Count as _Count
        from apps.variants.models import Variant
        from apps.reviews.models import Review, ReviewStatus

        p = (Product.objects
             .filter(pk=pk, status=ProductStatus.PUBLISHED)
             .select_related('brand', 'category')
             .prefetch_related('images')
             .first())
        if not p:
            return Response({'detail': 'Producto no encontrado.'}, status=404)

        images = [img.url for img in p.images.all().order_by('-is_main', 'sort_order')]
        if p.main_image_url and p.main_image_url not in images:
            images.insert(0, p.main_image_url)
        if not images:
            images = ['https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=1200&q=85']

        variants = list(Variant.objects.filter(product=p, is_active=True)
                        .values('size', 'color'))
        # Tallas únicas (orden natural-ish) y colores únicos
        sizes = sorted({v['size'] for v in variants if v['size']},
                       key=lambda x: (len(x), x))
        color_names = []
        for v in variants:
            c = v['color']
            if c and c not in color_names:
                color_names.append(c)
        palette = {
            'negro': '#0b0e16', 'black': '#0b0e16',
            'blanco': '#f5f6f8', 'white': '#f5f6f8',
            'gris': '#9aa0ab', 'gray': '#9aa0ab', 'grey': '#9aa0ab', 'plomo': '#6b7280',
            'azul': '#1e40af', 'blue': '#1e40af', 'azul marino': '#1e3a8a', 'navy': '#1e3a8a',
            'celeste': '#38bdf8', 'turquesa': '#14b8a6', 'cyan': '#06b6d4',
            'rojo': '#dc2626', 'red': '#dc2626', 'vino': '#7f1d1d', 'guinda': '#9f1239',
            'verde': '#16a34a', 'green': '#16a34a', 'verde lima': '#84cc16', 'lima': '#84cc16',
            'oliva': '#65733b', 'menta': '#34d399',
            'amarillo': '#eab308', 'yellow': '#eab308', 'mostaza': '#ca8a04', 'dorado': '#d4af37', 'gold': '#d4af37',
            'rosa': '#ec4899', 'pink': '#ec4899', 'fucsia': '#e0399a', 'magenta': '#e0399a',
            'morado': '#7c3aed', 'purple': '#7c3aed', 'violeta': '#8b5cf6', 'lila': '#c4b5fd',
            'naranja': '#f97316', 'orange': '#f97316',
            'cafe': '#7c4a2d', 'café': '#7c4a2d', 'marron': '#7c4a2d', 'marrón': '#7c4a2d', 'brown': '#7c4a2d',
            'beige': '#d8c3a5', 'crema': '#efe6d5', 'arena': '#d8c3a5',
            'plateado': '#c0c0c0', 'silver': '#c0c0c0',
        }
        colors = [{
            'name': c,
            'hex': palette.get(c.strip().lower(), '#475569'),
            'image': images[0],
        } for c in color_names]

        agg = (Review.objects.filter(product=p, status=ReviewStatus.APPROVED)
               .aggregate(avg=Avg('rating'), n=_Count('id')))

        return Response({
            'id': p.id, 'name': p.name, 'slug': p.slug,
            'brand_name': p.brand.name, 'category_name': p.category.name,
            'category_slug': p.category.slug,
            'base_price': str(p.base_price),
            'compare_at_price': str(p.compare_at_price) if p.compare_at_price else None,
            'gender': p.gender, 'tag': p.tag,
            'short_description': p.short_description,
            'description': p.description,
            'main_image_url': images[0],
            'images': images,
            'sizes': sizes,
            'colors': colors,
            'rating': round(agg['avg'], 1) if agg['avg'] else 0,
            'reviews_count': agg['n'] or 0,
        })
