import secrets
from decimal import Decimal
from django.db import transaction
from django.utils import timezone
from rest_framework import filters, permissions, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsSalesStaff
from apps.customers.me_views import get_or_create_customer_for_user
from apps.orders.models import Order, OrderItem, OrderStatus
from apps.inventory.models import Stock, StockMovement
from .models import ReturnRequest, ReturnItem, ReturnStatus, SaleChange
from .serializers import ReturnSerializer, SaleChangeSerializer


class MeReturnsView(APIView):
    """Cliente: lista de devoluciones + crear nueva."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        c = get_or_create_customer_for_user(request.user)
        returns = c.returns.prefetch_related('items').order_by('-created_at')
        return Response({'results': ReturnSerializer(returns, many=True).data})

    @transaction.atomic
    def post(self, request):
        c = get_or_create_customer_for_user(request.user)
        order_id = request.data.get('order_id')
        order = Order.objects.filter(pk=order_id, customer=c, status=OrderStatus.PAID).first()
        if not order:
            return Response({'detail': 'Orden no válida.'}, status=400)
        reason = request.data.get('reason', 'OTHER')
        note = request.data.get('note', '')
        items_data = request.data.get('items', [])

        code = f'RET-{timezone.now().strftime("%Y%m%d")}-{secrets.token_hex(3).upper()}'
        rr = ReturnRequest.objects.create(
            tenant=order.tenant, code=code, order=order, customer=c,
            reason=reason, note=note, status=ReturnStatus.REQUESTED,
        )
        total = Decimal('0')
        for it in items_data:
            oi = OrderItem.objects.filter(pk=it['order_item_id'], order=order).first()
            if not oi: continue
            qty = min(int(it.get('quantity', 1)), oi.quantity)
            refund = oi.unit_price * qty
            ReturnItem.objects.create(
                tenant=order.tenant, return_request=rr,
                order_item=oi, quantity=qty, refund_amount=refund,
            )
            total += refund
        rr.refund_amount = total
        rr.save(update_fields=['refund_amount'])
        return Response(ReturnSerializer(rr).data, status=201)


class AdminReturnViewSet(viewsets.ModelViewSet):
    serializer_class = ReturnSerializer
    permission_classes = [permissions.IsAuthenticated, IsSalesStaff]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['code', 'order__code', 'customer__full_name']
    ordering = ['-created_at']

    def get_queryset(self):
        qs = ReturnRequest.objects.select_related('order', 'customer').prefetch_related('items')
        st = self.request.query_params.get('status')
        if st: qs = qs.filter(status=st)
        user = self.request.user
        if getattr(user, 'role', None) == 'BRANCH_MANAGER' and user.branch_id:
            qs = qs.filter(order__branch_id=user.branch_id)
        return qs

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        rr = self.get_object()
        if rr.status != ReturnStatus.REQUESTED:
            return Response({'detail': 'Solo se aprueban solicitudes.'}, status=400)
        rr.status = ReturnStatus.APPROVED
        rr.admin_note = request.data.get('admin_note', '')
        rr.save(update_fields=['status', 'admin_note'])
        return Response(ReturnSerializer(rr).data)

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        rr = self.get_object()
        rr.status = ReturnStatus.REJECTED
        rr.admin_note = request.data.get('admin_note', '')
        rr.save(update_fields=['status', 'admin_note'])
        return Response(ReturnSerializer(rr).data)

    @action(detail=True, methods=['post'])
    def refund(self, request, pk=None):
        """Reembolsa: devuelve stock al inventario."""
        rr = self.get_object()
        if rr.status != ReturnStatus.APPROVED:
            return Response({'detail': 'Solo reembolsar tras aprobar.'}, status=400)
        with transaction.atomic():
            for ri in rr.items.select_related('order_item__variant'):
                variant = ri.order_item.variant
                stock = Stock.objects.select_for_update().filter(
                    variant=variant, branch=rr.order.branch
                ).first()
                if stock:
                    stock.quantity += ri.quantity
                    stock.save(update_fields=['quantity'])
                    StockMovement.objects.create(
                        tenant=rr.tenant, stock=stock,
                        type=StockMovement.TYPE_IN,
                        quantity=ri.quantity,
                        note=f'Devolución {rr.code}',
                        actor=request.user if request.user.is_authenticated else None,
                    )
            rr.status = ReturnStatus.REFUNDED
            rr.order.status = OrderStatus.REFUNDED
            rr.order.save(update_fields=['status', 'updated_at'])
            rr.save(update_fields=['status'])

            # Reembolso en efectivo: sale del cajón abierto. Si la venta es del
            # mismo turno, el cálculo ya la excluye al quedar REFUNDED, así que
            # record_auto_movement no duplica el descuento.
            if rr.order.payment_form == '01':
                from apps.cashbox.models import CashMovement
                from apps.cashbox.services import record_auto_movement
                record_auto_movement(
                    user=request.user, branch_id=rr.order.branch_id,
                    type_=CashMovement.Type.OUT, amount=rr.refund_amount,
                    reason=f'Devolución {rr.code} (venta {rr.order.code})',
                    source_session_id=rr.order.cash_session_id,
                )
        return Response(ReturnSerializer(rr).data)


class AdminSaleChangeViewSet(viewsets.ReadOnlyModelViewSet):
    """Historial admin de CAMBIOS (return-to-stock parcial ligado a la venta,
    SIN reembolso ni anulación). Solo lectura."""
    serializer_class = SaleChangeSerializer
    permission_classes = [permissions.IsAuthenticated, IsSalesStaff]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['code', 'order__code', 'product_name', 'descripcion']
    ordering = ['-created_at']

    def get_queryset(self):
        qs = SaleChange.objects.select_related(
            'order', 'order_item', 'branch', 'actor').prefetch_related('lines')
        user = self.request.user
        if getattr(user, 'role', None) and user.role != 'SUPERADMIN':
            if getattr(user, 'tenant_id', None):
                qs = qs.filter(tenant_id=user.tenant_id)
        # Aísla por la sucursal donde SE REGISTRÓ el cambio (branch del cambio),
        # para perfiles atados a una sola sucursal.
        if getattr(user, 'role', None) in ('BRANCH_MANAGER', 'SALESPERSON') and user.branch_id:
            qs = qs.filter(branch_id=user.branch_id)
        # Filtro opcional por la sucursal seleccionada en el panel.
        branch = self.request.query_params.get('branch')
        if branch:
            qs = qs.filter(branch_id=branch)
        return qs

    @action(detail=True, methods=['post'])
    def undo(self, request, pk=None):
        """Deshace (anula) un cambio: revierte el stock (lo devuelto sale, lo
        entregado entra), lo excluye del balance y lo marca como anulado. NO
        borra el registro: queda en el historial para auditoría."""
        change = self.get_object()
        if change.annulled:
            return Response({'detail': 'Este cambio ya está anulado.'}, status=400)

        from django.db import transaction
        from .models import SaleChangeLine
        with transaction.atomic():
            branch_id = change.branch_id
            for line in change.lines.select_related('variant').all():
                if not line.variant_id or not branch_id:
                    continue
                stock = Stock.objects.select_for_update().filter(
                    variant_id=line.variant_id, branch_id=branch_id).first()
                before = stock.quantity if stock else 0
                if line.direction == SaleChangeLine.RETURN:
                    # Lo devuelto había ENTRADO al stock → al deshacer, SALE.
                    if not stock:
                        stock = Stock.objects.create(
                            tenant=change.tenant, variant_id=line.variant_id,
                            branch_id=branch_id, quantity=0)
                    stock.quantity = before - line.quantity
                    mtype = StockMovement.TYPE_OUT
                else:
                    # Lo entregado había SALIDO del stock → al deshacer, ENTRA.
                    if not stock:
                        stock = Stock.objects.create(
                            tenant=change.tenant, variant_id=line.variant_id,
                            branch_id=branch_id, quantity=0)
                    stock.quantity = before + line.quantity
                    mtype = StockMovement.TYPE_IN
                stock.save(update_fields=['quantity', 'updated_at'])
                StockMovement.objects.create(
                    tenant=change.tenant, stock=stock, type=mtype,
                    quantity=line.quantity,
                    note=f'Anulación cambio {change.code}: {line.product_name[:80]}',
                    actor=request.user if request.user.is_authenticated else None,
                    qty_before=before, qty_after=stock.quantity)

            change.annulled = True
            change.annulled_at = timezone.now()
            change.annulled_by = request.user if request.user.is_authenticated else None
            change.save(update_fields=['annulled', 'annulled_at', 'annulled_by'])
        return Response(SaleChangeSerializer(change).data)
