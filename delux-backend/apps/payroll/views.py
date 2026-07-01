from django.db.models import Sum, Count
from rest_framework import viewsets, permissions, filters
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from apps.accounts.permissions import IsBranchManager
from apps.branches.models import Branch
from .models import PayrollRun
from .serializers import (
    PayrollRunSerializer, PayrollRunDetailSerializer, PayrollGenerateSerializer,
)
from .models import PayrollItem
from .services import generate_payroll, pay_item, unpay_item, pay_all


class PayrollViewSet(viewsets.ReadOnlyModelViewSet):
    """Nomina de empleados: listar corridas, detalle y generar."""
    permission_classes = [permissions.IsAuthenticated, IsBranchManager]
    filter_backends = [filters.OrderingFilter]
    ordering = ['-year', '-month']

    def get_serializer_class(self):
        return PayrollRunDetailSerializer if self.action == 'retrieve' else PayrollRunSerializer

    def get_queryset(self):
        user = self.request.user
        qs = PayrollRun.objects.select_related('branch', 'generated_by').prefetch_related('items')
        if getattr(user, 'role', None) != 'SUPERADMIN' and user.tenant_id:
            qs = qs.filter(tenant_id=user.tenant_id)
        # Gerente: solo su sucursal.
        if getattr(user, 'role', None) == 'BRANCH_MANAGER' and user.branch_id:
            qs = qs.filter(branch_id=user.branch_id)
        p = self.request.query_params
        if p.get('year'):   qs = qs.filter(year=p['year'])
        if p.get('branch'): qs = qs.filter(branch_id=p['branch'])
        return qs

    @action(detail=False, methods=['post'])
    def generate(self, request):
        ser = PayrollGenerateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data
        user = request.user
        tenant = getattr(user, 'tenant', None)
        if tenant is None:
            from apps.tenants.models import Tenant
            tenant = Tenant.objects.filter(is_active=True).first()

        branch = None
        if getattr(user, 'role', None) == 'BRANCH_MANAGER' and user.branch_id:
            branch = Branch.objects.filter(pk=user.branch_id).first()
        elif data.get('branch'):
            branch = Branch.objects.filter(pk=data['branch'], tenant=tenant).first()

        try:
            run = generate_payroll(tenant, data['year'], data['month'], branch=branch, user=user)
        except ValueError as e:
            raise ValidationError({'detail': str(e)})
        return Response(PayrollRunDetailSerializer(run).data, status=201)

    @action(detail=True, methods=['post'], url_path='pay-item')
    def pay_item_action(self, request, pk=None):
        run = self.get_object()
        item = PayrollItem.objects.filter(run=run, pk=request.data.get('item')).first()
        if not item:
            raise ValidationError({'detail': 'Renglon no encontrado.'})
        pay_item(item, method=request.data.get('method', 'CASH'), notes=request.data.get('notes', ''))
        return Response(PayrollRunDetailSerializer(run).data)

    @action(detail=True, methods=['post'], url_path='unpay-item')
    def unpay_item_action(self, request, pk=None):
        run = self.get_object()
        item = PayrollItem.objects.filter(run=run, pk=request.data.get('item')).first()
        if not item:
            raise ValidationError({'detail': 'Renglon no encontrado.'})
        unpay_item(item)
        return Response(PayrollRunDetailSerializer(run).data)

    @action(detail=True, methods=['post'], url_path='pay-all')
    def pay_all_action(self, request, pk=None):
        run = self.get_object()
        pay_all(run, method=request.data.get('method', 'CASH'))
        return Response(PayrollRunDetailSerializer(run.__class__.objects.get(pk=run.pk)).data)

    @action(detail=False, methods=['get'])
    def report(self, request):
        """Gasto de nomina por mes (con total pagado/pendiente)."""
        qs = self.get_queryset()
        p = request.query_params
        if p.get('year'):   qs = qs.filter(year=p['year'])
        if p.get('branch'): qs = qs.filter(branch_id=p['branch'])

        rows = (qs.values('year', 'month')
                  .annotate(total=Sum('total_amount'), runs=Count('id'))
                  .order_by('year', 'month'))
        paid_map = {}
        for r in (PayrollItem.objects.filter(run__in=qs, status='PAID')
                  .values('run__year', 'run__month').annotate(p=Sum('amount'))):
            paid_map[(r['run__year'], r['run__month'])] = float(r['p'] or 0)

        months = []
        for r in rows:
            total = float(r['total'] or 0)
            paid = paid_map.get((r['year'], r['month']), 0.0)
            months.append({
                'year': r['year'], 'month': r['month'],
                'total': total, 'paid': paid, 'pending': round(total - paid, 2),
                'runs': r['runs'],
            })
        return Response({
            'months': months,
            'total': round(sum(m['total'] for m in months), 2),
            'paid': round(sum(m['paid'] for m in months), 2),
            'pending': round(sum(m['pending'] for m in months), 2),
        })
