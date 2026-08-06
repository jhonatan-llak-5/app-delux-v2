from django.db import transaction
from django.db.models import Count, F, Max, Q, Sum
from rest_framework import filters, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from django.utils import timezone

from apps.accounts.permissions import IsBranchManager, IsStaff
from apps.variants.models import Variant
from apps.products.models import Product, ProductImage
from .models import Stock, StockMovement, Supplier, Reception, ReceptionItem
from .serializers import (
    StockSerializer, StockAdjustSerializer,
    StockMovementSerializer, TransferSerializer,
    SupplierSerializer, ReceptionSerializer,
)
from .services import (
    resolve_tenant, unique_slug, next_sku_number,
    resolve_brand, resolve_category, default_brand, default_category,
)


def _product_images(product):
    """Lista de URLs de imagenes del producto (principal + galeria, sin duplicados)."""
    out = []
    main = getattr(product, 'main_image_url', '') or ''
    if main:
        out.append(main)
    for im in product.images.all():
        u = im.url or ''
        if u and u not in out:
            out.append(u)
    return out


class AdminStockViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = StockSerializer
    permission_classes = [permissions.IsAuthenticated, IsStaff]
    filter_backends = [filters.OrderingFilter]
    ordering_fields = ['quantity', 'updated_at']
    ordering = ['-updated_at']

    def get_queryset(self):
        qs = (
            Stock.objects
            .filter(variant__product__deleted_at__isnull=True, variant__is_active=True)
            .select_related(
                'variant', 'variant__product',
                'variant__product__brand', 'variant__product__category',
                'branch', 'tenant',
            )
        )
        params = self.request.query_params
        if params.get('branch'):   qs = qs.filter(branch_id=params['branch'])
        if params.get('variant'):  qs = qs.filter(variant_id=params['variant'])
        if params.get('product'):  qs = qs.filter(variant__product_id=params['product'])
        if params.get('brand'):    qs = qs.filter(variant__product__brand_id=params['brand'])
        if params.get('category'): qs = qs.filter(variant__product__category_id=params['category'])
        if params.get('low_stock') == 'true':
            qs = qs.filter(quantity__lte=F('min_threshold'))
        if params.get('out_of_stock') == 'true':
            qs = qs.filter(quantity=0)

        # Búsqueda amplia por palabras (AND entre tokens; cada token puede
        # coincidir en nombre, descripción, talla, color, marca, SKU, código o precio).
        # Ej: "delux celeste 40" -> exige que aparezcan las tres.
        term = (params.get('search') or '').strip()
        if term:
            from decimal import Decimal, InvalidOperation
            for token in term.split():
                cond = (
                    Q(variant__sku__icontains=token)
                    | Q(variant__barcode__icontains=token)
                    | Q(variant__product__name__icontains=token)
                    | Q(variant__product__description__icontains=token)
                    | Q(variant__product__brand__name__icontains=token)
                    | Q(variant__size__icontains=token)
                    | Q(variant__color__icontains=token)
                )
                try:
                    val = Decimal(token.replace(',', '.'))
                    cond |= Q(variant__product__base_price=val) | Q(variant__price_override=val)
                except (InvalidOperation, ValueError):
                    pass
                qs = qs.filter(cond)

        # Scoping por rol: solo el superadmin ve todas las sucursales. Gerente,
        # vendedor y bodeguero quedan acotados a SU sucursal asignada.
        user = self.request.user
        if getattr(user, 'role', None) and user.role != 'SUPERADMIN':
            if user.tenant_id:
                qs = qs.filter(tenant_id=user.tenant_id)
            if user.role in ('BRANCH_MANAGER', 'SALESPERSON', 'WAREHOUSE') and user.branch_id:
                qs = qs.filter(branch_id=user.branch_id)
        return qs

    @action(detail=True, methods=['post'])
    def adjust(self, request, pk=None):
        """Aplica un delta al stock y registra movimiento."""
        stock = self.get_object()
        serializer = StockAdjustSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        delta = serializer.validated_data['delta']
        mtype = serializer.validated_data.get('type', 'ADJ')
        note = serializer.validated_data.get('note', '')
        reason = serializer.validated_data.get('reason') or ''
        unit_cost = serializer.validated_data.get('unit_cost')

        with transaction.atomic():
            before = stock.quantity
            new_qty = max(0, stock.quantity + delta)
            stock.quantity = new_qty
            # Entradas (reposición/compra) no deben disparar "stock bajo"; las
            # salidas sí (venta/merma que dejan poco stock).
            if delta > 0:
                stock._skip_low_stock = True
            stock.save(update_fields=['quantity', 'updated_at'])
            StockMovement.objects.create(
                tenant=stock.tenant, stock=stock,
                type=mtype, quantity=delta, note=note or reason,
                actor=request.user if request.user.is_authenticated else None,
                qty_before=before, qty_after=new_qty,
            )
            # Entrada de mercaderia nueva con costo = COMPRA -> se registra para Finanzas.
            # Merma/perdida/conteo NO son compra (solo mueven stock).
            if delta > 0 and reason == 'COMPRA' and unit_cost:
                from django.utils import timezone
                from .models import Reception, ReceptionItem
                rec = Reception.objects.create(
                    tenant=stock.tenant, branch_id=stock.branch_id,
                    note='Reposicion desde inventario',
                    created_by=request.user if request.user.is_authenticated else None,
                    status=Reception.STATUS_COMMITTED, committed_at=timezone.now(),
                )
                rec.code = f"REC-{timezone.now():%Y%m%d}-{rec.pk:04d}"
                rec.save(update_fields=['code'])
                ReceptionItem.objects.create(
                    tenant=stock.tenant, reception=rec, variant=stock.variant,
                    branch_id=stock.branch_id, quantity=delta, unit_cost=unit_cost,
                )
        return Response({'detail': 'Stock ajustado.', 'quantity': stock.quantity})

    @action(detail=True, methods=['post'], url_path='set-pricing')
    def set_pricing(self, request, pk=None):
        """Actualiza el precio de venta y/o el costo de UNA variante desde el
        inventario. Aquí el precio es POR VARIANTE (price_override), para poder
        darle a una talla/color un precio distinto. Para fijar un precio único a
        todo el producto se edita en el formulario del producto.
        El precio NO cambia el stock, por eso no requiere motivo."""
        stock = self.get_object()
        variant = stock.variant
        data = request.data or {}
        if data.get('base_price') not in (None, ''):
            product = variant.product
            # Producto BÁSICO (una sola variante): el precio es el del producto
            # (base_price), que es lo que lee el catálogo público. En productos
            # con varias variantes el precio es POR VARIANTE (price_override).
            if product.variants.filter(is_active=True).count() <= 1:
                product.base_price = data['base_price']
                product.save(update_fields=['base_price'])
                if variant.price_override is not None:
                    variant.price_override = None
                    variant.save(update_fields=['price_override'])
            else:
                variant.price_override = data['base_price']
                variant.save(update_fields=['price_override'])
        if data.get('cost') not in (None, ''):
            variant.cost = data['cost']
            variant.save(update_fields=['cost'])
        return Response({'detail': 'Precio/costo actualizado.'})

    @action(detail=False, methods=['get'])
    def summary(self, request):
        """Resumen por sucursal: total unidades, productos, low stock."""
        params = request.query_params
        qs = self.get_queryset()
        total_units = qs.aggregate(total=Sum('quantity'))['total'] or 0
        low_count = qs.filter(quantity__lte=F('min_threshold')).count()
        out_count = qs.filter(quantity=0).count()
        variant_count = qs.values('variant').distinct().count()
        product_count = qs.values('variant__product').distinct().count()

        # Por sucursal
        by_branch = list(
            qs.values('branch_id', 'branch__name', 'branch__code')
            .annotate(
                units=Sum('quantity'),
                variants=Count('variant', distinct=True),
                low=Count('id', filter=Q(quantity__lte=F('min_threshold'))),
            )
            .order_by('branch__name')
        )
        return Response({
            'total_units': total_units,
            'variants_count': variant_count,
            'products_count': product_count,
            'low_stock_count': low_count,
            'out_of_stock_count': out_count,
            'by_branch': by_branch,
        })

    @action(detail=False, methods=['get'], url_path='by-product')
    def by_product(self, request):
        """Inventario agrupado por producto: una entrada por producto con sus
        variantes/stocks anidados. Pagina por PRODUCTO (no por variante), así
        un producto con muchas tallas ocupa una sola fila expandible."""
        # Del último ingresado al primero (fecha de creación del producto, desc).
        qs = self.get_queryset().order_by(
            '-variant__product__created_at', '-variant__product_id',
            'variant__size', 'variant__color', 'variant__sku',
        )
        # IDs de producto en orden de aparición, sin repetir.
        ordered_pids = list(dict.fromkeys(qs.values_list('variant__product_id', flat=True)))
        total = len(ordered_pids)
        try:
            page = max(1, int(request.query_params.get('page', 1)))
            size = min(200, max(1, int(request.query_params.get('page_size', 50))))
        except (TypeError, ValueError):
            page, size = 1, 50
        page_pids = ordered_pids[(page - 1) * size: (page - 1) * size + size]
        page_set = set(page_pids)

        rows = [s for s in qs if s.variant.product_id in page_set]
        data_rows = StockSerializer(rows, many=True).data

        groups = {}
        for s, data in zip(rows, data_rows):
            p = s.variant.product
            g = groups.get(p.id)
            if g is None:
                g = {
                    'product_id': p.id,
                    'product_name': p.name,
                    'brand_name': p.brand.name if p.brand_id else '',
                    'category_name': p.category.name if p.category_id else '',
                    'product_main_image': p.main_image_url or '',
                    'product_status': p.status,
                    'online_visible': p.online_visible,
                    'on_offer': p.on_offer,
                    'discount_percent': float(p.discount_percent or 0),
                    'variants_count': 0,
                    'total_qty': 0,
                    'low_count': 0,
                    'stocks': [],
                    '_prices': set(),
                    '_costs': set(),
                }
                groups[p.id] = g
            g['stocks'].append(data)
            g['total_qty'] += s.quantity
            if s.quantity <= s.min_threshold:
                g['low_count'] += 1
            # Precio efectivo (override de variante o precio del producto) y costo
            # de la variante, para calcular el rango desde–hasta del producto.
            eff_price = s.variant.price_override if s.variant.price_override is not None else p.base_price
            if eff_price is not None:
                g['_prices'].add(float(eff_price))
            if s.variant.cost is not None:
                g['_costs'].add(float(s.variant.cost))
        for g in groups.values():
            g['variants_count'] = len({row['variant'] for row in g['stocks']})
            prices = g.pop('_prices')
            costs = g.pop('_costs')
            g['price_min'] = round(min(prices), 2) if prices else 0
            g['price_max'] = round(max(prices), 2) if prices else 0
            g['cost_min'] = round(min(costs), 2) if costs else 0
            g['cost_max'] = round(max(costs), 2) if costs else 0

        results = [groups[pid] for pid in page_pids if pid in groups]
        return Response({'count': total, 'results': results})

    @action(detail=False, methods=['get'], url_path='variant-search')
    def variant_search(self, request):
        """Busca variantes ya creadas por nombre del producto, SKU o codigo de barras."""
        from django.db.models import Q
        q = (request.query_params.get('q') or '').strip()
        if len(q) < 2:
            return Response({'results': []})
        tenant = resolve_tenant(request.user)
        # Busqueda por palabras: cada token debe coincidir en nombre, talla,
        # color, marca, categoria, SKU o codigo de barras (ej. "jogger negro 35").
        qs = Variant.objects.filter(tenant=tenant, product__deleted_at__isnull=True)
        for token in q.split():
            qs = qs.filter(
                Q(product__name__icontains=token)
                | Q(size__icontains=token)
                | Q(color__icontains=token)
                | Q(product__brand__name__icontains=token)
                | Q(product__category__name__icontains=token)
                | Q(sku__icontains=token)
                | Q(barcode__icontains=token)
            )
        vs = (qs.select_related('product', 'product__brand', 'product__category')
              .prefetch_related('product__images')[:15])
        results = [{
            'id': v.id, 'sku': v.sku, 'barcode': v.barcode,
            'size': v.size, 'color': v.color,
            'cost': v.cost, 'price_override': v.price_override,
            'product_id': v.product_id, 'product_name': v.product.name,
            'kind': v.product.kind, 'base_price': v.product.base_price,
            'brand_id': v.product.brand_id, 'brand_name': v.product.brand.name,
            'category_id': v.product.category_id, 'category_name': v.product.category.name,
            'images': _product_images(v.product),
        } for v in vs]
        return Response({'results': results})

    @action(detail=False, methods=['get'], url_path='scan')
    def scan(self, request):
        """Busca una variante por codigo de barras o SKU (para recepcion/POS)."""
        from django.db.models import Q
        code = (request.query_params.get('code') or '').strip()
        branch_id = request.query_params.get('branch')
        if not code:
            return Response({'found': False})
        tenant = resolve_tenant(request.user)
        v = (Variant.objects.filter(tenant=tenant, product__deleted_at__isnull=True)
             .filter(Q(sku__iexact=code) | Q(barcode__iexact=code))
             .select_related('product', 'product__brand', 'product__category')
             .prefetch_related('product__images')
             .first())
        if not v:
            return Response({'found': False, 'code': code})
        branch_qty = 0
        if branch_id:
            st = Stock.objects.filter(variant=v, branch_id=branch_id).first()
            branch_qty = st.quantity if st else 0
        return Response({
            'found': True,
            'variant': {
                'id': v.id, 'sku': v.sku, 'barcode': v.barcode,
                'size': v.size, 'color': v.color,
                'cost': v.cost, 'price_override': v.price_override,
                'product_id': v.product_id, 'product_name': v.product.name,
                'kind': v.product.kind,
                'base_price': v.product.base_price,
                'brand_id': v.product.brand_id, 'brand_name': v.product.brand.name,
                'category_id': v.product.category_id, 'category_name': v.product.category.name,
                'images': _product_images(v.product),
            },
            'branch_qty': branch_qty,
        })

    @action(detail=False, methods=['post'])
    def transfer(self, request):
        """Transferir stock entre sucursales."""
        serializer = TransferSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        variant = Variant.objects.filter(pk=data['variant_id']).first()
        if not variant:
            return Response({'detail': 'Variante no encontrada.'}, status=400)

        with transaction.atomic():
            from_stock = Stock.objects.select_for_update().filter(
                variant=variant, branch_id=data['from_branch_id']
            ).first()
            if not from_stock or from_stock.quantity < data['quantity']:
                return Response({'detail': 'Stock insuficiente en origen.'}, status=400)

            to_stock, _ = Stock.objects.select_for_update().get_or_create(
                tenant=variant.tenant, variant=variant, branch_id=data['to_branch_id'],
                defaults={'quantity': 0, 'min_threshold': 2},
            )

            from_before = from_stock.quantity
            to_before = to_stock.quantity
            from_stock.quantity -= data['quantity']
            to_stock.quantity += data['quantity']
            from_stock.save(update_fields=['quantity', 'updated_at'])
            to_stock.save(update_fields=['quantity', 'updated_at'])

            note = data.get('note', '') or f'Transfer {from_stock.branch.name} -> {to_stock.branch.name}'
            StockMovement.objects.create(
                tenant=variant.tenant, stock=from_stock,
                type=StockMovement.TYPE_TRANSFER_OUT,
                quantity=-data['quantity'], note=note,
                actor=request.user if request.user.is_authenticated else None,
                qty_before=from_before, qty_after=from_stock.quantity,
            )
            StockMovement.objects.create(
                tenant=variant.tenant, stock=to_stock,
                type=StockMovement.TYPE_TRANSFER_IN,
                quantity=data['quantity'], note=note,
                actor=request.user if request.user.is_authenticated else None,
                qty_before=to_before, qty_after=to_stock.quantity,
            )
        return Response({
            'detail': 'Transferencia realizada.',
            'from_qty': from_stock.quantity,
            'to_qty': to_stock.quantity,
        })


class AdminMovementViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = StockMovementSerializer
    permission_classes = [permissions.IsAuthenticated, IsStaff]
    filter_backends = [filters.OrderingFilter]
    ordering = ['-created_at']

    def get_queryset(self):
        qs = (
            StockMovement.objects
            .select_related('stock', 'stock__variant', 'stock__variant__product',
                            'stock__branch', 'actor')
        )
        user = self.request.user
        role = getattr(user, 'role', None)
        # Aislar por tienda (tenant) salvo superadmin.
        if role != 'SUPERADMIN':
            qs = qs.filter(tenant_id=getattr(user, 'tenant_id', None))
        # Gerente/Vendedor/Bodeguero: solo su sucursal (solo el superadmin ve todas).
        if role in ('BRANCH_MANAGER', 'SALESPERSON', 'WAREHOUSE') and getattr(user, 'branch_id', None):
            qs = qs.filter(stock__branch_id=user.branch_id)
        params = self.request.query_params
        if params.get('branch'):  qs = qs.filter(stock__branch_id=params['branch'])
        if params.get('product'): qs = qs.filter(stock__variant__product_id=params['product'])
        if params.get('type'):    qs = qs.filter(type=params['type'])
        return qs


class AdminSupplierViewSet(viewsets.ModelViewSet):
    serializer_class = SupplierSerializer
    permission_classes = [permissions.IsAuthenticated, IsStaff]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'phone', 'tax_id', 'contact_name']
    ordering = ['name']

    def get_queryset(self):
        qs = Supplier.objects.all()
        tenant = resolve_tenant(self.request.user)
        if tenant:
            qs = qs.filter(tenant=tenant)
        return qs.order_by('name')

    def perform_create(self, serializer):
        serializer.save(tenant=resolve_tenant(self.request.user))

    @action(detail=True, methods=['get'])
    def products(self, request, pk=None):
        """Productos que este proveedor ha surtido (via recepciones), con
        cantidad total y fecha de la ultima recepcion. Sirve para saber a
        que productos hace referencia y contactarlo rapido."""
        supplier = self.get_object()
        rows = (ReceptionItem.objects
                .filter(reception__supplier=supplier)
                .values('variant__product__id', 'variant__product__name')
                .annotate(qty=Sum('quantity'), last=Max('reception__committed_at'))
                .order_by('-qty'))
        out = [{
            'product_id': r['variant__product__id'],
            'product': r['variant__product__name'],
            'qty': r['qty'] or 0,
            'last_received': r['last'].date().isoformat() if r['last'] else None,
        } for r in rows]
        return Response(out)


class AdminReceptionViewSet(viewsets.ModelViewSet):
    """Recepcion de mercaderia: crea/incrementa producto+variante+stock de golpe."""
    serializer_class = ReceptionSerializer
    permission_classes = [permissions.IsAuthenticated, IsStaff]
    http_method_names = ['get', 'post', 'head', 'options']
    filter_backends = [filters.OrderingFilter]
    ordering = ['-created_at']

    def get_queryset(self):
        from django.db.models.functions import Coalesce
        qs = (Reception.objects
              .select_related('supplier', 'branch', 'created_by')
              .prefetch_related('items', 'items__variant', 'items__variant__product')
              .annotate(eff_date=Coalesce('committed_at', 'created_at')))
        tenant = resolve_tenant(self.request.user)
        if tenant:
            qs = qs.filter(tenant=tenant)
        user = self.request.user
        if getattr(user, 'role', None) in ('BRANCH_MANAGER', 'SALESPERSON') and getattr(user, 'branch_id', None):
            qs = qs.filter(branch_id=user.branch_id)
        params = self.request.query_params
        if params.get('branch'):
            qs = qs.filter(branch_id=params['branch'])
        # Filtros para conciliar contra la factura del proveedor.
        if params.get('supplier'):
            qs = qs.filter(supplier_id=params['supplier'])
        if params.get('created_by'):
            qs = qs.filter(created_by_id=params['created_by'])
        if params.get('date_from'):
            qs = qs.filter(eff_date__date__gte=params['date_from'])
        if params.get('date_to'):
            qs = qs.filter(eff_date__date__lte=params['date_to'])
        return qs.order_by('-eff_date')

    @action(detail=False, methods=['get'])
    def users(self, request):
        """Usuarios que han registrado recepciones (para el filtro del historial).
        No aplica el rango de fechas: siempre muestra la lista completa."""
        from apps.accounts.models import User
        recs = Reception.objects.all()
        tenant = resolve_tenant(request.user)
        if tenant:
            recs = recs.filter(tenant=tenant)
        u = request.user
        if getattr(u, 'role', None) in ('BRANCH_MANAGER', 'SALESPERSON') and getattr(u, 'branch_id', None):
            recs = recs.filter(branch_id=u.branch_id)
        ids = list(recs.exclude(created_by__isnull=True)
                       .values_list('created_by_id', flat=True).distinct())
        out = [{'id': x.id, 'name': (x.full_name or x.email or f'Usuario {x.id}')}
               for x in User.objects.filter(id__in=ids)]
        out.sort(key=lambda z: z['name'].lower())
        return Response({'results': out})

    def create(self, request, *args, **kwargs):
        from rest_framework.exceptions import ValidationError
        data = request.data
        tenant = resolve_tenant(request.user)
        branch_id = data.get('branch')
        if not branch_id:
            return Response({'detail': 'Sucursal destino requerida.'}, status=400)
        items = data.get('items') or []
        if not items:
            return Response({'detail': 'Agrega al menos un producto.'}, status=400)

        # Validación de código de barras: no permitir registrar un producto NUEVO
        # con un código que ya exista en la empresa (evita duplicar productos).
        # Solo aplica a items que crean producto nuevo (sin variant_id/product_id).
        new_barcodes = []
        for raw in items:
            bc = (raw.get('barcode') or '').strip()
            if bc and not raw.get('variant_id') and not raw.get('product_id'):
                new_barcodes.append(bc)
        if new_barcodes:
            from django.db.models import Q
            dup = (Variant.objects
                   .filter(Q(barcode__in=new_barcodes) | Q(sku__in=new_barcodes),
                           tenant=tenant, product__deleted_at__isnull=True)
                   .select_related('product').first())
            if dup:
                return Response({
                    'detail': f'El código de barras «{dup.barcode}» ya está asignado al '
                              f'producto «{dup.product.name}». Usa otro código o edita ese producto.',
                    'code': 'barcode_exists',
                    'barcode': dup.barcode,
                    'product_id': dup.product_id,
                    'product_name': dup.product.name,
                }, status=400)

        # Proveedor: por id o alta rapida por nombre.
        supplier = None
        if data.get('supplier'):
            supplier = Supplier.objects.filter(pk=data['supplier'], tenant=tenant).first()
        elif (data.get('supplier_name') or '').strip():
            supplier, _ = Supplier.objects.get_or_create(
                tenant=tenant, name=data['supplier_name'].strip())

        with transaction.atomic():
            reception = Reception.objects.create(
                tenant=tenant, branch_id=branch_id, supplier=supplier,
                note=(data.get('note') or ''),
                created_by=request.user if request.user.is_authenticated else None,
                status=Reception.STATUS_COMMITTED, committed_at=timezone.now(),
            )
            reception.code = f"REC-{timezone.now():%Y%m%d}-{reception.pk:04d}"
            reception.save(update_fields=['code'])

            seq = next_sku_number(tenant)
            actor = request.user if request.user.is_authenticated else None
            created_products = {}

            for raw in items:
                try:
                    qty = int(raw.get('quantity') or 0)
                except (TypeError, ValueError):
                    qty = 0
                if qty <= 0:
                    continue
                cost = raw.get('unit_cost') or 0
                variant = None
                if raw.get('variant_id'):
                    variant = Variant.objects.filter(pk=raw['variant_id'], tenant=tenant).first()

                if variant is None:
                    product = None
                    if raw.get('product_id'):
                        product = Product.objects.filter(pk=raw['product_id'], tenant=tenant).first()
                    if product is None:
                        # Marca/categoria son opcionales: si no vienen se usa "General".
                        brand = resolve_brand(tenant, raw) or default_brand(tenant)
                        category = resolve_category(tenant, raw) or default_category(tenant)
                        name = (raw.get('product_name') or '').strip() or 'Producto'
                        kind = (raw.get('kind') or 'OTRO')
                        pkey = (name.lower(), brand.id, category.id, kind)
                        product = created_products.get(pkey)
                        if product is None:
                            # Acepta URLs absolutas (http/https) y rutas locales
                            # relativas (p. ej. /media/products/...), que es lo que
                            # devuelve la subida de imágenes.
                            imgs = [u.strip() for u in (raw.get('images') or [])
                                    if isinstance(u, str) and u.strip()
                                    and (u.strip().lower().startswith(('http://', 'https://'))
                                         or u.strip().startswith('/'))]
                            # Impuesto por producto (None = usa el IVA global) y oferta.
                            _tax = raw.get('tax_rate')
                            _cmp = raw.get('compare_at_price') or None
                            try:
                                _disc = float(raw.get('discount_percent') or 0)
                            except (TypeError, ValueError):
                                _disc = 0
                            # Dimensiones de variante personalizadas (opcionales).
                            _vopts = raw.get('variant_options')
                            product = Product.objects.create(
                                tenant=tenant, name=name, slug=unique_slug(Product, tenant, name),
                                brand=brand, category=category, kind=kind,
                                base_price=raw.get('price') or 0,
                                compare_at_price=_cmp,
                                tax_rate=(_tax if _tax not in ('', None) else None),
                                discount_percent=_disc,
                                tag=('SALE' if (_cmp or _disc > 0) else ''),
                                description=(raw.get('description') or ''),
                                main_image_url=(imgs[0] if imgs else ''),
                                variant_options=(_vopts if isinstance(_vopts, list) else []),
                                status='PUBLISHED',
                            )
                            for idx, u in enumerate(imgs):
                                ProductImage.objects.create(
                                    product=product, url=u, sort_order=idx, is_main=(idx == 0))
                            created_products[pkey] = product
                    # Atributos de la variante (dimensiones personalizadas). Si no
                    # vienen, se arman con talla/color para compatibilidad.
                    attributes = raw.get('attributes') if isinstance(raw.get('attributes'), dict) else {}
                    size = (raw.get('size') or '').strip()
                    color = (raw.get('color') or '').strip()
                    if attributes and not size and not color:
                        # Puebla talla/color con las dos primeras dimensiones (compat).
                        vals = list(attributes.values())
                        size = str(vals[0]).strip() if len(vals) > 0 else ''
                        color = str(vals[1]).strip() if len(vals) > 1 else ''
                    # Busca una variante existente por atributos (o por talla/color).
                    variant = None
                    for cand in Variant.objects.filter(product=product):
                        if attributes:
                            if (cand.attributes or {}) == attributes:
                                variant = cand; break
                        elif cand.size == size and cand.color == color:
                            variant = cand; break
                    if variant is None:
                        sku = f'P{seq:08d}'
                        seq += 1
                        variant = Variant.objects.create(
                            tenant=tenant, product=product, sku=sku,
                            size=size, color=color, attributes=attributes,
                            barcode=(raw.get('barcode') or '').strip(),
                            cost=cost,
                            # Cada variante puede llegar con su propio precio en
                            # la recepción, así que se guarda como price_override.
                            # (product.base_price queda como precio por defecto).
                            price_override=(raw.get('price') or None),
                        )

                # Actualiza costo y codigo del proveedor si vinieron.
                changed = []
                if cost:
                    variant.cost = cost; changed.append('cost')
                if raw.get('barcode') and not variant.barcode:
                    variant.barcode = str(raw['barcode']).strip(); changed.append('barcode')
                if changed:
                    variant.save(update_fields=changed)

                item_branch_id = raw.get('branch') or branch_id
                stock, _ = Stock.objects.select_for_update().get_or_create(
                    tenant=tenant, variant=variant, branch_id=item_branch_id,
                    defaults={'quantity': 0},
                )
                rec_before = stock.quantity
                stock.quantity += qty
                # Recibir mercadería no debe disparar la alerta de "stock bajo".
                stock._skip_low_stock = True
                stock.save(update_fields=['quantity', 'updated_at'])
                StockMovement.objects.create(
                    tenant=tenant, stock=stock, type=StockMovement.TYPE_IN,
                    quantity=qty, note=f'Recepcion {reception.code}', actor=actor,
                    qty_before=rec_before, qty_after=stock.quantity,
                )
                ReceptionItem.objects.create(
                    tenant=tenant, reception=reception, variant=variant,
                    branch_id=item_branch_id,
                    quantity=qty, unit_cost=cost or 0,
                )

        return Response(ReceptionSerializer(reception).data, status=status.HTTP_201_CREATED)
