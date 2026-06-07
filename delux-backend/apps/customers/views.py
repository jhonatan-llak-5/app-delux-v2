from django.db.models import Sum, Count, Max
from rest_framework import filters, permissions, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.accounts.permissions import IsBranchManager
from .models import Customer
from .serializers import CustomerSerializer, CustomerCreateSerializer


class AdminCustomerViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated, IsBranchManager]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['full_name', 'email', 'phone', 'document_id']
    ordering_fields = ['full_name', 'created_at']
    ordering = ['-created_at']

    def get_queryset(self):
        from apps.orders.models import OrderStatus
        qs = Customer.objects.prefetch_related('addresses').annotate(
            total_orders=Count('orders', distinct=True),
            total_spent=Sum('orders__total', filter=models_q_paid()),
            last_order_at=Max('orders__created_at'),
        )
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
