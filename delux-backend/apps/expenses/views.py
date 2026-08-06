from decimal import Decimal

from django.db.models import Sum, Count
from django.utils import timezone
from rest_framework import viewsets, permissions, filters
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.accounts.permissions import IsSalesStaff
from apps.inventory.services import resolve_tenant
from apps.branches.models import Branch
from .models import Expense, ExpenseCategory
from .serializers import ExpenseSerializer


class ExpenseViewSet(viewsets.ModelViewSet):
    """CRUD de gastos + resumen. Vendedor/gerente ven y registran solo su
    sucursal; admin/dueno ve todo (consolidado) y puede filtrar por sucursal."""
    serializer_class = ExpenseSerializer
    permission_classes = [permissions.IsAuthenticated, IsSalesStaff]
    filter_backends = [filters.OrderingFilter]
    ordering = ['-date', '-created_at']

    def _scoped(self):
        user = self.request.user
        qs = Expense.objects.select_related('branch', 'created_by')
        if getattr(user, 'role', None) != 'SUPERADMIN' and user.tenant_id:
            qs = qs.filter(tenant_id=user.tenant_id)
        # Vendedor: solo su sucursal (gerente ve toda la tienda).
        if getattr(user, 'role', None) == 'SALESPERSON' and user.branch_id:
            qs = qs.filter(branch_id=user.branch_id)
        return qs

    def get_queryset(self):
        qs = self._scoped()
        p = self.request.query_params
        if p.get('branch'):   qs = qs.filter(branch_id=p['branch'])
        if p.get('category'): qs = qs.filter(category=p['category'])
        if p.get('from'):     qs = qs.filter(date__gte=p['from'])
        if p.get('to'):       qs = qs.filter(date__lte=p['to'])
        return qs

    def perform_create(self, serializer):
        user = self.request.user
        branch = serializer.validated_data.get('branch')
        # Vendedor: se fuerza su propia sucursal (gerente puede elegir).
        if getattr(user, 'role', None) == 'SALESPERSON' and user.branch_id:
            branch = Branch.objects.filter(id=user.branch_id).first()
        # El tenant sale de la sucursal; si no hay, se resuelve del usuario.
        tenant = branch.tenant if branch is not None else resolve_tenant(user)
        kwargs = {'tenant': tenant, 'created_by': user}
        if branch is not None:
            kwargs['branch'] = branch
        serializer.save(**kwargs)

    @action(detail=False, methods=['get'])
    def categories(self, request):
        return Response([{'value': c.value, 'label': c.label} for c in ExpenseCategory])

    @action(detail=False, methods=['get'])
    def summary(self, request):
        qs = self.get_queryset()
        total = qs.aggregate(t=Sum('amount'))['t'] or Decimal('0')
        labels = dict(ExpenseCategory.choices)
        by_cat = []
        for r in qs.values('category').annotate(total=Sum('amount'), count=Count('id')).order_by('-total'):
            by_cat.append({
                'category': r['category'],
                'label': labels.get(r['category'], r['category']),
                'total': str(r['total'] or Decimal('0')),
                'count': r['count'],
            })
        today = timezone.localdate()
        today_total = qs.filter(date=today).aggregate(t=Sum('amount'))['t'] or Decimal('0')
        return Response({
            'total': str(total),
            'today_total': str(today_total),
            'count': qs.count(),
            'by_category': by_cat,
        })
