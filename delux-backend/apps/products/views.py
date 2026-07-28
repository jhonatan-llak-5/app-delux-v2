from django.db.models import Count, Sum, Q, Exists, OuterRef
from django.utils import timezone
from rest_framework import filters, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.accounts.permissions import IsBranchManager, IsStaffReadOrManager
from .models import Product, ProductImage
from .serializers import (
    ProductSerializer,
    ProductCreateUpdateSerializer,
    ProductImageSerializer,
)


class AdminProductViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated, IsStaffReadOrManager]
    filter_backends = [filters.OrderingFilter]
    ordering_fields = ['name', 'base_price', 'created_at']
    ordering = ['-created_at']

    def get_queryset(self):
        qs = (
            Product.objects
            .filter(deleted_at__isnull=True)
            .select_related('brand', 'category', 'tenant')
            .prefetch_related('images')
            .annotate(
                images_count=Count('images', distinct=True),
                variants_count=Count('variants', distinct=True),
                total_stock=Sum('variants__stocks__quantity'),
            )
        )
        params = self.request.query_params
        if params.get('brand'):    qs = qs.filter(brand_id=params['brand'])
        if params.get('category'): qs = qs.filter(category_id=params['category'])
        if params.get('status'):   qs = qs.filter(status=params['status'])
        if params.get('tag'):      qs = qs.filter(tag=params['tag'])
        if params.get('gender'):   qs = qs.filter(gender=params['gender'])
        if params.get('is_featured') in ('true', 'false'):
            qs = qs.filter(is_featured=params['is_featured'] == 'true')

        # Busqueda: nombre/descripcion + codigo interno (SKU) y codigo de barras de variante.
        search = (params.get('search') or '').strip()
        if search:
            from apps.variants.models import Variant
            has_variant = Variant.objects.filter(product=OuterRef('pk')).filter(
                Q(sku__icontains=search) | Q(barcode__icontains=search))
            qs = qs.filter(
                Q(name__icontains=search) | Q(slug__icontains=search) |
                Q(short_description__icontains=search) | Exists(has_variant)
            )

        # Filtro por tienda/sucursal: productos con stock en esa sucursal.
        if params.get('branch'):
            qs = qs.filter(
                variants__stocks__branch_id=params['branch'],
                variants__stocks__quantity__gt=0,
            ).distinct()

        # Scoping por rol: admin de local solo ve su tienda (y su sucursal).
        user = self.request.user
        if getattr(user, 'role', None) and user.role != 'SUPERADMIN':
            if user.tenant_id:
                qs = qs.filter(tenant_id=user.tenant_id)
            if user.role in ('BRANCH_MANAGER', 'SALESPERSON') and user.branch_id:
                qs = qs.filter(
                    variants__stocks__branch_id=user.branch_id,
                    variants__stocks__quantity__gt=0,
                ).distinct()
        return qs

    def _summary_base(self):
        """Catalogo visible por el rol (sin filtros de lista) para KPIs totales."""
        qs = Product.objects.filter(deleted_at__isnull=True)
        user = self.request.user
        if getattr(user, 'role', None) and user.role != 'SUPERADMIN':
            if user.tenant_id:
                qs = qs.filter(tenant_id=user.tenant_id)
            if user.role in ('BRANCH_MANAGER', 'SALESPERSON') and user.branch_id:
                qs = qs.filter(
                    variants__stocks__branch_id=user.branch_id,
                    variants__stocks__quantity__gt=0,
                ).distinct()
        return qs

    @action(detail=False, methods=['post'], url_path='bulk-tax',
            permission_classes=[permissions.IsAuthenticated, IsBranchManager])
    def bulk_tax(self, request):
        """Aplica un IVA a varios productos. Body:
        { "tax_rate": <numero|null>, "all": true }  o  { "tax_rate": .., "product_ids": [..] }.
        tax_rate = null -> el producto vuelve a usar el IVA global por defecto.
        """
        data = request.data or {}
        raw = data.get('tax_rate', None)
        tax_rate = None
        if raw not in (None, '', 'null'):
            try:
                tax_rate = round(float(raw), 2)
            except (TypeError, ValueError):
                return Response({'detail': 'IVA invalido.'}, status=status.HTTP_400_BAD_REQUEST)
            if tax_rate < 0 or tax_rate > 100:
                return Response({'detail': 'El IVA debe estar entre 0 y 100.'},
                                status=status.HTTP_400_BAD_REQUEST)
        qs = self.get_queryset()
        if not data.get('all'):
            ids = data.get('product_ids') or []
            if not ids:
                return Response({'detail': 'Selecciona al menos un producto.'},
                                status=status.HTTP_400_BAD_REQUEST)
            qs = qs.filter(pk__in=ids)
        updated = qs.update(tax_rate=tax_rate)
        return Response({'updated': updated, 'tax_rate': tax_rate})

    @action(detail=False, methods=['get'])
    def summary(self, request):
        """Totales del catalogo (no dependen de la pagina cargada)."""
        qs = self._summary_base()
        return Response({
            'total':     qs.count(),
            'published': qs.filter(status='PUBLISHED').count(),
            'draft':     qs.filter(status='DRAFT').count(),
            'paused':    qs.filter(status='PAUSED').count(),
            'archived':  qs.filter(status='ARCHIVED').count(),
            'featured':  qs.filter(is_featured=True).count(),
        })

    def get_serializer_class(self):
        if self.action in ('create', 'update', 'partial_update'):
            return ProductCreateUpdateSerializer
        return ProductSerializer

    def destroy(self, request, *args, **kwargs):
        """Borrado lógico (soft delete) del producto.

        No se elimina físicamente: se marca con `deleted_at` para ocultarlo en
        todo el sistema (catálogo, inventario, POS, kiosko) conservando el
        registro. Así las ventas ya realizadas (OrderItem, con snapshot de
        nombre/precio) permanecen intactas y el producto puede "eliminarse"
        siempre, tenga o no ventas."""
        product = self.get_object()
        name = product.name
        product.deleted_at = timezone.now()
        # Al eliminar lo despublicamos también para que no aparezca en ningún
        # listado que aún consulte por estado.
        product.status = 'ARCHIVED'
        product.save(update_fields=['deleted_at', 'status', 'updated_at'])
        return Response(
            {'detail': f'Producto "{name}" eliminado.'},
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=['post'])
    def toggle_featured(self, request, pk=None):
        p = self.get_object()
        p.is_featured = not p.is_featured
        p.save(update_fields=['is_featured', 'updated_at'])
        return Response({'detail': 'Destacado actualizado.', 'is_featured': p.is_featured})

    @action(detail=True, methods=['post'])
    def publish(self, request, pk=None):
        p = self.get_object()
        p.status = 'PUBLISHED'
        p.save(update_fields=['status', 'updated_at'])
        return Response({'detail': 'Producto publicado.', 'status': p.status})

    @action(detail=True, methods=['post'])
    def archive(self, request, pk=None):
        p = self.get_object()
        p.status = 'ARCHIVED'
        p.save(update_fields=['status', 'updated_at'])
        return Response({'detail': 'Producto archivado.', 'status': p.status})

    @action(detail=False, methods=['post'], url_path='bulk-status')
    def bulk_status(self, request):
        """Activa/desactiva varios productos a la vez. status: PUBLISHED | PAUSED."""
        ids = request.data.get('product_ids') or []
        new_status = (request.data.get('status') or '').upper()
        if new_status not in ('PUBLISHED', 'PAUSED', 'ARCHIVED', 'DRAFT'):
            return Response({'detail': 'Estado inválido.'}, status=400)
        qs = self.get_queryset().filter(pk__in=ids)
        updated = qs.update(status=new_status)
        return Response({'updated': updated, 'status': new_status})

    @action(detail=False, methods=['post'], url_path='bulk-delete')
    def bulk_delete(self, request):
        """Elimina varios productos a la vez (borrado lógico).

        Se marcan con `deleted_at` (y ARCHIVED) para ocultarlos en todo el
        sistema sin perder el registro; las ventas asociadas quedan intactas.
        Como es borrado lógico, todos los seleccionados se pueden eliminar."""
        ids = request.data.get('product_ids') or []
        qs = self.get_queryset().filter(pk__in=ids)
        deleted = qs.update(deleted_at=timezone.now(), status='ARCHIVED')
        return Response({'deleted': deleted, 'skipped': 0})

    @action(detail=False, methods=['get'], url_path='check-barcode')
    def check_barcode(self, request):
        """¿Existe ya un código de barras en la empresa? Devuelve el producto al
        que pertenece para avisar y enlazar. { exists, product_id, product_name }."""
        code = (request.query_params.get('code') or '').strip()
        if not code:
            return Response({'exists': False})
        from django.db.models import Q
        from apps.variants.models import Variant
        # El código escrito choca si ya existe como código de proveedor (barcode)
        # O como código interno (sku) de cualquier variante de la empresa.
        qs = Variant.objects.filter(
            Q(barcode__iexact=code) | Q(sku__iexact=code),
            product__deleted_at__isnull=True)
        tenant_id = getattr(request.user, 'tenant_id', None)
        if getattr(request.user, 'role', None) != 'SUPERADMIN' and tenant_id:
            qs = qs.filter(tenant_id=tenant_id)
        v = qs.select_related('product').first()
        if not v:
            return Response({'exists': False})
        return Response({
            'exists': True,
            'product_id': v.product_id,
            'product_name': v.product.name,
            'sku': v.sku,
            'matched': 'interno' if (v.sku or '').lower() == code.lower() else 'proveedor',
        })

    @action(detail=True, methods=['post'], url_path='add-variants')
    def add_variants(self, request, pk=None):
        """Agrega variantes NUEVAS a un producto existente sin tocar las que ya
        tiene. Body: { branch, variants: [{size, color, attributes, cost, price, quantity}] }.

        Si llegan cantidades y una sucursal, el ingreso se registra como una
        COMPRA (Recepción confirmada) y suma al inventario con su movimiento,
        igual que la recepción de mercadería."""
        from django.db import transaction
        from django.utils import timezone
        from apps.variants.models import Variant
        from apps.inventory.models import Stock, StockMovement, Reception, ReceptionItem, Supplier
        from apps.inventory.services import next_sku_number
        product = self.get_object()
        tenant = product.tenant
        branch_id = request.data.get('branch')
        items = request.data.get('variants') or []
        note = (request.data.get('note') or '').strip()
        existing = list(product.variants.all())
        actor = request.user if request.user.is_authenticated else None

        # Proveedor de la compra: por id o alta rápida por nombre (como en recepción).
        supplier = None
        if request.data.get('supplier'):
            supplier = Supplier.objects.filter(pk=request.data['supplier'], tenant=tenant).first()
        elif (request.data.get('supplier_name') or '').strip():
            supplier, _ = Supplier.objects.get_or_create(
                tenant=tenant, name=request.data['supplier_name'].strip())

        created = 0
        units = 0
        reception = None

        with transaction.atomic():
            seq = next_sku_number(tenant)
            for raw in items:
                size = (raw.get('size') or '').strip()
                color = (raw.get('color') or '').strip()
                attributes = raw.get('attributes') if isinstance(raw.get('attributes'), dict) else {}
                # Omitir si la variante ya existe (por atributos o por talla/color).
                dup = False
                for v in existing:
                    if attributes:
                        if (v.attributes or {}) == attributes:
                            dup = True
                            break
                    elif v.size == size and v.color == color:
                        dup = True
                        break
                if dup:
                    continue
                cost = raw.get('cost') or 0
                sku = f'P{seq:08d}'
                seq += 1
                variant = Variant.objects.create(
                    tenant=tenant, product=product, sku=sku,
                    size=size, color=color, attributes=attributes,
                    cost=cost,
                    price_override=(raw.get('price') or None),
                )
                existing.append(variant)
                try:
                    qty = max(0, int(raw.get('quantity') or 0))
                except (TypeError, ValueError):
                    qty = 0
                if branch_id and qty:
                    # Registra la compra la primera vez que hay cantidad real.
                    if reception is None:
                        reception = Reception.objects.create(
                            tenant=tenant, branch_id=branch_id, supplier=supplier,
                            note=(note or f'Lote agregado a "{product.name}"'),
                            created_by=actor,
                            status=Reception.STATUS_COMMITTED,
                            committed_at=timezone.now(),
                        )
                        reception.code = f"REC-{timezone.now():%Y%m%d}-{reception.pk:04d}"
                        reception.save(update_fields=['code'])
                    stock, _ = Stock.objects.select_for_update().get_or_create(
                        tenant=tenant, variant=variant, branch_id=branch_id,
                        defaults={'quantity': 0})
                    before = stock.quantity
                    stock.quantity = before + qty
                    stock.save(update_fields=['quantity', 'updated_at'])
                    StockMovement.objects.create(
                        tenant=tenant, stock=stock, type=StockMovement.TYPE_IN,
                        quantity=qty, note=f'Compra {reception.code}', actor=actor,
                        qty_before=before, qty_after=stock.quantity)
                    ReceptionItem.objects.create(
                        tenant=tenant, reception=reception, variant=variant,
                        branch_id=branch_id, quantity=qty, unit_cost=cost or 0)
                    units += qty
                elif branch_id:
                    # Variante nueva sin cantidad: se crea su registro de stock en 0.
                    Stock.objects.get_or_create(
                        tenant=tenant, variant=variant, branch_id=branch_id,
                        defaults={'quantity': 0})
                created += 1

        return Response({
            'created': created,
            'units': units,
            'reception_code': reception.code if reception else None,
        })

    @action(detail=True, methods=['get', 'post'], url_path='images')
    def manage_images(self, request, pk=None):
        product = self.get_object()
        if request.method == 'GET':
            data = ProductImageSerializer(product.images.all(), many=True).data
            return Response({'count': len(data), 'results': data})
        # POST: añadir una imagen
        serializer = ProductImageSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        img = ProductImage.objects.create(product=product, **serializer.validated_data)
        return Response(ProductImageSerializer(img).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['delete'], url_path='images/(?P<image_id>[^/.]+)')
    def delete_image(self, request, pk=None, image_id=None):
        product = self.get_object()
        product.images.filter(pk=image_id).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
