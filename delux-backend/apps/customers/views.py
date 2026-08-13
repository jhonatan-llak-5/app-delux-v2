from django.db.models import Sum, Count, Max
from rest_framework import filters, permissions, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.accounts.permissions import IsStaff, IsSalesStaff, IsManager
from .models import Customer
from .serializers import CustomerSerializer, CustomerCreateSerializer


class AdminCustomerViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated, IsStaff]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['full_name', 'email', 'phone', 'document_id']
    ordering_fields = ['full_name', 'created_at']
    ordering = ['-created_at']

    def get_permissions(self):
        # Buscar/consultar clientes: todo el staff (POS de vendedor y bodeguero,
        # además de gerente y superadmin). El POS necesita buscar el cliente frecuente.
        if self.request.method in permissions.SAFE_METHODS:
            return [permissions.IsAuthenticated(), IsStaff()]
        # Eliminar cliente: solo gerente/superadmin.
        if self.request.method == 'DELETE':
            return [permissions.IsAuthenticated(), IsManager()]
        # Crear/editar: personal de ventas (gerente + vendedor). Un vendedor puede
        # dar de alta un cliente en el momento de la venta.
        return [permissions.IsAuthenticated(), IsSalesStaff()]

    def get_queryset(self):
        from django.db.models import Q
        from apps.orders.models import OrderStatus
        qs = Customer.objects.prefetch_related('addresses').annotate(
            total_orders=Count('orders', distinct=True),
            total_spent=Sum('orders__total', filter=models_q_paid()),
            last_order_at=Max('orders__created_at'),
        )
        # Solo clientes reales: sin cuenta (mostrador/invitado/Consumidor Final)
        # o cuentas de rol CUSTOMER. Excluye staff (admin/gerente/vendedor/afiliado)
        # que hayan generado ficha al usar funciones de cliente (favoritos, reseñas…).
        qs = qs.filter(Q(user__isnull=True) | Q(user__role='CUSTOMER'))
        return qs

    def get_serializer_class(self):
        if self.action in ('create', 'update', 'partial_update'):
            return CustomerCreateSerializer
        return CustomerSerializer

    @action(detail=False, methods=['get'])
    def summary(self, request):
        from apps.orders.models import OrderStatus
        qs = self.get_queryset()
        return Response({
            'total_customers': qs.count(),
            'with_purchases': qs.filter(total_orders__gt=0).count(),
            'marketing_subscribers': qs.filter(accepts_marketing=True).count(),
        })


# Helper Q de PAID
def models_q_paid():
    from django.db.models import Q
    return Q(orders__status='PAID')
