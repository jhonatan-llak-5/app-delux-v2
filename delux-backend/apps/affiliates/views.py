from django.db.models import Sum, Count, Q
from django.db.models.functions import TruncMonth
from rest_framework import permissions, viewsets, filters, status as http_status
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from apps.accounts.models import Role, User
from apps.accounts.permissions import IsBranchManager
from apps.orders.models import Order, OrderStatus
from .models import Commission, CommissionStatus, CommissionPayout
from .serializers import (
    CommissionSerializer, AffiliateAdminSerializer,
    PayoutSerializer, PayoutCreateSerializer,
)
from .services import pay_affiliate_commissions


def _decimal(v):
    return float(v or 0)


def _tenant_scope(qs, user, field='tenant_id'):
    """Aisla por tenant salvo superadmin."""
    if getattr(user, 'role', None) and user.role != 'SUPERADMIN' and user.tenant_id:
        return qs.filter(**{field: user.tenant_id})
    return qs


class MyCommissionViewSet(viewsets.ReadOnlyModelViewSet):
    """Comisiones del afiliado autenticado + resumen."""
    serializer_class = CommissionSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [filters.OrderingFilter]
    ordering = ['-created_at']

    def get_queryset(self):
        return (Commission.objects
                .filter(affiliate=self.request.user)
                .select_related('order', 'order__customer', 'affiliate'))

    @action(detail=False, methods=['get'])
    def summary(self, request):
        user = request.user
        commissions = Commission.objects.filter(affiliate=user)
        orders = Order.objects.filter(affiliate=user)
        pend = commissions.filter(status=CommissionStatus.APPROVED).aggregate(s=Sum('amount'))['s']
        paid = commissions.filter(status=CommissionStatus.PAID).aggregate(s=Sum('amount'))['s']
        # Ventas aun en proceso (sin comision generada todavia).
        in_progress = orders.filter(
            status__in=[OrderStatus.PENDING, OrderStatus.PREPARING, OrderStatus.SHIPPED]
        ).count()
        return Response({
            'orders_count': orders.count(),
            'sales_with_commission': commissions.exclude(status=CommissionStatus.CANCELLED).count(),
            'sales_in_progress': in_progress,
            'commission_pending': _decimal(pend),
            'commission_paid': _decimal(paid),
            'commission_total': _decimal(pend) + _decimal(paid),
        })

    @action(detail=False, methods=['get'])
    def monthly(self, request):
        """Ventas y comisiones por mes (ultimos 6 meses) para la grafica."""
        import datetime
        from django.utils import timezone as _tz
        user = request.user
        today = _tz.now().date().replace(day=1)
        # Construye los ultimos 6 meses (incluye el actual).
        months = []
        y, m = today.year, today.month
        for _ in range(6):
            months.append((y, m))
            m -= 1
            if m == 0:
                m = 12
                y -= 1
        months.reverse()

        rows = (Commission.objects
                .filter(affiliate=user)
                .exclude(status=CommissionStatus.CANCELLED)
                .annotate(month=TruncMonth('created_at'))
                .values('month')
                .annotate(sales=Count('id'), total=Sum('amount'))
                .order_by('month'))
        by_key = {}
        for r in rows:
            mo = r['month']
            if mo:
                by_key[(mo.year, mo.month)] = r

        labels_es = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
        data = []
        for (yy, mm) in months:
            r = by_key.get((yy, mm))
            data.append({
                'label': f'{labels_es[mm - 1]} {str(yy)[2:]}',
                'sales': (r['sales'] if r else 0) or 0,
                'commission': _decimal(r['total']) if r else 0.0,
            })
        return Response(data)


class AdminAffiliateViewSet(viewsets.ViewSet):
    """Gestion admin: lista de afiliados con comisiones acumuladas."""
    permission_classes = [permissions.IsAuthenticated, IsBranchManager]

    def list(self, request):
        users = _tenant_scope(User.objects.filter(role=Role.AFFILIATE), request.user)
        search = (request.query_params.get('search') or '').strip()
        if search:
            users = users.filter(
                Q(full_name__icontains=search) | Q(email__icontains=search)
                | Q(ref_code__icontains=search))
        users = users.order_by('-date_joined')

        # Agregados de comision por afiliado (una sola consulta).
        agg = {
            row['affiliate_id']: row
            for row in Commission.objects.filter(affiliate__in=users)
            .values('affiliate_id')
            .annotate(
                pending=Sum('amount', filter=Q(status=CommissionStatus.APPROVED)),
                paid=Sum('amount', filter=Q(status=CommissionStatus.PAID)),
                sales=Count('id', filter=~Q(status=CommissionStatus.CANCELLED)),
            )
        }
        data = []
        for u in users:
            a = agg.get(u.id, {})
            data.append({
                'id': u.id,
                'full_name': u.full_name or u.username,
                'email': u.email,
                'ref_code': u.ref_code or '',
                'is_active': u.is_active,
                'date_joined': u.date_joined,
                'sales_count': a.get('sales') or 0,
                'commission_pending': _decimal(a.get('pending')),
                'commission_paid': _decimal(a.get('paid')),
            })
        return Response(AffiliateAdminSerializer(data, many=True).data)


class AdminCommissionViewSet(viewsets.ReadOnlyModelViewSet):
    """Todas las comisiones del tenant (para el admin), con filtros."""
    serializer_class = CommissionSerializer
    permission_classes = [permissions.IsAuthenticated, IsBranchManager]
    filter_backends = [filters.OrderingFilter]
    ordering = ['-created_at']

    def get_queryset(self):
        qs = (Commission.objects
              .select_related('order', 'order__customer', 'affiliate'))
        qs = _tenant_scope(qs, self.request.user)
        p = self.request.query_params
        if p.get('affiliate'):
            qs = qs.filter(affiliate_id=p['affiliate'])
        if p.get('status'):
            qs = qs.filter(status=p['status'])
        return qs


class AdminPayoutViewSet(viewsets.ReadOnlyModelViewSet):
    """Historial de pagos de comisiones + registro de pago manual."""
    serializer_class = PayoutSerializer
    permission_classes = [permissions.IsAuthenticated, IsBranchManager]
    filter_backends = [filters.OrderingFilter]
    ordering = ['-created_at']

    def get_queryset(self):
        qs = CommissionPayout.objects.select_related('affiliate', 'paid_by')
        qs = _tenant_scope(qs, self.request.user)
        if self.request.query_params.get('affiliate'):
            qs = qs.filter(affiliate_id=self.request.query_params['affiliate'])
        return qs

    def create(self, request):
        ser = PayoutCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data

        affiliate = _tenant_scope(
            User.objects.filter(role=Role.AFFILIATE), request.user
        ).filter(id=data['affiliate']).first()
        if not affiliate:
            raise ValidationError({'affiliate': 'Afiliado no encontrado.'})

        try:
            payout = pay_affiliate_commissions(
                affiliate=affiliate,
                method=data['method'],
                reference=data.get('reference', ''),
                paid_by=request.user,
                commission_ids=data.get('commission_ids'),
            )
        except ValueError as e:
            raise ValidationError({'detail': str(e)})

        return Response(PayoutSerializer(payout).data,
                        status=http_status.HTTP_201_CREATED)
