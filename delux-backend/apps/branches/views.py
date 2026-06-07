from django.db.models import Count, Q
from rest_framework import permissions, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.accounts.permissions import IsSuperadmin

from .models import Branch
from .serializers import BranchSerializer


class AdminBranchViewSet(viewsets.ModelViewSet):
    serializer_class = BranchSerializer
    permission_classes = [permissions.IsAuthenticated, IsSuperadmin]

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
