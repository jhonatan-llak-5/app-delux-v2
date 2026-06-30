"""Endpoints públicos del kiosko de consulta (tablet en tienda).

Permiten escanear/buscar un producto y ver su precio y stock por sucursal,
sin autenticación. Pensado para una tablet fija en el local.
"""
from django.db.models import Q, Sum
from django.http import HttpResponse
from rest_framework import permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from apps.products.models import Product
from apps.variants.models import Variant
from apps.inventory.models import Stock


def _tenant():
    from apps.tenants.models import Tenant
    return Tenant.objects.filter(is_active=True).first()


def _product_payload(product, matched_variant_id=None):
    variants = []
    total = 0
    qs = (product.variants.filter(is_active=True)
          .prefetch_related('stocks', 'stocks__branch'))
    for v in qs:
        stocks = []
        vtotal = 0
        for st in v.stocks.all():
            av = max(st.quantity - st.reserved, 0)
            vtotal += av
            if st.branch:
                stocks.append({'branch': st.branch.name, 'available': av})
        total += vtotal
        price = v.price_override if v.price_override is not None else product.base_price
        variants.append({
            'id': v.id, 'sku': v.sku, 'barcode': v.barcode,
            'size': v.size, 'color': v.color,
            'price': price, 'available': vtotal, 'stocks': stocks,
        })
    gallery = []
    if product.main_image_url:
        gallery.append(product.main_image_url)
    for img in product.images.all():
        if img.url and img.url not in gallery:
            gallery.append(img.url)
    return {
        'id': product.id, 'name': product.name,
        'brand': product.brand.name, 'category': product.category.name,
        'kind': product.kind, 'image': product.main_image_url,
        'images': gallery,
        'base_price': product.base_price,
        'description': product.short_description or product.description or '',
        'total_available': total,
        'matched_variant_id': matched_variant_id,
        'variants': variants,
    }


@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def kiosk_product(request):
    tenant = _tenant()
    code = (request.query_params.get('code') or '').strip()
    pid = request.query_params.get('id')
    product = None
    matched = None
    if pid:
        product = (Product.objects.filter(pk=pid, tenant=tenant)
                   .select_related('brand', 'category').first())
    elif code:
        v = (Variant.objects.filter(tenant=tenant)
             .filter(Q(sku__iexact=code) | Q(barcode__iexact=code))
             .select_related('product', 'product__brand', 'product__category').first())
        if v:
            product = v.product
            matched = v.id
    if not product:
        return Response({'found': False, 'code': code})
    return Response({'found': True, **_product_payload(product, matched)})


@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def kiosk_search(request):
    tenant = _tenant()
    q = (request.query_params.get('q') or '').strip()
    if not q:
        return Response({'results': []})
    prods = (Product.objects.filter(tenant=tenant)
             .filter(Q(name__icontains=q) | Q(short_description__icontains=q)
                     | Q(description__icontains=q)
                     | Q(variants__sku__icontains=q) | Q(variants__barcode__icontains=q))
             .select_related('brand').distinct()[:30])
    out = []
    for p in prods:
        agg = Stock.objects.filter(variant__product=p).aggregate(
            q=Sum('quantity'), r=Sum('reserved'))
        total = max((agg['q'] or 0) - (agg['r'] or 0), 0)
        out.append({
            'id': p.id, 'name': p.name, 'brand': p.brand.name,
            'image': p.main_image_url, 'base_price': p.base_price,
            'total_available': total,
        })
    return Response({'results': out})


@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def kiosk_qr(request):
    """Devuelve un QR en SVG para el dato dado (usado en las etiquetas)."""
    data = request.query_params.get('data') or ''
    from reportlab.graphics.barcode.qr import QrCodeWidget
    from reportlab.graphics.shapes import Drawing
    from reportlab.graphics import renderSVG
    qr = QrCodeWidget(data)
    b = qr.getBounds()
    w = (b[2] - b[0]) or 1
    h = (b[3] - b[1]) or 1
    size = 140
    d = Drawing(size, size, transform=[size / w, 0, 0, size / h, 0, 0])
    d.add(qr)
    svg = renderSVG.drawToString(d)
    resp = HttpResponse(svg, content_type='image/svg+xml')
    resp['Cache-Control'] = 'public, max-age=86400'
    return resp


@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def kiosk_info(request):
    """Info del kiosko por token (resuelve la sucursal y si pide PIN)."""
    from apps.branches.models import Branch
    token = (request.query_params.get('token') or '').strip()
    b = Branch.objects.filter(kiosk_token=token, is_active=True).first() if token else None
    if not b:
        return Response({'found': False})
    return Response({
        'found': True, 'branch_id': b.id, 'branch_name': b.name,
        'city': b.city, 'pin_required': bool(b.kiosk_pin),
    })


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def kiosk_unlock(request):
    """Valida el PIN del kiosko de una sucursal."""
    from apps.branches.models import Branch
    token = (request.data.get('token') or '').strip()
    pin = (request.data.get('pin') or '').strip()
    b = Branch.objects.filter(kiosk_token=token, is_active=True).first() if token else None
    if not b:
        return Response({'detail': 'Kiosko no encontrado.'}, status=404)
    if b.kiosk_pin and b.kiosk_pin != pin:
        return Response({'detail': 'PIN incorrecto.'}, status=403)
    return Response({'ok': True, 'branch_name': b.name})


@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def kiosk_featured(request):
    """Productos destacados/publicados para el modo atracción del kiosko."""
    tenant = _tenant()
    qs = (Product.objects.filter(tenant=tenant, status='PUBLISHED')
          .exclude(main_image_url='')
          .select_related('brand')
          .order_by('-is_featured', '-created_at')[:24])
    out = [{
        'id': p.id, 'name': p.name, 'brand': p.brand.name,
        'image': p.main_image_url, 'base_price': p.base_price, 'tag': p.tag,
    } for p in qs]
    return Response({'results': out})
