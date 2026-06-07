from django.db.models import Count, Q
from rest_framework import filters, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.accounts.permissions import IsSuperadmin

from .models import Brand
from .serializers import BrandSerializer, BrandCreateUpdateSerializer


class AdminBrandViewSet(viewsets.ModelViewSet):
    """CRUD completo de marcas (solo Superadmin)."""
    permission_classes = [permissions.IsAuthenticated, IsSuperadmin]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'slug', 'country_of_origin']
    ordering_fields = ['name', 'sort_order', 'created_at', 'products_count']
    ordering = ['sort_order', 'name']
    lookup_field = 'slug'

    def get_serializer_class(self):
        if self.action in ('create', 'update', 'partial_update'):
            return BrandCreateUpdateSerializer
        return BrandSerializer

    def get_queryset(self):
        qs = Brand.objects.annotate(
            products_count=Count('product_set', distinct=True),
            active_products_count=Count(
                'product_set',
                filter=Q(product_set__status='PUBLISHED'),
                distinct=True,
            ),
        )
        # Filtros opcionales
        is_active = self.request.query_params.get('is_active')
        if is_active is not None:
            qs = qs.filter(is_active=is_active.lower() in ('true', '1'))
        is_featured = self.request.query_params.get('is_featured')
        if is_featured is not None:
            qs = qs.filter(is_featured=is_featured.lower() in ('true', '1'))
        return qs

    @action(detail=True, methods=['post'])
    def toggle_active(self, request, slug=None):
        brand = self.get_object()
        brand.is_active = not brand.is_active
        brand.save(update_fields=['is_active'])
        return Response({'is_active': brand.is_active})

    @action(detail=True, methods=['post'])
    def toggle_featured(self, request, slug=None):
        brand = self.get_object()
        brand.is_featured = not brand.is_featured
        brand.save(update_fields=['is_featured'])
        return Response({'is_featured': brand.is_featured})

    def perform_create(self, serializer):
        # Asociar al tenant por slug (resuelto por middleware)
        from apps.tenants.models import Tenant
        slug = getattr(self.request, 'tenant_slug', 'delux')
        tenant = Tenant.objects.filter(slug=slug).first()
        if not tenant:
            tenant = Tenant.objects.first()
        serializer.save(tenant=tenant)
