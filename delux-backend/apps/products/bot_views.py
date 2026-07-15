"""
Endpoints para el bot de WhatsApp (n8n).
Devuelven datos compactos de catalogo/stock y registran leads.
Auth por header:  X-Bot-Key: <BOT_API_KEY del entorno>
"""
import os
from decimal import Decimal

from django.conf import settings
from django.db.models import Q, Sum
from rest_framework.permissions import BasePermission
from rest_framework.views import APIView
from rest_framework.response import Response

from apps.products.models import Product, ProductStatus
from apps.variants.models import Variant
from apps.inventory.models import Stock


class HasBotKey(BasePermission):
    """Permite el acceso solo si el header X-Bot-Key coincide con BOT_API_KEY."""
    def has_permission(self, request, view):
        key = getattr(settings, 'BOT_API_KEY', '') or os.getenv('BOT_API_KEY', '')
        sent = request.headers.get('X-Bot-Key', '')
        return bool(key) and sent == key


def _active_tenant():
    from apps.tenants.models import Tenant
    return Tenant.objects.filter(is_active=True).first()


class BotProductsView(APIView):
    """GET /api/v1/bot/products?q=<texto>&city=<ciudad>&limit=5
    Busca productos publicados y devuelve precio, imagen y tallas con stock."""
    permission_classes = [HasBotKey]

    def get(self, request):
        q = (request.query_params.get('q') or '').strip()
        city = (request.query_params.get('city') or '').strip()
        try:
            limit = min(int(request.query_params.get('limit', 5)), 10)
        except (TypeError, ValueError):
            limit = 5

        products = Product.objects.filter(status=ProductStatus.PUBLISHED).select_related('brand', 'category')
        if q:
            products = products.filter(
                Q(name__icontains=q) | Q(brand__name__icontains=q) | Q(category__name__icontains=q)
            )
        products = list(products.order_by('-is_featured', 'name')[:limit])

        site = (os.getenv('PUBLIC_SITE_URL', '') or '').rstrip('/')
        out = []
        for p in products:
            variants = list(Variant.objects.filter(product=p, is_active=True))
            vids = [v.id for v in variants]
            sq = Stock.objects.filter(variant_id__in=vids)
            if city:
                sq = sq.filter(branch__city__iexact=city)
            stock_by_variant = {
                r['variant_id']: (r['total'] or 0)
                for r in sq.values('variant_id').annotate(total=Sum('quantity'))
            }
            # Agrupar por talla (una talla puede tener varios colores)
            size_map = {}
            for v in variants:
                st = stock_by_variant.get(v.id, 0)
                key = v.size or '-'
                size_map[key] = size_map.get(key, 0) + int(st)
            tallas = [{'talla': s, 'stock': n} for s, n in
                      sorted(size_map.items(), key=lambda x: (len(x[0]), x[0]))]
            disponible = any(t['stock'] > 0 for t in tallas) if city else True

            out.append({
                'id': p.id,
                'nombre': p.name,
                'marca': p.brand.name if p.brand_id else '',
                'categoria': p.category.name if p.category_id else '',
                'precio': float(p.base_price or 0),
                'moneda': 'USD',
                'imagen': p.main_image_url or '',
                'disponible': disponible,
                'tallas': tallas,
                'url': (site + f'/product/{p.id}') if site else '',
            })
        # Devolvemos un OBJETO (no un array pelado) para que n8n lo trate
        # siempre como 1 item, aunque no haya resultados (evita 0 items).
        return Response({'ciudad': city or None, 'count': len(out), 'productos': out})


class BotLeadView(APIView):
    """POST /api/v1/bot/leads
    Registra el interes de compra y avisa a los administradores (campana)."""
    permission_classes = [HasBotKey]

    def post(self, request):
        d = request.data or {}
        telefono = str(d.get('telefono') or '').strip()
        nombre = str(d.get('nombre') or '').strip()
        producto_id = d.get('producto_id')
        talla = str(d.get('talla') or '').strip()
        mensaje = str(d.get('mensaje') or '').strip()
        ciudad = str(d.get('ciudad') or '').strip()

        if not telefono and not nombre:
            return Response({'detail': 'Falta telefono o nombre.'}, status=400)

        tenant = _active_tenant()
        # Aviso a administradores (campana + tiempo real)
        try:
            from apps.notifications.push import push_notification, admin_recipients
            partes = [p for p in [
                f'Producto #{producto_id}' if producto_id else '',
                f'Talla {talla}' if talla else '',
                f'Ciudad {ciudad}' if ciudad else '',
                mensaje,
            ] if p]
            push_notification(
                type='bot_lead',
                title=f'Interés por WhatsApp: {nombre or telefono}',
                message=' · '.join(partes) or 'Un cliente quiere hablar con un asesor.',
                priority='P1',
                link='',
                meta={'telefono': telefono, 'producto_id': producto_id,
                      'talla': talla, 'ciudad': ciudad},
                recipients=admin_recipients(tenant),
                tenant=tenant,
            )
        except Exception:
            pass  # el aviso no debe