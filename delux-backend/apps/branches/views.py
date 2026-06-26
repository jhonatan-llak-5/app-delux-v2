from django.db.models import Count, Q
from rest_framework import permissions, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.accounts.permissions import IsBranchManager

from .models import Branch
from .serializers import BranchSerializer


class AdminBranchViewSet(viewsets.ModelViewSet):
    serializer_class = BranchSerializer
    permission_classes = [permissions.IsAuthenticated, IsBranchManager]

    def get_queryset(self):
        qs = (
            Branch.objects
            .select_related('tenant', 'manager')
            .annotate(
                products_count=Count(
                    'stocks__variant__product',
                    filter=Q(stocks__quantity__gt=0),
                    distinct=True,
                )
            )
            .order_by('name')
        )
        tenant_slug = self.request.query_params.get('tenant_slug')
        if tenant_slug:
            qs = qs.filter(tenant__slug=tenant_slug)
        return qs

    def _resolve_tenant(self):
        from apps.tenants.models import Tenant
        slug = (self.request.data.get('tenant_slug')
                or self.request.query_params.get('tenant_slug'))
        tenant = Tenant.objects.filter(slug=slug).first() if slug else None
        return tenant or Tenant.objects.filter(is_active=True).first()

    def perform_create(self, serializer):
        serializer.save(tenant=self._resolve_tenant())

    @action(detail=True, methods=['get'], url_path='usage')
    def usage(self, request, pk=None):
        """Resumen de lo que tiene la sucursal (para confirmar antes de eliminar)."""
        from django.contrib.auth import get_user_model
        from apps.inventory.models import Stock
        from apps.orders.models import Order
        branch = self.get_object()
        products = (Stock.objects.filter(branch=branch, quantity__gt=0)
                    .values('variant__product').distinct().count())
        staff = get_user_model().objects.filter(branch=branch).count()
        orders = Order.objects.filter(branch=branch).count()
        return Response({
            'products_count': products,
            'staff_count': staff,
            'orders_count': orders,
        })

    @action(detail=True, methods=['get'], url_path='catalog')
    def catalog(self, request, pk=None):
        from apps.products.serializers import ProductWithStockSerializer
        from apps.products.models import Product

        branch = self.get_object()
        products = (
            Product.objects.filter(
                tenant=branch.tenant,
                variants__stocks__branch=branch,
                variants__stocks__quantity__gt=0,
            )
            .select_related('brand', 'category')
            .distinct()
            .order_by('-created_at')
        )

        serializer = ProductWithStockSerializer(
            products, many=True, context={'branch': branch}
        )
        return Response({
            'branch': BranchSerializer(branch).data,
            'count': products.count(),
            'results': serializer.data,
        })
