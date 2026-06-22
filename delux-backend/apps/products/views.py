from django.db.models import Count, Sum, Q
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

    def get_serializer_class(self):
        if self.action in ('create', 'update', 'partial_update'):
            return ProductCreateUpdateSerializer
        return ProductSerializer

    def destroy(self, request, *args, **kwargs):
        """Borrado físico del producto (cascade: variantes, stock, imágenes).

        Si el producto tiene ventas registradas (OrderItem PROTECT sobre la
        variante) no se puede borrar sin perder historial: se sugiere archivar.
        """
        product = self.get_object()
        from apps.orders.models import OrderItem
        if OrderItem.objects.filter(variant__product=product).exists():
            return Response(
                {'detail': 'No se puede eliminar: el producto tiene ventas registradas. '
                           'Archívalo en su lugar.'},
                status=status.HTTP_409_CONFLICT,
            )
        name = product.name
        product.delete()
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
