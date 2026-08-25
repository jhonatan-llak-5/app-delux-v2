from django.db.models import Count, Sum, Q
from django.utils import timezone
from rest_framework import filters, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.accounts.permissions import IsBranchManager, IsSalesStaff
from .models import Order, OrderStatus
from .serializers import OrderSerializer, POSCheckoutSerializer


class AdminOrderViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = OrderSerializer
    permission_classes = [permissions.IsAuthenticated, IsSalesStaff]
    filter_backends = [filters.OrderingFilter]
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

        # Búsqueda: por código de venta, cliente, o por código/nombre del
        # producto vendido (subquery de IDs para no duplicar filas ni alterar
        # items_count).
        search = (params.get('search') or '').strip()
        if search:
            from .models import OrderItem
            prod_order_ids = (
                OrderItem.objects
                .filter(
                    Q(product_name__icontains=search)
                    | Q(sku__icontains=search)
                    | Q(variant__barcode__icontains=search)
                )
                .values_list('order_id', flat=True)
            )
            qs = qs.filter(
                Q(code__icontains=search)
                | Q(customer__full_name__icontains=search)
                | Q(customer__email__icontains=search)
                | Q(id__in=prod_order_ids)
            )

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

    @action(detail=True, methods=['post'], url_path='register-change')
    def register_change(self, request, pk=None):
        """Registra un CAMBIO producto-por-producto sobre una venta ya realizada.
        El cliente DEVUELVE uno o más ítems (vuelven al stock) y se lleva a cambio
        uno o más ítems NUEVOS (salen del stock). La cantidad devuelta debe ser
        igual a la entregada. Si hay diferencia de precio, se registra como
        ingreso (el cliente paga) o egreso (la tienda devuelve) en el balance.
        La venta NO se anula. Puede haber varios cambios por venta."""
        from decimal import Decimal, InvalidOperation
        order = self.get_object()
        if order.status == OrderStatus.CANCELLED:
            return Response({'detail': 'La venta está cancelada.'}, status=400)

        returned = request.data.get('returned') or []
        delivered = request.data.get('delivered') or []
        descripcion = (request.data.get('descripcion') or '').strip()

        # Fecha del cambio (opcional): permite registrar un cambio de días atrás.
        # Si viene vacía se usa la fecha/hora actual.
        change_dt = None
        raw_date = (request.data.get('change_date') or '').strip()
        if raw_date:
            import datetime as _dt
            try:
                d = _dt.date.fromisoformat(raw_date[:10])
            except ValueError:
                return Response({'detail': 'Fecha del cambio inválida.'}, status=400)
            now = timezone.localtime()
            naive = _dt.datetime.combine(d, now.timetz().replace(tzinfo=None))
            change_dt = timezone.make_aware(naive, timezone.get_current_timezone())

        if not isinstance(returned, list) or not returned:
            return Response({'detail': 'Selecciona al menos un producto que el cliente devuelve.'}, status=400)
        if not isinstance(delivered, list) or not delivered:
            return Response({'detail': 'Selecciona al menos un producto que se entrega a cambio.'}, status=400)

        # ── Normaliza y valida los ítems DEVUELTOS (contra la venta) ──
        return_rows = []   # (order_item, qty)
        already = {}       # order_item_id -> qty ya devuelta en cambios previos
        from apps.returns.models import SaleChangeLine
        for l in SaleChangeLine.objects.filter(change__order=order, direction=SaleChangeLine.RETURN):
            if l.order_item_id:
                already[l.order_item_id] = already.get(l.order_item_id, 0) + l.quantity
        pending_qty = {}
        for r in returned:
            try:
                oi_id = int(r.get('order_item_id'))
                qty = int(r.get('quantity', 1))
            except (TypeError, ValueError, AttributeError):
                return Response({'detail': 'Ítem devuelto inválido.'}, status=400)
            if qty < 1:
                return Response({'detail': 'La cantidad devuelta debe ser al menos 1.'}, status=400)
            oi = order.items.filter(pk=oi_id).first()
            if not oi:
                return Response({'detail': 'Un ítem devuelto no pertenece a esta venta.'}, status=400)
            pending_qty[oi_id] = pending_qty.get(oi_id, 0) + qty
            disponible = oi.quantity - already.get(oi_id, 0)
            if pending_qty[oi_id] > disponible:
                return Response(
                    {'detail': f'«{oi.product_name}»: no puedes devolver más de lo vendido/disponible.'},
                    status=400)
            return_rows.append((oi, qty))

        # ── Normaliza y valida los ítems ENTREGADOS (variantes por barcode) ──
        from apps.variants.models import Variant
        deliver_rows = []  # (variant, qty)
        branch_id = order.branch_id
        for d in delivered:
            try:
                v_id = int(d.get('variant_id'))
                qty = int(d.get('quantity', 1))
            except (TypeError, ValueError, AttributeError):
                return Response({'detail': 'Ítem entregado inválido.'}, status=400)
            if qty < 1:
                return Response({'detail': 'La cantidad entregada debe ser al menos 1.'}, status=400)
            variant = (Variant.objects.select_related('product')
                       .filter(pk=v_id, tenant=order.tenant).first())
            if not variant:
                return Response({'detail': 'Un producto entregado no existe.'}, status=400)
            deliver_rows.append((variant, qty))

        # ── Regla clave: cantidad devuelta == cantidad entregada ──
        total_returned_qty = sum(q for _, q in return_rows)
        total_delivered_qty = sum(q for _, q in deliver_rows)
        if total_returned_qty != total_delivered_qty:
            return Response({
                'detail': f'Las cantidades no coinciden: el cliente devuelve '
                          f'{total_returned_qty} y se le entregan {total_delivered_qty}. '
                          f'Deben ser iguales.'
            }, status=400)

        import secrets
        from django.db import transaction
        from apps.inventory.models import Stock, StockMovement

        def _delivered_unit_price(variant):
            prod = variant.product
            base = variant.price_override or prod.base_price
            return prod.offer_price(base)   # IVA incluido, igual que el POS

        with transaction.atomic():
            # Validar stock de los entregados ANTES de mover nada.
            for variant, qty in deliver_rows:
                st = Stock.objects.select_for_update().filter(
                    variant=variant, branch_id=branch_id).first()
                have = st.quantity if st else 0
                if have < qty:
                    return Response({
                        'detail': f'Stock insuficiente de «{variant.product.name}» '
                                  f'({variant.size or ""} {variant.color or ""}): hay {have}, '
                                  f'necesitas {qty}.'
                    }, status=400)

            code = f'CMB-{timezone.now().strftime("%Y%m%d")}-{secrets.token_hex(3).upper()}'
            change = SaleChange.objects.create(
                tenant=order.tenant, code=code, order=order, branch_id=branch_id,
                quantity=total_returned_qty, descripcion=descripcion,
                actor=request.user if request.user.is_authenticated else None,
                # legacy: primer ítem devuelto
                order_item=return_rows[0][0], variant_id=return_rows[0][0].variant_id,
                product_name=return_rows[0][0].product_name,
            )

            returned_value = Decimal('0')
            # DEVUELTOS: vuelven al stock (+)
            for oi, qty in return_rows:
                unit = Decimal(str(oi.unit_price or 0))
                sub = (unit * qty).quantize(Decimal('0.01'))
                returned_value += sub
                if oi.variant_id and branch_id:
                    st = Stock.objects.select_for_update().filter(
                        variant_id=oi.variant_id, branch_id=branch_id).first()
                    if st:
                        before = st.quantity
                        st.quantity += qty
                        st.save(update_fields=['quantity', 'updated_at'])
                    else:
                        st = Stock.objects.create(
                            tenant=order.tenant, variant_id=oi.variant_id,
                            branch_id=branch_id, quantity=qty)
                        before = 0
                    StockMovement.objects.create(
                        tenant=order.tenant, stock=st, type=StockMovement.TYPE_IN,
                        quantity=qty, note=f'Cambio {code}: devolución {oi.product_name[:80]}',
                        actor=request.user if request.user.is_authenticated else None,
                        qty_before=before, qty_after=st.quantity)
                SaleChangeLine.objects.create(
                    tenant=order.tenant, change=change, direction=SaleChangeLine.RETURN,
                    order_item=oi, variant_id=oi.variant_id, product_name=oi.product_name,
                    sku=oi.sku, size=oi.size, color=oi.color, quantity=qty,
                    unit_price=unit, subtotal=sub)

            delivered_value = Decimal('0')
            # ENTREGADOS: salen del stock (−)
            for variant, qty in deliver_rows:
                unit = Decimal(str(_delivered_unit_price(variant) or 0))
                sub = (unit * qty).quantize(Decimal('0.01'))
                delivered_value += sub
                if branch_id:
                    st = Stock.objects.select_for_update().filter(
                        variant=variant, branch_id=branch_id).first()
                    before = st.quantity if st else 0
                    st.quantity = before - qty
                    st.save(update_fields=['quantity', 'updated_at'])
                    StockMovement.objects.create(
                        tenant=order.tenant, stock=st, type=StockMovement.TYPE_OUT,
                        quantity=qty, note=f'Cambio {code}: entrega {variant.product.name[:80]}',
                        actor=request.user if request.user.is_authenticated else None,
                        qty_before=before, qty_after=st.quantity)
                SaleChangeLine.objects.create(
                    tenant=order.tenant, change=change, direction=SaleChangeLine.DELIVER,
                    variant=variant, product_name=variant.product.name, sku=variant.sku,
                    size=variant.size, color=variant.color, quantity=qty,
                    unit_price=unit, subtotal=sub)

            difference = (delivered_value - returned_value).quantize(Decimal('0.01'))
            change.returned_value = returned_value
            change.delivered_value = delivered_value
            change.difference = difference
            change.valor_devuelto = returned_value   # compat
            update_fields = ['returned_value', 'delivered_value', 'difference', 'valor_devuelto']
            # Fecha retroactiva del cambio (si se indicó una).
            if change_dt is not None:
                change.created_at = change_dt
                update_fields.append('created_at')
            change.save(update_fields=update_fields)

        return Response(OrderSerializer(order).data)

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
        if order.invoice_status in (Order.InvoiceStatus.AUTHORIZED,
                                    Order.InvoiceStatus.PENDING_SRI):
            # PENDING_SRI: el SRI tuvo un error temporal y NovaFactura reintenta
            # solo; no hay que reintentar a mano.
            return Response({'detail': 'La factura ya está autorizada o en espera del SRI.'}, status=400)
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

    @action(detail=True, methods=['post'], url_path='emit-invoice')
    def emit_invoice(self, request, pk=None):
        """Emite MANUALMENTE la factura electrónica de una venta desde el panel.

        Pensada sobre todo para ventas WEB (que no facturan solas): el operador
        confirma/ingresa los datos SRI del cliente (cédula/RUC, nombre, etc.) y la
        forma de pago, y se encola la emisión en NovaFactura. También sirve para
        reemitir una venta cuya factura quedó NOT_ISSUED/REJECTED/ERROR.
        """
        if request.user.role == 'SALESPERSON':
            return Response({'detail': 'No autorizado.'}, status=status.HTTP_403_FORBIDDEN)

        order = self.get_object()

        from apps.settings.models import PlatformSettings
        cfg = PlatformSettings.load()
        if not cfg.einvoice_enabled:
            return Response({'detail': 'La facturación electrónica no está activa.'}, status=400)
        if order.status == OrderStatus.CANCELLED:
            return Response({'detail': 'La venta está cancelada.'}, status=400)
        if order.invoice_status in (Order.InvoiceStatus.PROCESSING,
                                    Order.InvoiceStatus.PENDING_SRI,
                                    Order.InvoiceStatus.AUTHORIZED):
            return Response(
                {'detail': 'La factura ya fue emitida o está en proceso.'}, status=400)

        from decimal import Decimal
        cdata = request.data.get('customer_data') or {}
        if not isinstance(cdata, dict):
            return Response({'detail': 'customer_data inválido.'}, status=400)

        ident = (cdata.get('identification') or '').strip()
        doc_type = (cdata.get('document_type') or '').strip()
        name = (cdata.get('name') or '').strip()
        business_name = (cdata.get('business_name') or '').strip()
        email = (cdata.get('email') or '').strip()
        address = (cdata.get('address') or '').strip()
        city = (cdata.get('city') or '').strip()
        province = (cdata.get('province') or '').strip()
        phone = (cdata.get('phone') or '').strip()

        # ── Validaciones (antes de tocar la BD) ──────────────────────────────
        # Forma de pago (SRI tabla 24), normalizada de forma segura.
        pf_in = request.data.get('payment_form')
        plazo_in = request.data.get('payment_plazo')
        unidad_in = request.data.get('payment_unidad')
        pf = plazo = unidad = None
        if pf_in is not None:
            pf = str(pf_in).strip() or '01'
            if pf not in ('01', '16', '17', '18', '19', '20'):
                pf = '01'
        if plazo_in is not None:
            try:
                plazo = int(plazo_in)
            except (TypeError, ValueError):
                return Response({'detail': 'Plazo inválido.'}, status=400)
            if plazo < 0:
                return Response({'detail': 'El plazo no puede ser negativo.'}, status=400)
        if unidad_in is not None:
            unidad = str(unidad_in).strip() or 'dias'
            if unidad not in ('dias', 'meses'):
                return Response({'detail': 'Unidad de tiempo inválida.'}, status=400)

        # Validación Consumidor Final: sin identificación (o 9999999999999) no se
        # puede facturar por encima del umbral configurado.
        is_cf = (not ident) or ident == '9999999999999'
        limit = Decimal(str(getattr(cfg, 'einvoice_consumidor_final_max', 50) or 50))
        order_total = order.total or Decimal('0')
        if is_cf and order_total >= limit:
            return Response({'detail': (
                f'Las ventas de ${limit:.2f} o más no pueden emitirse como '
                f'Consumidor Final. Ingresa la identificación del cliente.'
            )}, status=400)

        # ── Escritura atómica ────────────────────────────────────────────────
        from django.db import transaction
        from apps.customers.models import Customer
        with transaction.atomic():
            order_fields = []
            # 1) Solo para clientes REALES se actualiza/crea el cliente con los
            #    datos SRI. En Consumidor Final NO se toca el perfil del cliente
            #    (para no sobrescribir sus datos con el placeholder CF).
            if not is_cf:
                # Upsert por identificación dentro del tenant: si ya existe un
                # cliente con esa cédula/RUC se reutiliza y actualiza; si no,
                # se crea. Así el vendedor puede facturar a otro cliente
                # (buscándolo) o a uno nuevo sin salir del popup.
                customer = None
                if ident:
                    customer = Customer.objects.filter(
                        tenant=order.tenant, document_id=ident).first()
                if customer is None:
                    customer = order.customer
                if customer is None:
                    customer = Customer(tenant=order.tenant,
                                        full_name=(name or business_name or 'Cliente'))
                customer.document_id = ident
                if doc_type:
                    customer.document_type = doc_type
                if name:
                    customer.full_name = name
                # Razón social: explícita si vino; si es RUC (04) y no vino,
                # usa el nombre como razón social del contribuyente.
                if business_name:
                    customer.business_name = business_name
                elif doc_type == '04' and name:
                    customer.business_name = name
                if email:
                    customer.email = email
                if address:
                    customer.address = address
                if city:
                    customer.city = city
                if province:
                    customer.province = province
                if phone:
                    customer.phone = phone
                customer.save()
                order.customer = customer
                order_fields.append('customer')

            # 2) Forma de pago en la orden (solo lo que llegó).
            if pf is not None:
                order.payment_form = pf
                order_fields.append('payment_form')
            if plazo is not None:
                order.payment_plazo = plazo
                order_fields.append('payment_plazo')
            if unidad is not None:
                order.payment_unidad = unidad
                order_fields.append('payment_unidad')
            order.save(update_fields=list(dict.fromkeys(order_fields + ['updated_at'])))

            # 3) Marca PROCESSING de inmediato para que el detalle muestre
            #    "Generando factura" al instante (la emisión real es async; el
            #    webhook confirmará luego AUTORIZADA/RECHAZADA). Si el broker
            #    está caído, enqueue_invoice la deja en ERROR.
            order.invoice_status = Order.InvoiceStatus.PROCESSING
            order.invoice_error = ''
            order.invoice_message = ''
            order.invoice_updated_at = timezone.now()
            order.save(update_fields=[
                'invoice_status', 'invoice_error', 'invoice_message', 'invoice_updated_at',
            ])

            # 4) Encola la emisión en NovaFactura.
            from apps.orders.einvoice import enqueue_invoice
            enqueue_invoice(order)

        order.refresh_from_db()
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
        today = timezone.localdate()   # fecha local, igual que created_at__date
        today_qs = qs.filter(created_at__date=today)
        # Revenue NETO: total facturado menos los cambios devueltos.
        _tot = qs.filter(status=OrderStatus.PAID).aggregate(
            t=Sum('total'), c=Sum('total_changes'))
        _today = today_qs.filter(status=OrderStatus.PAID).aggregate(
            t=Sum('total'), c=Sum('total_changes'))
        return Response({
            'total_orders': qs.count(),
            'total_revenue': (_tot['t'] or 0) - (_tot['c'] or 0),
            'today_orders': today_qs.count(),
            'today_revenue': (_today['t'] or 0) - (_today['c'] or 0),
            'pending': qs.filter(status=OrderStatus.PENDING).count(),
            'paid': qs.filter(status=OrderStatus.PAID).count(),
            'cancelled': qs.filter(status=OrderStatus.CANCELLED).count(),
        })
