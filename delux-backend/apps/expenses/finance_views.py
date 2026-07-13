import datetime
from datetime import timedelta
from decimal import Decimal

from django.db.models import Sum, F, DecimalField
from django.db.models.functions import TruncDate, TruncMonth
from django.utils import timezone
from rest_framework import permissions, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.accounts.permissions import IsBranchManager
from apps.orders.models import Order, OrderStatus, OrderChannel, OrderItem
from apps.inventory.models import ReceptionItem, Reception
from .models import Expense, ExpenseCategory


def _parse_range(request):
    today = timezone.localdate()
    to_s = request.query_params.get('to')
    from_s = request.query_params.get('from')
    to_d = timezone.datetime.fromisoformat(to_s).date() if to_s else today
    from_d = timezone.datetime.fromisoformat(from_s).date() if from_s else (to_d - timedelta(days=29))
    return from_d, to_d


def _dec(v):
    return v if v is not None else Decimal('0')


def _month_iter(from_d, to_d):
    y, m = from_d.year, from_d.month
    out = []
    while (y < to_d.year) or (y == to_d.year and m <= to_d.month):
        out.append((y, m))
        m += 1
        if m > 12:
            m = 1; y += 1
    return out


class FinanceViewSet(viewsets.ViewSet):
    """Resumen financiero: Ventas (Web/POS) - Compras - Gastos = Ganancia,
    series de tiempo y comparativo anual."""
    permission_classes = [permissions.IsAuthenticated, IsBranchManager]

    def _scope_branch(self, request):
        user = request.user
        if getattr(user, 'role', None) in ('BRANCH_MANAGER', 'SALESPERSON') and user.branch_id:
            return user.branch_id
        b = request.query_params.get('branch')
        return int(b) if b else None

    def _tenant_id(self, request):
        user = request.user
        if getattr(user, 'role', None) != 'SUPERADMIN':
            return user.tenant_id
        return None

    def _orders_qs(self, request, from_d, to_d):
        tenant_id = self._tenant_id(request)
        branch_id = self._scope_branch(request)
        oq = Order.objects.filter(status=OrderStatus.PAID,
                                  created_at__date__gte=from_d, created_at__date__lte=to_d)
        if tenant_id: oq = oq.filter(tenant_id=tenant_id)
        if branch_id: oq = oq.filter(branch_id=branch_id)
        return oq

    def _compute(self, request, from_d, to_d):
        tenant_id = self._tenant_id(request)
        branch_id = self._scope_branch(request)

        oq = self._orders_qs(request, from_d, to_d)
        ventas_web = _dec(oq.filter(channel=OrderChannel.WEB).aggregate(t=Sum('total'))['t'])
        ventas_pos = _dec(oq.filter(channel=OrderChannel.POS).aggregate(t=Sum('total'))['t'])
        ventas = ventas_web + ventas_pos

        ri = ReceptionItem.objects.filter(reception__status=Reception.STATUS_COMMITTED,
                                           reception__committed_at__date__gte=from_d,
                                           reception__committed_at__date__lte=to_d)
        if tenant_id: ri = ri.filter(reception__tenant_id=tenant_id)
        if branch_id: ri = ri.filter(reception__branch_id=branch_id)
        compras = _dec(ri.aggregate(
            t=Sum(F('quantity') * F('unit_cost'), output_field=DecimalField(max_digits=14, decimal_places=2)))['t'])

        eq = Expense.objects.filter(date__gte=from_d, date__lte=to_d)
        if tenant_id: eq = eq.filter(tenant_id=tenant_id)
        if branch_id: eq = eq.filter(branch_id=branch_id)
        gastos = _dec(eq.aggregate(t=Sum('amount'))['t'])
        labels = dict(ExpenseCategory.choices)
        gastos_by_cat = [
            {'category': r['category'], 'label': labels.get(r['category'], r['category']),
             'total': str(_dec(r['total']))}
            for r in eq.values('category').annotate(total=Sum('amount')).order_by('-total')
        ]

        ganancia = ventas - compras - gastos
        orders = oq.count()
        return {
            'ventas': ventas, 'ventas_web': ventas_web, 'ventas_pos': ventas_pos,
            'compras': compras, 'gastos': gastos, 'ganancia': ganancia,
            'orders': orders, 'gastos_by_cat': gastos_by_cat,
        }

    @action(detail=False, methods=['get'])
    def summary(self, request):
        from_d, to_d = _parse_range(request)
        cur = self._compute(request, from_d, to_d)
        length = (to_d - from_d).days + 1
        prev_to = from_d - timedelta(days=1)
        prev_from = prev_to - timedelta(days=length - 1)
        prev = self._compute(request, prev_from, prev_to)

        def delta(cur_v, prev_v):
            cur_v = Decimal(cur_v); prev_v = Decimal(prev_v)
            if prev_v == 0:
                return None
            return round(float((cur_v - prev_v) / prev_v * 100), 1)

        keys = ['ventas', 'ventas_web', 'ventas_pos', 'compras', 'gastos', 'ganancia']
        out = {k: str(cur[k]) for k in keys}
        out['orders'] = cur['orders']
        out['gastos_by_cat'] = cur['gastos_by_cat']
        out['deltas'] = {k: delta(cur[k], prev[k]) for k in keys}
        out['range'] = {'from': from_d.isoformat(), 'to': to_d.isoformat()}
        out['prev_range'] = {'from': prev_from.isoformat(), 'to': prev_to.isoformat()}
        return Response(out)

    @action(detail=False, methods=['get'])
    def timeline(self, request):
        """Serie Web/POS y Gastos por dia (rango corto) o por mes (rango largo)."""
        from_d, to_d = _parse_range(request)
        tenant_id = self._tenant_id(request)
        branch_id = self._scope_branch(request)
        length = (to_d - from_d).days + 1
        by_month = length > 92

        oq = self._orders_qs(request, from_d, to_d)
        trunc = TruncMonth('created_at') if by_month else TruncDate('created_at')
        web, pos = {}, {}
        for r in oq.annotate(b=trunc).values('b', 'channel').annotate(t=Sum('total')):
            d = r['b']
            if hasattr(d, 'date'):
                d = d.date()
            key = f'{d.year}-{d.month:02d}' if by_month else d.isoformat()
            (web if r['channel'] == OrderChannel.WEB else pos)[key] = float(_dec(r['t']))

        eq = Expense.objects.filter(date__gte=from_d, date__lte=to_d)
        if tenant_id: eq = eq.filter(tenant_id=tenant_id)
        if branch_id: eq = eq.filter(branch_id=branch_id)
        gtrunc = TruncMonth('date') if by_month else TruncDate('date')
        gastos_map = {}
        for r in eq.annotate(b=gtrunc).values('b').annotate(t=Sum('amount')):
            d = r['b']
            if hasattr(d, 'date'):
                d = d.date()
            key = f'{d.year}-{d.month:02d}' if by_month else d.isoformat()
            gastos_map[key] = float(_dec(r['t']))

        labels, wl, pl, gl = [], [], [], []

        def push(k):
            labels.append(k); wl.append(web.get(k, 0)); pl.append(pos.get(k, 0)); gl.append(gastos_map.get(k, 0))

        if by_month:
            for (y, m) in _month_iter(from_d, to_d):
                push(f'{y}-{m:02d}')
        else:
            cur = from_d
            while cur <= to_d:
                push(cur.isoformat())
                cur += timedelta(days=1)
        return Response({'labels': labels, 'web': wl, 'pos': pl, 'gastos': gl,
                         'granularity': 'month' if by_month else 'day'})

    @action(detail=False, methods=['get'])
    def yearly(self, request):
        """Comparativo de los ultimos 4 anios: ventas, compras, gastos, ganancia."""
        this_year = timezone.localdate().year
        out = []
        for y in range(this_year - 3, this_year + 1):
            c = self._compute(request, datetime.date(y, 1, 1), datetime.date(y, 12, 31))
            out.append({
                'year': y,
                'ventas': str(c['ventas']), 'compras': str(c['compras']),
                'gastos': str(c['gastos']), 'ganancia': str(c['ganancia']),
            })
        return Response(out)

    @action(detail=False, methods=['get'])
    def top_products(self, request):
        """Productos mas vendidos del periodo (cantidad + ingresos) con
        tendencia vs el periodo anterior."""
        from_d, to_d = _parse_range(request)
        oq = self._orders_qs(request, from_d, to_d)
        top = list(OrderItem.objects.filter(order__in=oq)
                   .values('product_name')
                   .annotate(qty=Sum('quantity'), revenue=Sum('subtotal'))
                   .order_by('-qty')[:8])

        length = (to_d - from_d).days + 1
        prev_to = from_d - timedelta(days=1)
        prev_from = prev_to - timedelta(days=length - 1)
        poq = self._orders_qs(request, prev_from, prev_to)
        prev = {r['product_name']: (r['qty'] or 0) for r in
                OrderItem.objects.filter(order__in=poq).values('product_name').annotate(qty=Sum('quantity'))}

        out = []
        for r in top:
            cur = r['qty'] or 0
            pv = prev.get(r['product_name'], 0)
            delta = None if pv == 0 else round((cur - pv) / pv * 100, 1)
            out.append({'product': r['product_name'], 'qty': cur,
                        'revenue': str(_dec(r['revenue'])), 'delta': delta})
        return Response(out)
