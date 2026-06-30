from django.db import transaction
from django.db.models import Sum, Count, F, Q
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
    resolve_brand, resolve_category,
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
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['variant__sku', 'variant__product__name']
    ordering_fields = ['quantity', 'updated_at']
    ordering = ['-updated_at']

    def get_queryset(self):
        qs = (
            Stock.objects
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

        # Scoping por rol: gerente de sucursal solo ve el stock de su sucursal.
        user = self.request.user
        if getattr(user, 'role', None) and user.role != 'SUPERADMIN':
            if user.tenant_id:
                qs = qs.filter(tenant_id=user.tenant_id)
            if user.role in ('BRANCH_MANAGER', 'SALESPERSON') and user.branch_id:
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

        with transaction.atomic():
            new_qty = max(0, stock.quantity + delta)
            stock.quantity = new_qty
            stock.save(update_fields=['quantity', 'updated_at'])
            StockMovement.objects.create(
                tenant=stock.tenant, stock=stock,
                type=mtype, quantity=delta, note=note,
                actor=request.user if request.user.is_authenticated else None,
            )
        return Response({'detail': 'Stock ajustado.', 'quantity': stock.quantity})

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
        qs = Variant.objects.filter(tenant=tenant)
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
        v = (Variant.objects.filter(tenant=tenant)
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
            )
            StockMovement.objects.create(
                tenant=variant.tenant, stock=to_stock,
                type=StockMovement.TYPE_TRANSFER_IN,
                quantity=data['quantity'], note=note,
                actor=request.user if request.user.is_authenticated else None,
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


class AdminReceptionViewSet(viewsets.ModelViewSet):
    """Recepcion de mercaderia: crea/incrementa producto+variante+stock de golpe."""
    serializer_class = ReceptionSerializer
    permission_classes = [permissions.IsAuthenticated, IsStaff]
    http_method_names = ['get', 'post', 'head', 'options']
    filter_backends = [filters.OrderingFilter]
    ordering = ['-created_at']

    def get_queryset(self):
        qs = (Reception.objects
              .select_related('supplier', 'branch', 'created_by')
              .prefetch_related('items', 'items__variant', 'items__variant__product'))
        tenant = resolve_tenant(self.request.user)
        if tenant:
            qs = qs.filter(tenant=tenant)
        user = self.request.user
        if getattr(user, 'role', None) in ('BRANCH_MANAGER', 'SALESPERSON') and getattr(user, 'branch_id', None):
            qs = qs.filter(branch_id=user.branch_id)
        branch = self.request.query_params.get('branch')
        if branch:
            qs = qs.filter(branch_id=branch)
        return qs.order_by('-created_at')

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
                        brand = resolve_brand(tenant, raw)
                        category = resolve_category(tenant, raw)
                        if not (brand and category):
                            raise ValidationError('Marca y categoria son obligatorias para productos nuevos.')
                        name = (raw.get('product_name') or '').strip() or 'Producto'
                        kind = (raw.get('kind') or 'OTRO')
                        pkey = (name.lower(), brand.id, category.id, kind)
                        product = created_products.get(pkey)
                        if product is None:
                            imgs = [u.strip() for u in (raw.get('images') or [])
                                    if isinstance(u, str) and u.strip().lower().startswith(('http://', 'https://'))]
                            product = Product.objects.create(
                                tenant=tenant, name=name, slug=unique_slug(Product, tenant, name),
                                brand=brand, category=category, kind=kind,
                                base_price=raw.get('price') or 0,
                                description=(raw.get('description') or ''),
                                main_image_url=(imgs[0] if imgs else ''),
                                status='PUBLISHED',
                            )
                            for idx, u in enumerate(imgs):
                                ProductImage.objects.create(
                                    product=product, url=u, sort_order=idx, is_main=(idx == 0))
                            created_products[pkey] = product
                    size = (raw.get('size') or '').strip()
                    color = (raw.get('color') or '').strip()
                    variant = Variant.objects.filter(product=product, size=size, color=color).first()
                    if variant is None:
                        sku = f'P{seq:08d}'
                        seq += 1
                        variant = Variant.objects.create(
                            tenant=tenant, product=product, sku=sku,
                            size=size, color=color,
                            barcode=(raw.get('barcode') or '').strip(),
                            cost=cost,
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
                stock.quantity += qty
                stock.save(update_fields=['quantity', 'updated_at'])
                StockMovement.objects.create(
                    tenant=tenant, stock=stock, type=StockMovement.TYPE_IN,
                    quantity=qty, note=f'Recepcion {reception.code}', actor=actor,
                )
                ReceptionItem.objects.create(
                    tenant=tenant, reception=reception, variant=variant,
                    branch_id=item_branch_id,
                    quantity=qty, unit_cost=cost or 0,
                )

        return Response(ReceptionSerializer(reception).data, status=status.HTTP_201_CREATED)
