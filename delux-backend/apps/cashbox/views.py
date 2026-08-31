from django.db.models import Sum
from rest_framework import filters, permissions, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from apps.accounts.permissions import IsManager, IsSalesStaff
from apps.branches.models import Branch

from .models import CashRegister, CashSession, DENOMINATIONS
from .serializers import (
    CashMovementSerializer, CashRegisterSerializer, CashSessionDetailSerializer,
    CashSessionSerializer, CloseSessionSerializer, MovementInputSerializer,
    OpenSessionSerializer,
)
from .services import (
    close_session, compute_totals, default_register, open_session,
    register_movement,
)


def _tenant_of(user):
    tenant = getattr(user, 'tenant', None)
    if tenant is None:
        from apps.tenants.models import Tenant
        tenant = Tenant.objects.filter(is_active=True).first()
    return tenant


class CashRegisterViewSet(viewsets.ModelViewSet):
    """Puntos de venta (cajas físicas) de cada sucursal."""
    serializer_class = CashRegisterSerializer
    permission_classes = [permissions.IsAuthenticated, IsSalesStaff]

    def get_queryset(self):
        user = self.request.user
        qs = CashRegister.objects.select_related('branch')
        if getattr(user, 'role', None) != 'SUPERADMIN' and user.tenant_id:
            qs = qs.filter(tenant_id=user.tenant_id)
        if user.role in ('BRANCH_MANAGER', 'SALESPERSON') and user.branch_id:
            qs = qs.filter(branch_id=user.branch_id)
        if self.request.query_params.get('branch'):
            qs = qs.filter(branch_id=self.request.query_params['branch'])
        return qs

    def get_permissions(self):
        # Crear/editar/borrar cajas es tarea del gerente; el vendedor solo lee.
        if self.action not in ('list', 'retrieve'):
            return [permissions.IsAuthenticated(), IsManager()]
        return super().get_permissions()

    def perform_create(self, serializer):
        serializer.save(tenant=_tenant_of(self.request.user))

    def perform_destroy(self, instance):
        if instance.sessions.exists():
            raise ValidationError(
                {'detail': 'Esta caja ya tiene turnos registrados; desactívala en vez de borrarla.'})
        instance.delete()


class CashSessionViewSet(viewsets.ReadOnlyModelViewSet):
    """Turnos de caja: apertura, cierre e historial."""
    permission_classes = [permissions.IsAuthenticated, IsSalesStaff]
    filter_backends = [filters.OrderingFilter]
    ordering_fields = ['opened_at', 'closed_at', 'difference']
    ordering = ['-opened_at']

    def get_serializer_class(self):
        # El listado va liviano para la tabla. Con ?detail=1 devuelve además los
        # conteos y movimientos de cada turno: lo usa la exportación del arqueo,
        # que necesita el desglose de billetes y monedas.
        if self.action == 'retrieve':
            return CashSessionDetailSerializer
        if self.action == 'list' and self.request.query_params.get('detail') == '1':
            return CashSessionDetailSerializer
        return CashSessionSerializer

    def get_queryset(self):
        user = self.request.user
        qs = (CashSession.objects
              .select_related('branch', 'register', 'opened_by', 'closed_by')
              .prefetch_related('movements', 'count_lines'))
        if getattr(user, 'role', None) != 'SUPERADMIN' and user.tenant_id:
            qs = qs.filter(tenant_id=user.tenant_id)
        if user.role in ('BRANCH_MANAGER', 'SALESPERSON') and user.branch_id:
            qs = qs.filter(branch_id=user.branch_id)
        # El vendedor solo ve sus propios turnos; el gerente ve los de su sucursal.
        if user.role == 'SALESPERSON':
            qs = qs.filter(opened_by=user)

        p = self.request.query_params
        if p.get('branch'):    qs = qs.filter(branch_id=p['branch'])
        if p.get('register'):  qs = qs.filter(register_id=p['register'])
        if p.get('status'):    qs = qs.filter(status=p['status'])
        if p.get('user'):      qs = qs.filter(opened_by_id=p['user'])
        if p.get('date_from'): qs = qs.filter(opened_at__date__gte=p['date_from'])
        if p.get('date_to'):   qs = qs.filter(opened_at__date__lte=p['date_to'])
        return qs

    # ─── Denominaciones (para pintar la tabla de conteo) ───
    @action(detail=False, methods=['get'])
    def denominations(self, request):
        return Response([
            {'piece': piece, 'denomination': str(denom)}
            for piece, denom in DENOMINATIONS
        ])

    # ─── Turno abierto del usuario ───
    @action(detail=False, methods=['get'])
    def current(self, request):
        """Turno abierto que le corresponde al usuario (o null si no tiene)."""
        qs = self.get_queryset().filter(status=CashSession.Status.OPEN)
        branch_id = request.query_params.get('branch')
        if branch_id:
            qs = qs.filter(branch_id=branch_id)
        session = qs.filter(opened_by=request.user).first() or qs.first()
        if not session:
            return Response({'session': None})
        return Response({'session': CashSessionDetailSerializer(session).data})

    @action(detail=False, methods=['post'])
    def open(self, request):
        ser = OpenSessionSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data
        user = request.user
        tenant = _tenant_of(user)

        branch = Branch.objects.filter(pk=data['branch'], tenant=tenant).first()
        if not branch:
            raise ValidationError({'branch': 'Sucursal no encontrada.'})
        if user.role in ('BRANCH_MANAGER', 'SALESPERSON') and user.branch_id \
                and branch.id != user.branch_id:
            raise ValidationError({'branch': 'Solo puedes abrir la caja de tu sucursal.'})

        register = None
        if data.get('register'):
            register = CashRegister.objects.filter(pk=data['register'], branch=branch).first()
            if not register:
                raise ValidationError({'register': 'Punto de venta no encontrado.'})
        else:
            register = default_register(tenant, branch)

        try:
            session = open_session(
                tenant=tenant, branch=branch, register=register, user=user,
                opening_lines=data.get('lines'),
                opening_amount=data.get('opening_amount'),
                note=data.get('note', ''),
            )
        except ValueError as e:
            raise ValidationError({'detail': str(e)})
        return Response(CashSessionDetailSerializer(session).data, status=201)

    @action(detail=True, methods=['get'])
    def summary(self, request, pk=None):
        """Totales en vivo del turno (pantalla de cierre)."""
        session = self.get_object()
        totals = compute_totals(session) if session.is_open else None
        data = CashSessionDetailSerializer(session).data
        if totals:
            data['totals'] = {k: str(v) for k, v in totals.items()}
        return Response(data)

    @action(detail=True, methods=['post'])
    def close(self, request, pk=None):
        session = self.get_object()
        ser = CloseSessionSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data
        user = request.user
        # El vendedor cierra su propio turno; el gerente puede cerrar cualquiera
        # de su sucursal (p. ej. si el vendedor se fue sin cerrar).
        if user.role == 'SALESPERSON' and session.opened_by_id != user.id:
            raise ValidationError({'detail': 'Solo puedes cerrar tu propia caja.'})
        try:
            session = close_session(
                session=session, user=user,
                closing_lines=data.get('lines'),
                counted_amount=data.get('counted_amount'),
                note=data.get('note', ''),
            )
        except ValueError as e:
            raise ValidationError({'detail': str(e)})
        return Response(CashSessionDetailSerializer(session).data)

    @action(detail=True, methods=['get', 'post'])
    def movements(self, request, pk=None):
        session = self.get_object()
        if request.method == 'GET':
            return Response(CashMovementSerializer(session.movements.all(), many=True).data)
        ser = MovementInputSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        try:
            mov = register_movement(
                session=session, user=request.user,
                type_=ser.validated_data['type'],
                amount=ser.validated_data['amount'],
                reason=ser.validated_data.get('reason', ''),
            )
        except ValueError as e:
            raise ValidationError({'detail': str(e)})
        return Response(CashMovementSerializer(mov).data, status=201)

    @action(detail=False, methods=['get'])
    def stats(self, request):
        """Totales del historial filtrado (cabecera de la página)."""
        qs = self.get_queryset()
        closed = qs.filter(status=CashSession.Status.CLOSED)
        agg = closed.aggregate(
            sales=Sum('sales_total'), cash=Sum('cash_sales'),
            diff=Sum('difference'), expected=Sum('expected_amount'),
            counted=Sum('counted_amount'),
        )
        return Response({
            'sessions': qs.count(),
            'open': qs.filter(status=CashSession.Status.OPEN).count(),
            'closed': closed.count(),
            'sales_total': str(agg['sales'] or 0),
            'cash_sales': str(agg['cash'] or 0),
            'expected_amount': str(agg['expected'] or 0),
            'counted_amount': str(agg['counted'] or 0),
            'difference': str(agg['diff'] or 0),
            'mismatched': closed.exclude(difference=0).count(),
        })
