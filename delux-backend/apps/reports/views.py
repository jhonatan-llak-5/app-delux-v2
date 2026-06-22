"""Endpoints de reportes y dashboards: agregaciones de ventas, inventario, vendedores."""
from datetime import timedelta
from decimal import Decimal

from django.db.models import Sum, Count, F, Q, DecimalField, Value
from django.db.models.functions import TruncDate, Coalesce
from django.utils import timezone
from rest_framework import permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.viewsets import ViewSet

from apps.accounts.permissions import IsBranchManager
from apps.orders.models import Order, OrderItem, OrderStatus


def parse_range(request):
    """Lee `from` y `to` de la query (YYYY-MM-DD). Default: últimos 30 días."""
    now = timezone.now().date()
    to_str = request.query_params.get('to')
    from_str = request.query_params.get('from')
    to_d = timezone.datetime.fromisoformat(to_str).date() if to_str else now
    from_d = timezone.datetime.fromisoformat(from_str).date() if from_str else (to_d - timedelta(days=29))
    return from_d, to_d


def base_orders_qs(request):
    qs = Order.objects.filter(status=OrderStatus.PAID)
    from_d, to_d = parse_range(request)
    qs = qs.filter(created_at__date__gte=from_d, created_at__date__lte=to_d)
    branch = request.query_params.get('branch')
    if branch:
        qs = qs.filter(branch_id=branch)
    # Aislamiento: gerente de sucursal solo ve la suya.
    user = getattr(request, 'user', None)
    if user and getattr(user, 'role', None) == 'BRANCH_MANAGER' and user.branch_id:
        qs = qs.filter(branch_id=user.branch_id)
    return qs, from_d, to_d


class ReportsViewSet(ViewSet):
    permission_classes = [permissions.IsAuthenticated, IsBranchManager]

    @action(detail=False, methods=['get'])
    def overview(self, request):
        """KPIs principales: revenue, órdenes, AOV, conversion (simulada)."""
        qs, from_d, to_d = base_orders_qs(request)
        total_revenue = qs.aggregate(t=Sum('total'))['t'] or Decimal('0')
        total_orders = qs.count()
        aov = (total_revenue / total_orders) if total_orders else Decimal('0')
        items_sold = OrderItem.objects.filter(order__in=qs).aggregate(t=Sum('quantity'))['t'] or 0
        unique_customers = qs.values('customer').distinct().count()

        # Comparativa periodo anterior
        period_days = (to_d - from_d).days + 1
        prev_from = from_d - timedelta(days=period_days)
        prev_to = from_d - timedelta(days=1)
        prev_qs = Order.objects.filter(status=OrderStatus.PAID,
                                        created_at__date__gte=prev_from,
                                        created_at__date__lte=prev_to)
        if request.query_params.get('branch'):
            prev_qs = prev_qs.filter(branch_id=request.query_params['branch'])
        if getattr(request.user, 'role', None) == 'BRANCH_MANAGER' and request.user.branch_id:
            prev_qs = prev_qs.filter(branch_id=request.user.branch_id)
        prev_revenue = prev_qs.aggregate(t=Sum('total'))['t'] or Decimal('0')
        prev_orders = prev_qs.count()

        def delta(curr, prev):
            if not prev:
                return None
            return round(float((curr - prev) / prev * 100), 1)

        return Response({
            'from': str(from_d),
            'to': str(to_d),
            'total_revenue': str(total_revenue),
            'total_orders': total_orders,
            'avg_order_value': str(round(aov, 2)),
            'items_sold': items_sold,
            'unique_customers': unique_customers,
            'revenue_delta_pct': delta(total_revenue, prev_revenue),
            'orders_delta_pct': delta(Decimal(total_orders), Decimal(prev_orders)),
        })

    @action(detail=False, methods=['get'])
    def timeline(self, request):
        """Serie temporal diaria: revenue + órdenes por día."""
        qs, from_d, to_d = base_orders_qs(request)
        rows = (qs.annotate(day=TruncDate('created_at'))
                  .values('day')
                  .annotate(revenue=Sum('total'), orders=Count('id'))
                  .order_by('day'))
        data = list(rows)
        # Llenar días vacíos con ceros
        existing = {r['day']: r for r in data}
        out = []
        d = from_d
        while d <= to_d:
            r = existing.get(d)
            out.append({
                'day': str(d),
                'revenue': str(r['revenue']) if r else '0.00',
                'orders': r['orders'] if r else 0,
            })
            d += timedelta(days=1)
        return Response({'results': out})

    @action(detail=False, methods=['get'])
    def by_branch(self, request):
        qs, _, _ = base_orders_qs(request)
        rows = list(
            qs.values('branch_id', 'branch__name', 'branch__code')
              .annotate(revenue=Sum('total'), orders=Count('id'))
              .order_by('-revenue')
        )
        return Response({'results': rows})

    @action(detail=False, methods=['get'])
    def by_category(self, request):
        qs, _, _ = base_orders_qs(request)
        items = (
            OrderItem.objects.filter(order__in=qs)
            .values('variant__product__category_id', 'variant__product__category__name')
            .annotate(
                revenue=Sum(F('quantity') * F('unit_price'),
                            output_field=DecimalField(max_digits=12, decimal_places=2)),
                units=Sum('quantity'),
            )
            .order_by('-revenue')
        )
        return Response({'results': list(items)})

    @action(detail=False, methods=['get'])
    def by_brand(self, request):
        qs, _, _ = base_orders_qs(request)
        items = (
            OrderItem.objects.filter(order__in=qs)
            .values('variant__product__brand_id', 'variant__product__brand__name')
            .annotate(
                revenue=Sum(F('quantity') * F('unit_price'),
                            output_field=DecimalField(max_digits=12, decimal_places=2)),
                units=Sum('quantity'),
            )
            .order_by('-revenue')
        )
        return Response({'results': list(items)})

    @action(detail=False, methods=['get'])
    def top_products(self, request):
        qs, _, _ = base_orders_qs(request)
        limit = int(request.query_params.get('limit', 10))
        items = (
            OrderItem.objects.filter(order__in=qs)
            .values('variant__product_id', 'variant__product__name',
                    'variant__product__main_image_url',
                    'variant__product__brand__name')
            .annotate(
                revenue=Sum(F('quantity') * F('unit_price'),
                            output_field=DecimalField(max_digits=12, decimal_places=2)),
                units=Sum('quantity'),
            )
            .order_by('-revenue')[:limit]
        )
        return Response({'results': list(items)})

    @action(detail=False, methods=['get'])
    def top_sellers(self, request):
        qs, _, _ = base_orders_qs(request)
        items = (
            qs.exclude(seller__isnull=True)
              .values('seller_id', 'seller__full_name', 'seller__email',
                      'seller__commission_rate', 'seller__branch__name')
              .annotate(revenue=Sum('total'), orders=Count('id'))
              .order_by('-revenue')[:10]
        )
        # Calcular comisión
        results = []
        for it in items:
            rate = it.get('seller__commission_rate') or 0
            commission = float(it['revenue'] or 0) * float(rate) / 100
            results.append({
                **it,
                'commission': round(commission, 2),
            })
        return Response({'results': results})

    @action(detail=False, methods=['get'])
    def by_channel(self, request):
        qs, _, _ = base_orders_qs(request)
        items = (
            qs.values('channel')
              .annotate(revenue=Sum('total'), orders=Count('id'))
              .order_by('-revenue')
        )
        return Response({'results': list(items)})

    @action(detail=False, methods=['get'])
    def low_stock(self, request):
        """Alertas de stock bajo (no requiere rango)."""
        from apps.inventory.models import Stock
        _u = request.user
        _branch = request.query_params.get('branch')
        if getattr(_u, 'role', None) == 'BRANCH_MANAGER' and _u.branch_id:
            _branch = _u.branch_id
        stock_qs = Stock.objects.filter(quantity__lte=F('min_threshold'))
        if _branch:
            stock_qs = stock_qs.filter(branch_id=_branch)
        qs = (
            stock_qs
            .select_related('variant__product', 'branch')
            .order_by('quantity')[:20]
        )
        results = [{
            'variant_sku': s.variant.sku,
            'product_name': s.variant.product.name,
            'branch_name': s.branch.name,
            'quantity': s.quantity,
            'min_threshold': s.min_threshold,
        } for s in qs]
        return Response({'results': results})
