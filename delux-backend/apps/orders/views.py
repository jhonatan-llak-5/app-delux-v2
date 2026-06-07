from django.db.models import Count, Sum, Q
from django.utils import timezone
from rest_framework import filters, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.accounts.permissions import IsSuperadmin
from .models import Order, OrderStatus
from .serializers import OrderSerializer, POSCheckoutSerializer


class AdminOrderViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = OrderSerializer
    permission_classes = [permissions.IsAuthenticated, IsSuperadmin]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['code', 'customer__full_name', 'customer__email']
    ordering_fields = ['created_at', 'total', 'code']
    ordering = ['-created_at']

    def get_queryset(self):
        qs = (
            Order.objects
            .select_related('branch', 'customer', 'seller')
            .prefetch_related('items')
            .annotate(items_count=Count('items'))
        )
        params = self.request.query_params
        if params.get('branch'):   qs = qs.filter(branch_id=params['branch'])
        if params.get('status'):   qs = qs.filter(status=params['status'])
        if params.get('channel'):  qs = qs.filter(channel=params['channel'])
        if params.get('date_from'):
            qs = qs.filter(created_at__date__gte=params['date_from'])
        if params.get('date_to'):
            qs = qs.filter(created_at__date__lte=params['date_to'])
        return qs

    @action(detail=False, methods=['post'], url_path='pos-checkout')
    def pos_checkout(self, request):
        serializer = POSCheckoutSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        order = serializer.save()
        return Response(OrderSerializer(order).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        order = self.get_object()
        if order.status in (OrderStatus.CANCELLED, OrderStatus.REFUNDED):
            return Response({'detail': 'Ya estaba cancelada.'}, status=400)
        order.status = OrderStatus.CANCELLED
        order.save(update_fields=['status', 'updated_at'])
        return Response({'detail': 'Orden cancelada.'})

    @action(detail=False, methods=['get'])
    def summary(self, request):
        params = request.query_params
        qs = self.get_queryset()
        today = timezone.now().date()
        today_qs = qs.filter(created_at__date=today)
        return Response({
            'total_orders': qs.count(),
            'total_revenue': qs.filter(status=OrderStatus.PAID).aggregate(t=Sum('total'))['t'] or 0,
            'today_orders': today_qs.count(),
            'today_revenue': today_qs.filter(status=OrderStatus.PAID).aggregate(t=Sum('total'))['t'] or 0,
            'pending': qs.filter(status=OrderStatus.PENDING).count(),
            'paid': qs.filter(status=OrderStatus.PAID).count(),
            'cancelled': qs.filter(status=OrderStatus.CANCELLED).count(),
        })
