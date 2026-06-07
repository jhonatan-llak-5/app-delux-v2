from django.contrib.auth import get_user_model
from django.db.models import Count, Sum, Q
from django.utils import timezone
from rest_framework import filters, permissions, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .permissions import IsBranchManager
from .staff_serializers import StaffSerializer, StaffCreateSerializer

User = get_user_model()


class StaffViewSet(viewsets.ModelViewSet):
    """CRUD de staff (gerentes + vendedores).
    BRANCH_MANAGER solo ve/edita su sucursal.
    """
    permission_classes = [permissions.IsAuthenticated, IsBranchManager]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['email', 'full_name', 'phone']
    ordering_fields = ['full_name', 'date_joined', 'commission_rate']
    ordering = ['-date_joined']

    def get_queryset(self):
        qs = User.objects.select_related('branch', 'tenant').filter(
            role__in=['BRANCH_MANAGER', 'SALESPERSON']
        )
        user = self.request.user
        if user.role == 'BRANCH_MANAGER':
            qs = qs.filter(branch=user.branch)
        params = self.request.query_params
        if params.get('branch'): qs = qs.filter(branch_id=params['branch'])
        if params.get('role'):   qs = qs.filter(role=params['role'])
        if params.get('is_active') in ('true', 'false'):
            qs = qs.filter(is_active=(params['is_active'] == 'true'))
        return qs

    def get_serializer_class(self):
        if self.action in ('create', 'update', 'partial_update'):
            return StaffCreateSerializer
        return StaffSerializer

    @action(detail=True, methods=['post'])
    def toggle_active(self, request, pk=None):
        u = self.get_object()
        u.is_active = not u.is_active
        u.save(update_fields=['is_active'])
        return Response({'is_active': u.is_active})

    @action(detail=True, methods=['get'])
    def sales_metrics(self, request, pk=None):
        """KPIs de ventas del vendedor."""
        u = self.get_object()
        from apps.orders.models import Order, OrderStatus
        qs = Order.objects.filter(seller=u, status=OrderStatus.PAID)
        today = timezone.now().date()
        today_qs = qs.filter(created_at__date=today)
        return Response({
            'total_sales': qs.count(),
            'total_revenue': float(qs.aggregate(t=Sum('total'))['t'] or 0),
            'today_sales': today_qs.count(),
            'today_revenue': float(today_qs.aggregate(t=Sum('total'))['t'] or 0),
            'commission_total': float((qs.aggregate(t=Sum('total'))['t'] or 0) * float(u.commission_rate) / 100),
        })
