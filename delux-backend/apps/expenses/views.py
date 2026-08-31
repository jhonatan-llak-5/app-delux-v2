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
        # Gerente/Vendedor: solo su sucursal (solo el superadmin ve todas).
        if getattr(user, 'role', None) in ('BRANCH_MANAGER', 'SALESPERSON') and user.branch_id:
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
        # Gerente/Vendedor: se fuerza su propia sucursal (solo el superadmin elige).
        if getattr(user, 'role', None) in ('BRANCH_MANAGER', 'SALESPERSON') and user.branch_id:
            branch = Branch.objects.filter(id=user.branch_id).first()
        # El tenant sale de la sucursal; si no hay, se resuelve del usuario.
        tenant = branch.tenant if branch is not None else resolve_tenant(user)
        kwargs = {'tenant': tenant, 'created_by': user}
        if branch is not None:
            kwargs['branch'] = branch
            # Gasto en efectivo con la caja abierta: sale del cajón, así que se
            # imputa al turno para que el cierre cuadre.
            if serializer.validated_data.get('payment_method') == 'CASH':
                from apps.cashbox.services import session_for_sale
                kwargs['cash_session'] = session_for_sale(user, branch.id)
        serializer.save(**kwargs)

    def perform_update(self, serializer):
        """Si al editar el gasto cambia la forma de pago, se re-evalúa a qué
        turno de caja pertenece: pasa a efectivo -> entra al cajón abierto; deja
        de serlo -> se desliga."""
        expense = serializer.save()
        if expense.cash_session_id and expense.cash_session.status != 'OPEN':
            return   # turno ya cerrado: su arqueo está congelado, no se toca
        if expense.payment_method == 'CASH':
            if not expense.cash_session_id and expense.branch_id:
                from apps.cashbox.services import session_for_sale
                expense.cash_session = session_for_sale(self.request.user, expense.branch_id)
                expense.save(update_fields=['cash_session'])
        elif expense.cash_session_id:
            expense.cash_session = None
            expense.save(update_fields=['cash_session'])

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
