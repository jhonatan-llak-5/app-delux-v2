from django.db import transaction
from django.db.models import Sum, Count, F, Q
from rest_framework import filters, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.accounts.permissions import IsSuperadmin
from apps.variants.models import Variant
from .models import Stock, StockMovement
from .serializers import (
    StockSerializer, StockAdjustSerializer,
    StockMovementSerializer, TransferSerializer,
)


class AdminStockViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = StockSerializer
    permission_classes = [permissions.IsAuthenticated, IsSuperadmin]
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
    permission_classes = [permissions.IsAuthenticated, IsSuperadmin]
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
