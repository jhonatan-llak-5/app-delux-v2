from django.db.models import Count, Sum, Q
from rest_framework import filters, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.accounts.permissions import IsSuperadmin
from .models import Product, ProductImage
from .serializers import (
    ProductSerializer,
    ProductCreateUpdateSerializer,
    ProductImageSerializer,
)


class AdminProductViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated, IsSuperadmin]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'slug', 'short_description']
    ordering_fields = ['name', 'base_price', 'created_at']
    ordering = ['-created_at']

    def get_queryset(self):
        qs = (
            Product.objects
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
        return qs

    def get_serializer_class(self):
        if self.action in ('create', 'update', 'partial_update'):
            return ProductCreateUpdateSerializer
        return ProductSerializer

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
