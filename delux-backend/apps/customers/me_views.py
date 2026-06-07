"""Endpoints /me/* para el cliente autenticado."""
from django.db.models import Sum, Count
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.products.models import Product
from .models import Customer, Address, WishlistItem
from .serializers import AddressSerializer


def get_or_create_customer_for_user(user):
    """Asegura que cada User tenga un Customer asociado."""
    from apps.tenants.models import Tenant
    if hasattr(user, 'customer_profile') and user.customer_profile:
        return user.customer_profile
    tenant = user.tenant or Tenant.objects.filter(is_active=True).first()
    customer, _ = Customer.objects.get_or_create(
        tenant=tenant, user=user,
        defaults={
            'full_name': user.full_name or user.email,
            'email': user.email,
        },
    )
    return customer


class MeProfileView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        c = get_or_create_customer_for_user(request.user)
        agg = c.orders.filter(status='PAID').aggregate(
            total_spent=Sum('total'), total_orders=Count('id'),
        )
        return Response({
            'id': c.id,
            'full_name': c.full_name,
            'email': c.email,
            'phone': c.phone,
            'document_id': c.document_id,
            'accepts_marketing': c.accepts_marketing,
            'total_orders': agg['total_orders'] or 0,
            'total_spent': str(agg['total_spent'] or '0.00'),
        })

    def patch(self, request):
        c = get_or_create_customer_for_user(request.user)
        for f in ('full_name', 'phone', 'document_id', 'accepts_marketing'):
            if f in request.data:
                setattr(c, f, request.data[f])
        c.save()
        # Sync con User
        if request.data.get('full_name'):
            request.user.full_name = request.data['full_name']
            request.user.save(update_fields=['full_name'])
        return self.get(request)


class MeAddressesViewSet(viewsets.ModelViewSet):
    serializer_class = AddressSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        c = get_or_create_customer_for_user(self.request.user)
        return c.addresses.all()

    def perform_create(self, serializer):
        c = get_or_create_customer_for_user(self.request.user)
        serializer.save(customer=c, tenant=c.tenant)

    @action(detail=True, methods=['post'])
    def set_default(self, request, pk=None):
        c = get_or_create_customer_for_user(request.user)
        c.addresses.update(is_default=False)
        addr = self.get_object()
        addr.is_default = True
        addr.save(update_fields=['is_default'])
        return Response({'detail': 'Dirección predeterminada actualizada.'})


class MeOrdersView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        c = get_or_create_customer_for_user(request.user)
        from apps.orders.serializers import OrderSerializer
        orders = c.orders.select_related('branch').prefetch_related('items').order_by('-created_at')
        return Response({
            'count': orders.count(),
            'results': OrderSerializer(orders, many=True).data,
        })


class MeWishlistView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        c = get_or_create_customer_for_user(request.user)
        items = c.wishlist_items.select_related(
            'product', 'product__brand'
        ).order_by('-created_at')
        results = [{
            'id': wi.id,
            'product_id': wi.product.id,
            'name': wi.product.name,
            'slug': wi.product.slug,
            'brand_name': wi.product.brand.name,
            'main_image_url': wi.product.main_image_url,
            'base_price': str(wi.product.base_price),
            'compare_at_price': str(wi.product.compare_at_price) if wi.product.compare_at_price else None,
            'created_at': wi.created_at,
        } for wi in items]
        return Response({'count': len(results), 'results': results})

    def post(self, request):
        c = get_or_create_customer_for_user(request.user)
        product_id = request.data.get('product_id')
        if not product_id:
            return Response({'detail': 'product_id requerido.'}, status=400)
        product = Product.objects.filter(pk=product_id).first()
        if not product:
            return Response({'detail': 'Producto no existe.'}, status=404)
        item, created = WishlistItem.objects.get_or_create(
            tenant=c.tenant, customer=c, product=product
        )
        return Response({
            'detail': 'Añadido a favoritos.' if created else 'Ya estaba en favoritos.',
            'created': created,
            'id': item.id,
        }, status=201 if created else 200)


class MeWishlistDeleteView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request, product_id):
        c = get_or_create_customer_for_user(request.user)
        WishlistItem.objects.filter(customer=c, product_id=product_id).delete()
        return Response(status=204)
