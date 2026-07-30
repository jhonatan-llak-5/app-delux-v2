from django.db.models import Count, Sum, Q
from django.utils import timezone
from rest_framework import filters, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.accounts.permissions import IsBranchManager, IsStaff
from .models import Order, OrderStatus
from .serializers import OrderSerializer, POSCheckoutSerializer


class AdminOrderViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = OrderSerializer
    permission_classes = [permissions.IsAuthenticated, IsStaff]
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
        if params.get('mine') == 'true':
            qs = qs.filter(seller=self.request.user)
        if params.get('date_from'):
            qs = qs.filter(created_at__date__gte=params['date_from'])
        if params.get('date_to'):
            qs = qs.filter(created_at__date__lte=params['date_to'])

        # Aislamiento por rol: gerente solo ve su sucursal; superadmin ve todo.
        user = self.request.user
        if getattr(user, 'role', None) and user.role != 'SUPERADMIN':
            if user.tenant_id:
                qs = qs.filter(tenant_id=user.tenant_id)
            if user.role in ('BRANCH_MANAGER', 'SALESPERSON') and user.branch_id:
                qs = qs.filter(branch_id=user.branch_id)
        return qs

    @action(detail=False, methods=['post'], url_path='pos-checkout')
    def pos_checkout(self, request):
        serializer = POSCheckoutSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        order = serializer.save()
        return Response(OrderSerializer(order).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        """Cancela/anula la venta (interno de DLUX). Registra el motivo y, si se
        pide, devuelve el stock al inventario. NO emite nota de crédito: eso se
        gestiona aparte en NovaFactura."""
        if request.user.role == 'SALESPERSON':
            return Response({'detail': 'No autorizado.'}, status=status.HTTP_403_FORBIDDEN)
        order = self.get_object()
        if order.status in (OrderStatus.CANCELLED, OrderStatus.REFUNDED):
            return Response({'detail': 'Ya estaba cancelada.'}, status=400)

        reason = (request.data.get('reason') or '').strip()
        if not reason:
            return Response({'detail': 'Indica el motivo de la cancelación.'}, status=400)
        restore_stock = bool(request.data.get('restore_stock'))

        from django.db import transaction
        from apps.inventory.models import Stock, StockMovement
        with transaction.atomic():
            if restore_stock and order.branch_id:
                for it in order.items.select_related('variant').all():
                    if not it.variant_id:
                        continue
                    stock = Stock.objects.select_for_update().filter(
                        variant=it.variant, branch_id=order.branch_id,
                    ).first()
                    if not stock:
                        continue
                    before = stock.quantity
                    stock.quantity += it.quantity
                    stock.save(update_fields=['quantity', 'updated_at'])
                    StockMovement.objects.create(
                        tenant=order.tenant, stock=stock,
                        type=StockMovement.TYPE_IN, quantity=it.quantity,
                        note=f'Cancelación venta {order.code}: {reason}',
                        actor=request.user if request.user.is_authenticated else None,
                        qty_before=before, qty_after=stock.quantity,
                    )
            order.status = OrderStatus.CANCELLED
            order.cancel_reason = reason[:200]
            order.save(update_fields=['status', 'cancel_reason', 'updated_at'])
        return Response({'detail': 'Venta cancelada.', 'restored_stock': restore_stock})

    @action(detail=True, methods=['post'], url_path='set-status')
    def set_status(self, request, pk=None):
        """Cambia el estado del pedido (gerentes/admins). Bloquea estados finales."""
        if request.user.role == 'SALESPERSON':
            return Response({'detail': 'No autorizado.'}, status=status.HTTP_403_FORBIDDEN)
        order = self.get_object()
        new_status = request.data.get('status')
        reason = (request.data.get('notes') or '').strip()
        if new_status not in dict(OrderStatus.choices):
            return Response({'detail': 'Estado invalido.'}, status=400)
        if order.status in (OrderStatus.CANCELLED, OrderStatus.REFUNDED):
            return Response({'detail': 'No se puede cambiar un pedido cancelado o devuelto.'}, status=400)
        # Para estados "fallidos" (cancelado/devuelto) la observación es obligatoria.
        if new_status in (OrderStatus.CANCELLED, OrderStatus.REFUNDED) and not reason:
            return Response(
                {'detail': 'Indica el motivo (observaciones) al cancelar o devolver el pedido.'},
                status=400)
        if new_status == order.status:
            return Response(OrderSerializer(order).data)
        order.status = new_status
        update_fields = ['status', 'updated_at']
        if reason:
            order.notes = reason
            update_fields.append('notes')
        order.save(update_fields=update_fields)

        # Al marcar PAGADO: cierra la venta. Sincroniza el cobro (pagos
        # pendientes -> confirmados) y descuenta el stock si aún no se hizo.
        # Idempotente: no vuelve a descontar si ya existe una salida de stock
        # para este pedido (p.ej. contra entrega, que descuenta al crear).
        if new_status == OrderStatus.PAID:
            try:
                self._settle_paid(order, request.user)
            except Exception as e:
                print(f'[settle_paid] {e}')

        # Sistema inteligente de notificaciones: avisa al cliente (in-app),
        # al staff y al vendedor; email al cliente SOLO en hitos.
        try:
            from apps.notifications.services import notify_order_status_change
            notify_order_status_change(order, new_status, actor=request.user)
        except Exception as e:
            print(f'[notify set_status] {e}')

        return Response(OrderSerializer(order).data)

    def _settle_paid(self, order, user):
        """Confirma pagos pendientes y descuenta stock (idempotente) al cerrar
        la venta como PAGADA."""
        from django.db import transaction
        from apps.payments.models import Payment, PaymentStatus
        from apps.inventory.models import Stock, StockMovement
        with transaction.atomic():
            for p in order.payments.filter(status=PaymentStatus.PENDING):
                p.status = PaymentStatus.SUCCEEDED
                p.raw_payload = {**(p.raw_payload or {}),
                                 'validated_by': user.id, 'via': 'set_status'}
                p.save(update_fields=['status', 'raw_payload'])
            already_out = StockMovement.objects.filter(
                type=StockMovement.TYPE_OUT, note__icontains=order.code
            ).exists()
            if already_out:
                return
            for item in order.items.all():
                item_branch = item.branch_id or order.branch_id
                stock = Stock.objects.select_for_update().filter(
                    variant=item.variant, branch_id=item_branch
                ).first()
                if not stock:
                    continue
                before = stock.quantity
                stock.reserved = max(0, stock.reserved - item.quantity)
                stock.quantity = max(0, stock.quantity - item.quantity)
                stock.save(update_fields=['reserved', 'quantity', 'updated_at'])
                StockMovement.objects.create(
                    tenant=order.tenant, stock=stock,
                    type=StockMovement.TYPE_OUT, quantity=-item.quantity,
                    note=f'Venta {order.code} (marcada pagada)',
                    qty_before=before, qty_after=stock.quantity,
                )

    @action(detail=True, methods=['post'], url_path='retry-invoice')
    def retry_invoice(self, request, pk=None):
        """Reintenta la emisión de la factura electrónica de esta venta."""
        if request.user.role == 'SALESPERSON':
            return Response({'detail': 'No autorizado.'}, status=status.HTTP_403_FORBIDDEN)
        order = self.get_object()
        from apps.settings.models import PlatformSettings
        if not PlatformSettings.load().einvoice_enabled:
            return Response({'detail': 'La facturación electrónica no está activa.'}, status=400)
        if order.invoice_status == Order.InvoiceStatus.AUTHORIZED:
            return Response({'detail': 'La factura ya está autorizada.'}, status=400)
        order.invoice_status = Order.InvoiceStatus.PROCESSING
        order.invoice_error = ''
        order.invoice_updated_at = timezone.now()
        order.save(update_fields=['invoice_status', 'invoice_error', 'invoice_updated_at'])
        try:
            from apps.orders.einvoice import enqueue_invoice
            enqueue_invoice(order)
        except Exception as e:
            return Response({'detail': f'No se pudo reintentar: {e}'}, status=500)
        return Response(OrderSerializer(order).data)

    @action(detail=True, methods=['get'], url_path='invoice-file')
    def invoice_file(self, request, pk=None):
        """Proxy autenticado del RIDE/XML. Descarga el archivo desde NovaFactura
        con la API key (servidor a servidor) y lo entrega al usuario logueado en
        DLUX. Los documentos NO son públicos en NovaFactura; solo se acceden por
        aquí, con sesión válida.  ?kind=pdf|xml
        """
        order = self.get_object()
        kind = (request.query_params.get('kind') or 'pdf').lower()
        if kind not in ('pdf', 'xml'):
            return Response({'detail': 'Tipo inválido.'}, status=400)
        if not order.invoice_id:
            return Response({'detail': 'Esta venta no tiene factura emitida.'}, status=404)

        from apps.settings.models import PlatformSettings
        cfg = PlatformSettings.load()
        if not (cfg.einvoice_base_url and cfg.einvoice_api_key):
            return Response({'detail': 'Facturación no configurada.'}, status=400)

        import requests
        from django.http import StreamingHttpResponse
        remote = 'ride' if kind == 'pdf' else 'xml'
        url = cfg.einvoice_base_url.rstrip('/') + f'/api/v1/invoices/{order.invoice_id}/{remote}/'
        try:
            r = requests.get(
                url, headers={'Authorization': f'Api-Key {cfg.einvoice_api_key}'},
                timeout=30, stream=True,
            )
        except requests.RequestException as e:
            return Response({'detail': f'No se pudo obtener el archivo: {e}'}, status=502)
        if r.status_code == 404:
            return Response({'detail': 'El archivo aún no está disponible.'}, status=404)
        if r.status_code != 200:
            return Response({'detail': 'No se pudo obtener el archivo de NovaFactura.'}, status=502)

        content_type = 'application/pdf' if kind == 'pdf' else 'application/xml'
        ext = 'pdf' if kind == 'pdf' else 'xml'
        filename = f'{order.invoice_access_key or order.code}.{ext}'
        resp = StreamingHttpResponse(r.iter_content(chunk_size=8192), content_type=content_type)
        resp['Content-Disposition'] = f'inline; filename="{filename}"'
        return resp

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
