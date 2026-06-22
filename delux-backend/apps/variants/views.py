from django.db.models import Sum
from rest_framework import filters, permissions, viewsets
from apps.accounts.permissions import IsBranchManager
from .models import Variant
from .serializers import VariantSerializer, VariantCreateUpdateSerializer


class AdminVariantViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated, IsBranchManager]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['sku', 'product__name', 'size', 'color']
    ordering_fields = ['sku', 'created_at']
    ordering = ['-created_at']

    def get_queryset(self):
        qs = Variant.objects.select_related('product').annotate(
            total_stock=Sum('stocks__quantity')
        )
        product_id = self.request.query_params.get('product')
        if product_id:
            qs = qs.filter(product_id=product_id)
        return qs

    def get_serializer_class(self):
        if self.action in ('create', 'update', 'partial_update'):
            return VariantCreateUpdateSerializer
        return VariantSerializer
