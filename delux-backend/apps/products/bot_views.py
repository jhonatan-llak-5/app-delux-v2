"""
Endpoints para el bot de WhatsApp (n8n).
Devuelven datos compactos de catalogo/stock y registran leads.
Auth por header:  X-Bot-Key: <BOT_API_KEY del entorno>
"""
import os
import unicodedata
from django.conf import settings
from django.db.models import Q, Sum
from rest_framework.permissions import BasePermission
from rest_framework.views import APIView
from rest_framework.response import Response
from django.core.cache import cache

from apps.products.models import Product, ProductStatus
from apps.variants.models import Variant
from apps.inventory.models import Stock


# --- Sinonimos para entender lenguaje del cliente ---------------------------
KIND_SYN = {
    'CALZADO':   ['zapato', 'zapatos', 'zapatilla', 'zapatillas', 'calzado',
                  'tenis', 'sneaker', 'sneakers', 'deportivo', 'deportivos',
                  'botin', 'botines', 'bota', 'botas', 'sandalia', 'sandalias',
                  'zapatos deportivos'],
    'ROPA':      ['ropa', 'camiseta', 'camisetas', 'camisa', 'pantalon', 'pantalones',
                  'buzo', 'chompa', 'short', 'sudadera', 'hoodie', 'polo'],
    'GORRA':     ['gorra', 'gorras', 'cap', 'sombrero'],
    'MOCHILA':   ['mochila', 'mochilas', 'bolso', 'morral', 'maleta', 'maletin'],
    'BISUTERIA': ['bisuteria', 'collar', 'pulsera', 'anillo', 'aretes'],
    'ACCESORIO': ['accesorio', 'accesorios', 'media', 'medias', 'calcetin',
                  'calcetines', 'correa', 'cinturon'],
}
GENDER_SYN = {
    'MEN':   ['hombre', 'hombres', 'caballero', 'varon', 'masculino'],
    'WOMEN': ['mujer', 'mujeres', 'dama', 'damas', 'femenino'],
    'KIDS':  ['nino', 'ninos', 'nina', 'ninas', 'infantil', 'kids'],
}
STOP = {
    'para', 'con', 'los', 'las', 'una', 'uno', 'del', 'que', 'por', 'mas',
    'muy', 'dia', 'diario', 'todo', 'algo', 'tienes', 'tiene', 'busco',
    'quiero', 'necesito', 'ayuda', 'recomiende', 'recomiendas', 'color',
    'talla', 'tallas', 'hola', 'buenas', 'sugerencia', 'alguno', 'algun',
}


def _norm(s):
    """Minusculas + sin tildes, para comparar sinonimos."""
    s = unicodedata.normalize('NFKD', (s or '').lower())
    return ''.join(c for c in s if not unicodedata.combining(c))


def _is_syn(word):
    for syns in KIND_SYN.values():
        if word in syns:
            return True
    for syns in GENDER_SYN.values():
        if word in syns:
            return True
    return False


class HasBotKey(BasePermission):
    """Permite el acceso solo si el header X-Bot-Key coincide con BOT_API_KEY."""
    def has_permission(self, request, view):
        key = getattr(settings, 'BOT_API_KEY', '') or os.getenv('BOT_API_KEY', '')
        sent = request.headers.get('X-Bot-Key', '')
        return bool(key) and sent == key


def _active_tenant():
    from apps.tenants.models import Tenant
    return Tenant.objects.filter(is_active=True).first()


# --- Handoff: pausar el bot por numero (atencion humana) ---
BOT_PAUSE_TTL = int(os.getenv('BOT_PAUSE_TTL', '7200'))  # 2 horas por defecto


def _norm_phone(p):
    return ''.join(ch for ch in str(p or '') if ch.isdigit())


def _pause_key(phone):
    return f'bot_pause:{_norm_phone(phone)}'


def pause_bot(phone):
    if _norm_phone(phone):
        cache.set(_pause_key(phone), 1, BOT_PAUSE_TTL)


def resume_bot(phone):
    if _norm_phone(phone):
        cache.delete(_pause_key(phone))


def is_paused(phone):
    return bool(_norm_phone(phone)) and cache.get(_pause_key(phone)) is not None


class BotProductsView(APIView):
    """GET /api/v1/bot/products?q=<texto>&city=<ciudad>&limit=5
    Busca por nombre, marca, categoria, tipo (kind), genero, color y TALLA.
    Si no hay coincidencia, sugiere destacados (sugerencia=true)."""
    permission_classes = [HasBotKey]

    def get(self, request):
        q = (request.query_params.get('q') or '').strip()
        city = (request.query_params.get('city') or '').strip()
        try:
            limit = min(int(request.query_params.get('limit', 5)), 10)
        except (TypeError, ValueError):
            limit = 5

        base = Product.objects.filter(status=ProductStatus.PUBLISHED, deleted_at__isnull=True, online_visible=True).select_related('brand', 'category')

        # --- Interpretar la consulta ---
        words = _norm(q).split()
        kinds, gender = set(), None
        for w in words:
            for k, syns in KIND_SYN.items():
                if w in syns:
                    kinds.add(k)
            for g, syns in GENDER_SYN.items():
                if w in syns:
                    gender = g
        text_tokens = [w for w in words if len(w) >= 3 and w not in STOP and not _is_syn(w)]
        size_tokens = [w for w in words if w.isdigit()]

        def with_filters(qs):
            if kinds:
                qs = qs.filter(kind__in=list(kinds))
            if gender:
                qs = qs.filter(Q(gender=gender) | Q(gender='UNISEX'))
            return qs

        text_cond = Q()
        for t in text_tokens:
            text_cond |= (Q(name__icontains=t) | Q(short_description__icontains=t) |
                          Q(description__icontains=t) | Q(brand__name__icontains=t) |
                          Q(category__name__icontains=t) | Q(variants__color__icontains=t))
        for t in size_tokens:
            text_cond |= Q(variants__size__iexact=t)
        has_text = bool(text_tokens or size_tokens)

        # Niveles de coincidencia (del mas preciso al mas amplio)
        sugerencia = False
        products = []
        if q:
            # 1) tipo/genero + texto/talla
            c1 = with_filters(base)
            if has_text:
                c1 = c1.filter(text_cond)
            products = list(c1.distinct().order_by('-is_featured', 'name')[:limit])
            # 2) solo tipo/genero
            if not products and (kinds or gender):
                products = list(with_filters(base).distinct().order_by('-is_featured', 'name')[:limit])
            # 3) solo texto/talla
            if not products and has_text:
                products = list(base.filter(text_cond).distinct().order_by('-is_featured', 'name')[:limit])

        if not products:
            # 4) sin nada relevante: recomendamos destacados
            sugerencia = True
            products = list(base.order_by('-is_featured', 'name')[:limit])

        # Dominio publico (con respaldo) para armar enlaces reales al catalogo/producto.
        site = (os.getenv('PUBLIC_SITE_URL', '') or 'https://deluxstyle.com').rstrip('/')
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
                'tipo': p.get_kind_display() if hasattr(p, 'get_kind_display') else '',
                'precio': float(p.base_price or 0),
                'moneda': 'USD',
                'imagen': p.main_image_url or '',
                'disponible': disponible,
                'tallas': tallas,
                'url': (site + f'/product/{p.id}') if site else '',
            })
        catalogo = site + '/shop'
        return Response({'ciudad': city or None, 'count': len(out),
                         'sugerencia': sugerencia, 'catalogo': catalogo, 'productos': out})


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
        try:
            from apps.notifications.push import push_notification, admin_recipients
            partes = [x for x in [
                f'Producto #{producto_id}' if producto_id else '',
                f'Talla {talla}' if talla else '',
                f'Ciudad {ciudad}' if ciudad else '',
                mensaje,
            ] if x]
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
            pass  # el aviso no debe romper la respuesta al bot

        # Pausa el bot para este numero: ahora atiende un humano.
        pause_bot(telefono)
        return Response({'ok': True, 'paused': True}, status=201)


class BotPausedView(APIView):
    """GET /api/v1/bot/paused?phone=...  -> {"paused": bool}
    n8n lo consulta antes de responder; si esta en pausa, atiende un humano."""
    permission_classes = [HasBotKey]

    def get(self, request):
        phone = request.query_params.get('phone') or request.query_params.get('telefono') or ''
        return Response({'phone': _norm_phone(phone), 'paused': is_paused(phone)})


class BotResumeView(APIView):
    """POST /api/v1/bot/resume {telefono}  -> reactiva el bot para ese numero."""
    permission_classes = [HasBotKey]

    def post(self, request):
        d = request.data or {}
        phone = d.get('telefono') or d.get('phone') or ''
        resume_bot(phone)
        return Response({'ok': True, 'paused': is_paused(phone)})


class BotPagoView(APIView):
    """GET /api/v1/bot/pago -> datos reales de pago (transferencia + DE UNA + contra entrega).
    Para que el bot NUNCA invente cuentas: usa exactamente estos valores."""
    permission_classes = [HasBotKey]

    def get(self, request):
        from apps.settings.models import PlatformSettings
        s = PlatformSettings.load()
        qr = ''
        if s.deuna_enabled and s.deuna_qr:
            try:
                qr = request.build_absolute_uri(s.deuna_qr.url)
            except Exception:
                qr = ''
        return Response({
            'transferencia': {
                'habilitado': s.transfer_enabled,
                'banco': s.bank_name,
                'tipo_cuenta': s.bank_account_type,
                'titular': s.bank_account_holder,
                'numero': s.bank_account_number,
                'documento': s.bank_account_document,
                'email': s.bank_contact_email,
                'whatsapp': s.bank_contact_whatsapp,
                'instrucciones': s.transfer_instructions,
            },
            'deuna': {
                'habilitado': s.deuna_enabled,
                'qr': qr,
                'instrucciones': s.deuna_instructions,
            },
            'contra_entrega': {'habilitado': True},
        })
