from django.db.models import Sum
from django.utils import timezone
from rest_framework import filters, permissions, viewsets
from rest_framework.response import Response
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
        qs = Variant.objects.filter(product__deleted_at__isnull=True).select_related('product').annotate(
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

    def destroy(self, request, *args, **kwargs):
        """Borrado lógico de una sola variante (talla/color): se marca
        is_active=False para ocultarla del inventario, catálogo y POS sin
        perder las ventas asociadas. Si era la última variante activa del
        producto, el producto queda sin nada vendible, así que también se
        elimina (borrado lógico)."""
        variant = self.get_object()
        product = variant.product
        variant.is_active = False
        variant.save(update_fields=['is_active'])

        remaining = product.variants.filter(is_active=True).count()
        product_deleted = False
        if remaining == 0 and product.deleted_at is None:
            product.deleted_at = timezone.now()
            product.status = 'ARCHIVED'
            product.save(update_fields=['deleted_at', 'status', 'updated_at'])
            product_deleted = True

        return Response({
            'detail': 'Variante eliminada.',
            'product_deleted': product_deleted,
        })
