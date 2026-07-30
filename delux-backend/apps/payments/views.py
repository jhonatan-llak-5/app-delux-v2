import secrets
from decimal import Decimal
from django.db import transaction
from django.db.models import F
from django.utils import timezone
from django.http import HttpResponse
from rest_framework import permissions, status, viewsets
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsBranchManager
from apps.branches.models import Branch
from apps.orders.models import Order, OrderItem, OrderStatus, OrderChannel, FulfillmentType
from apps.customers.models import Customer
from apps.variants.models import Variant
from apps.inventory.models import Stock, StockMovement
from .models import Payment, PaymentMethod, PaymentStatus
from .serializers import (
    PaymentSerializer, PayPhoneInitOrderSerializer, PayPhoneConfirmSerializer,
    CheckoutCODSerializer, CheckoutTransferSerializer,
)
from .services import init_payphone_transaction, confirm_payment
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.decorators import action


def _active_tenant():
    from apps.tenants.models import Tenant
    return Tenant.objects.filter(is_active=True).first()


def _resolve_web_customer(tenant, data, user=None):
    """Resuelve/vincula el cliente de una compra web por email/usuario.

    Reutilizado por create_web_orders. Lanza ValidationError si falta el email.
    """
    cd = data['customer_data']
    if not cd.get('email'):
        raise ValidationError({'detail': 'Email del cliente requerido.'})

    customer = None
    # Usuario logueado (cliente): el pedido se vincula SIEMPRE a su ficha de
    # perfil. No se crea otra ficha aunque escriba otro correo en el form.
    if (user is not None and getattr(user, 'is_authenticated', False)
            and getattr(user, 'role', '') == 'CUSTOMER'):
        from apps.customers.me_views import get_or_create_customer_for_user
        customer = get_or_create_customer_for_user(user)
        # Actualiza datos de contacto editados (sin cambiar el email de la cuenta).
        changed = False
        for fld in ('full_name', 'phone', 'document_id'):
            val = (cd.get(fld) or '').strip()
            if val and getattr(customer, fld) != val:
                setattr(customer, fld, val); changed = True
        if changed:
            customer.save()

    if customer is None:
        # Invitado (sin sesion): reutiliza por email o crea. Tolerante a
        # duplicados heredados; el email es unico por tienda a nivel de BD.
        customer = (Customer.objects
                    .filter(tenant=tenant, email__iexact=cd['email'])
                    .order_by('id').first())
        if customer is None:
            customer = Customer.objects.create(
                tenant=tenant, email=cd['email'],
                full_name=cd.get('full_name', 'Cliente Web'),
                phone=cd.get('phone', ''),
                document_id=cd.get('document_id', ''),
            )
        from apps.customers.utils import link_customer_to_user
        link_customer_to_user(customer)
    return customer


def create_web_orders(tenant, data, user=None):
    """Crea N pedidos WEB (uno por sucursal) que comparten un group_code.

    FASE 2 multi-sucursal: cada item puede traer su propia `branch_id`; los
    items se agrupan por sucursal y se crea un Order (PENDING) independiente por
    cada una, con sus OrderItem y su reserva de stock EN ESA sucursal (SIN
    fallback a otra sucursal). Devuelve la LISTA de Order creados.

    Las compras WEB NO emiten factura electrónica: son channel WEB y no
    disparan facturación.
    """
    customer = _resolve_web_customer(tenant, data, user)

    fallback_branch = data.get('branch_id')
    # Agrupa los items por sucursal (branch_id del item o, si no trae, el de
    # nivel superior como fallback). Preserva el orden de aparición.
    groups = {}
    for it in data['items']:
        bid = it.get('branch_id') or fallback_branch
        if not bid:
            raise ValidationError(
                {'detail': f"El producto (variante {it.get('variant_id')}) no "
                           f"tiene sucursal asignada."}
            )
        groups.setdefault(bid, []).append(it)

    fulfillment = data.get('fulfillment', 'SHIPPING')
    addr = data.get('shipping_address') or {}
    notes_val = (data.get('notes') or '').strip() or (addr.get('address') or '').strip()
    ref = (data.get('affiliate_ref') or '').strip()
    affiliate = None
    if ref:
        from apps.accounts.models import User, Role
        affiliate = User.objects.filter(
            ref_code=ref, role=Role.AFFILIATE, is_active=True).first()

    multi = len(groups) > 1
    today = timezone.now().strftime('%Y%m%d')
    # group_code común: solo se marca cuando la compra abarca varias sucursales.
    # En una sola sucursal se deja '' para no tratarla como multi-paquete.
    group_code = f'G-{today}-{secrets.token_hex(3).upper()}' if multi else ''

    # Secuencia base de códigos WEB del día: se incrementa por cada pedido para
    # que no colisionen al crear varios seguidos en la misma compra.
    base_seq = Order.objects.filter(
        tenant=tenant, code__startswith=f'WEB-{today}-'
    ).count()

    orders = []
    for offset, (branch_id, items) in enumerate(groups.items(), start=1):
        code = f'WEB-{today}-{base_seq + offset:04d}'

        # discount: solo se aplica en compra de UNA sola sucursal. En multi-
        # sucursal se ignora para no descontar de más en cada sub-pedido.
        # TODO: repartir el descuento proporcionalmente entre sub-pedidos.
        order_discount = (Decimal(str(data.get('discount', 0)))
                          if not multi else Decimal('0'))

        order = Order.objects.create(
            tenant=tenant, code=code, branch_id=branch_id,
            customer=customer,
            affiliate=affiliate,
            affiliate_ref=(ref if affiliate else ''),
            channel=OrderChannel.WEB,
            fulfillment=(FulfillmentType.PICKUP if fulfillment == 'PICKUP'
                         else FulfillmentType.SHIPPING),
            status=OrderStatus.PENDING,
            discount=order_discount,
            coupon_code=data.get('coupon_code', ''),
            group_code=group_code,
            notes=notes_val,
        )

        subtotal = Decimal('0')
        for it in items:
            variant = Variant.objects.select_related('product').filter(
                pk=it['variant_id'], product__deleted_at__isnull=True
            ).first()
            if not variant:
                raise ValidationError({'detail': f"Variante {it['variant_id']} no existe."})

            qty = it['quantity']
            # Sucursal EXPLÍCITA por item: sin fallback a otra sucursal. Si esa
            # sucursal no tiene stock suficiente, error claro.
            stock = Stock.objects.filter(
                variant=variant, branch_id=branch_id
            ).first()
            if not stock or (stock.quantity - stock.reserved) < qty:
                raise ValidationError(
                    {'detail': f'Sin stock suficiente para {variant.product.name} '
                               f'({variant.size}/{variant.color}) en la sucursal '
                               f'elegida.'}
                )
            stock.reserved += qty
            stock.save(update_fields=['reserved', 'updated_at'])

            _base = variant.price_override or variant.product.base_price
            unit_price = variant.product.offer_price(_base)
            item_subtotal = unit_price * qty
            OrderItem.objects.create(
                tenant=tenant, order=order, variant=variant,
                branch_id=branch_id,
                product_name=variant.product.name,
                sku=variant.sku, size=variant.size, color=variant.color,
                quantity=qty, unit_price=unit_price,
                subtotal=item_subtotal,
            )
            subtotal += item_subtotal

        order.subtotal = subtotal
        order.total = subtotal - order_discount
        order.save(update_fields=['subtotal', 'total', 'updated_at'])

        if fulfillment == 'SHIPPING':
            try:
                from apps.shipping.views import auto_create_shipment
                auto_create_shipment(order, addr)
            except Exception as e:
                print(f'[create_web_orders shipment] {e}')

        orders.append(order)

    return orders


def create_web_order(tenant, data, user=None):
    """Wrapper de compatibilidad: crea los pedidos web y devuelve el PRIMERO.

    Se mantiene para llamadores que esperan un solo Order. Las vistas de
    checkout usan create_web_orders (multi-sucursal).
    """
    return create_web_orders(tenant, data, user)[0]


def _broadcast_new_order(order):
    """Notifica en tiempo real al panel (admin de tienda + vendedores conectados)."""
    try:
        from apps.notifications.broadcast import notify_new_order
        notify_new_order(order)
    except Exception as e:
        print(f'[broadcast_new_order] {e}')


def _maybe_create_shipment(order):
    """Crea el envío (seguimiento) para pedidos a domicilio. None si es retiro."""
    try:
        from apps.shipping.views import auto_create_shipment
        return auto_create_shipment(order)
    except Exception as e:
        print(f'[auto_create_shipment] {e}')
        return None


def _email_receipt(order):
    """Envía al cliente el comprobante por correo (best-effort)."""
    try:
        from apps.notifications.services import notify_order_received
        notify_order_received(order)
    except Exception as e:
        print(f'[email_receipt] {e}')


class AdminPaymentViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = PaymentSerializer
    permission_classes = [permissions.IsAuthenticated, IsBranchManager]

    def get_queryset(self):
        qs = Payment.objects.select_related('order')
        params = self.request.query_params
        if params.get('status'): qs = qs.filter(status=params['status'])
        if params.get('method'): qs = qs.filter(method=params['method'])
        if params.get('order'): qs = qs.filter(order_id=params['order'])
        return qs.order_by('-created_at')

    @action(detail=True, methods=['post'])
    def confirm(self, request, pk=None):
        """Valida el comprobante: confirma el pago, marca el pedido PAGADO y
        convierte la reserva de stock en salida real."""
        payment = self.get_object()
        if payment.status == PaymentStatus.SUCCEEDED:
            return Response({'detail': 'El pago ya estaba confirmado.'}, status=200)
        with transaction.atomic():
            confirm_payment(payment, True, {'validated_by': request.user.id})
            order = payment.order
            for item in order.items.all():
                item_branch = item.branch_id or order.branch_id
                stock = Stock.objects.select_for_update().filter(
                    variant=item.variant, branch_id=item_branch
                ).first()
                if stock:
                    web_before = stock.quantity
                    stock.reserved = max(0, stock.reserved - item.quantity)
                    stock.quantity = max(0, stock.quantity - item.quantity)
                    stock.save(update_fields=['reserved', 'quantity', 'updated_at'])
                    StockMovement.objects.create(
                        tenant=payment.tenant, stock=stock,
                        type=StockMovement.TYPE_OUT, quantity=-item.quantity,
                        note=f'Venta WEB {order.code} (comprobante validado)',
                        qty_before=web_before, qty_after=stock.quantity,
                    )
        return Response(self.get_serializer(payment).data)

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        """Rechaza el comprobante: marca el pago fallido, libera la reserva y
        cancela el pedido."""
        payment = self.get_object()
        with transaction.atomic():
            payment.status = PaymentStatus.FAILED
            payment.raw_payload = {**(payment.raw_payload or {}),
                                   'rejected_by': request.user.id}
            payment.save(update_fields=['status', 'raw_payload'])
            order = payment.order
            for item in order.items.all():
                item_branch = item.branch_id or order.branch_id
                stock = Stock.objects.filter(
                    variant=item.variant, branch_id=item_branch
                ).first()
                if stock:
                    stock.reserved = max(0, stock.reserved - item.quantity)
                    stock.save(update_fields=['reserved', 'updated_at'])
            order.status = OrderStatus.CANCELLED
            order.save(update_fields=['status', 'updated_at'])
        return Response(self.get_serializer(payment).data)


class CheckoutPayPhoneInitView(APIView):
    """Crea orden WEB+PENDING + inicia transacción PayPhone. PUBLICO."""
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        s = PayPhoneInitOrderSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        data = s.validated_data

        tenant = _active_tenant()
        with transaction.atomic():
            orders = create_web_orders(tenant, data, user=request.user)
            # PayPhone (sandbox/bloqueado) NO soporta confirmación multi-pedido:
            # PayPhoneConfirmView opera sobre un único Payment/pedido. Opción más
            # segura: PayPhone solo para compras de UNA sola sucursal; si la compra
            # abarca varias, se exige otro método. Al lanzar el error dentro de la
            # transacción se revierten los pedidos creados y sus reservas de stock.
            if len(orders) > 1:
                raise ValidationError({'detail':
                    'PayPhone no está disponible para compras de varias sucursales. '
                    'Usa transferencia o contra entrega.'})
            order = orders[0]
            init_resp = init_payphone_transaction(order, data['return_url'])

        return Response({
            'group_code': order.group_code,
            'order_id': order.id,
            'order_code': order.code,
            'order_total': str(order.total),
            'orders': [{
                'order_id': order.id,
                'order_code': order.code,
                'order_total': str(order.total),
                'branch_id': order.branch_id,
                'branch_name': order.branch.name,
            }],
            **init_resp,
        }, status=status.HTTP_201_CREATED)


class CheckoutCODView(APIView):
    """Crea un pedido WEB con pago CONTRA ENTREGA. PUBLICO.

    El pedido queda registrado (PREPARING), descuenta el stock de inmediato y
    notifica en tiempo real al panel. El cobro se hace al momento de la entrega.
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        s = CheckoutCODSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        data = s.validated_data

        tenant = _active_tenant()
        results = []
        with transaction.atomic():
            orders = create_web_orders(tenant, data, user=request.user)

            for order in orders:
                # Convierte la reserva en salida real (stock correcto desde ya)
                # en la sucursal de cada sub-pedido.
                for item in order.items.all():
                    item_branch = item.branch_id or order.branch_id
                    stock = Stock.objects.select_for_update().filter(
                        variant=item.variant, branch_id=item_branch
                    ).first()
                    if stock:
                        web_before = stock.quantity
                        stock.reserved = max(0, stock.reserved - item.quantity)
                        stock.quantity = max(0, stock.quantity - item.quantity)
                        stock.save(update_fields=['reserved', 'quantity', 'updated_at'])
                        StockMovement.objects.create(
                            tenant=tenant, stock=stock,
                            type=StockMovement.TYPE_OUT,
                            quantity=-item.quantity,
                            note=f'Venta WEB contra entrega {order.code}',
                            qty_before=web_before, qty_after=stock.quantity,
                        )

                order.status = OrderStatus.PREPARING
                order.save(update_fields=['status', 'updated_at'])

                # Cada sucursal cobra su total por separado: un Payment por pedido.
                Payment.objects.create(
                    tenant=tenant, order=order,
                    method=PaymentMethod.CASH,
                    status=PaymentStatus.PENDING,
                    amount=order.total,
                    raw_payload={'cod': True},
                )

                # Envío a domicilio: genera el seguimiento del pedido.
                shipment = _maybe_create_shipment(order)
                results.append((order, shipment))

        for order, _shipment in results:
            _broadcast_new_order(order)
            _email_receipt(order)

        group_code = orders[0].group_code if orders else ''
        return Response({
            'group_code': group_code,
            'method': 'CASH',
            'orders': [{
                'order_id': order.id,
                'order_code': order.code,
                'order_total': str(order.total),
                'order_status': order.status,
                'branch_id': order.branch_id,
                'branch_name': order.branch.name,
                'tracking_code': shipment.tracking_code if shipment else None,
            } for order, shipment in results],
        }, status=status.HTTP_201_CREATED)


class CheckoutTransferView(APIView):
    """Crea un pedido WEB con pago por TRANSFERENCIA o DE UNA. PUBLICO.

    Recibe multipart: `payload` (JSON con los datos del pedido) + `voucher`
    (imagen del comprobante, OBLIGATORIO). El pedido queda PENDING a la espera
    de que el panel de Ventas valide el comprobante; ahí se confirma el pago y
    se descuenta el stock (mientras tanto queda reservado).
    """
    permission_classes = [permissions.AllowAny]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def post(self, request):
        import json
        raw = request.data.get('payload')
        if raw:
            try:
                data_in = json.loads(raw) if isinstance(raw, str) else raw
            except Exception:
                raise ValidationError({'detail': 'payload inválido.'})
        else:
            data_in = request.data

        method = (data_in.get('method') or 'TRANSFER').upper()
        if method not in ('TRANSFER', 'DEUNA'):
            raise ValidationError({'method': 'Método de pago inválido.'})

        voucher = request.FILES.get('voucher')
        if voucher is None:
            raise ValidationError({'voucher': 'Debes subir el comprobante de pago.'})

        s = CheckoutTransferSerializer(data=data_in)
        s.is_valid(raise_exception=True)
        data = s.validated_data

        tenant = _active_tenant()
        with transaction.atomic():
            orders = create_web_orders(tenant, data, user=request.user)
            # El MISMO comprobante subido se adjunta al Payment de CADA sub-pedido
            # (un solo comprobante por el total): cada sucursal lo valida en su
            # panel por separado.
            for order in orders:
                Payment.objects.create(
                    tenant=tenant, order=order,
                    method=(PaymentMethod.DEUNA if method == 'DEUNA'
                            else PaymentMethod.TRANSFER),
                    status=PaymentStatus.PENDING,
                    amount=order.total,
                    voucher=voucher,
                    raw_payload={'awaiting_validation': True, 'method': method},
                )

        for order in orders:
            _broadcast_new_order(order)
            _email_receipt(order)

        group_code = orders[0].group_code if orders else ''
        return Response({
            'group_code': group_code,
            'method': method,
            'orders': [{
                'order_id': order.id,
                'order_code': order.code,
                'order_total': str(order.total),
                'order_status': order.status,
                'branch_id': order.branch_id,
                'branch_name': order.branch.name,
            } for order in orders],
        }, status=status.HTTP_201_CREATED)


class PayPhoneConfirmView(APIView):
    """Confirma o falla un pago. Reservaciones se convierten en salidas reales."""
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        s = PayPhoneConfirmSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        data = s.validated_data

        payment = Payment.objects.filter(pk=data['payment_id']).first()
        if not payment:
            return Response({'detail': 'Pago no encontrado.'}, status=404)
        if payment.status != PaymentStatus.PENDING:
            return Response({
                'detail': f'Pago ya estaba {payment.status}.',
                'order_code': payment.order.code,
            }, status=200)

        success = data['success']
        with transaction.atomic():
            confirm_payment(payment, success, data.get('raw'))
            if success:
                for item in payment.order.items.all():
                    item_branch = item.branch_id or payment.order.branch_id
                    stock = Stock.objects.select_for_update().filter(
                        variant=item.variant, branch_id=item_branch
                    ).first()
                    if stock:
                        web_before = stock.quantity
                        stock.reserved = max(0, stock.reserved - item.quantity)
                        stock.quantity = max(0, stock.quantity - item.quantity)
                        stock.save(update_fields=['reserved', 'quantity', 'updated_at'])
                        StockMovement.objects.create(
                            tenant=payment.tenant, stock=stock,
                            type=StockMovement.TYPE_OUT,
                            quantity=-item.quantity,
                            note=f'Venta WEB {payment.order.code}',
                            qty_before=web_before, qty_after=stock.quantity,
                        )
                _maybe_create_shipment(payment.order)
                _email_receipt(payment.order)
            else:
                for item in payment.order.items.all():
                    item_branch = item.branch_id or payment.order.branch_id
                    stock = Stock.objects.filter(
                        variant=item.variant, branch_id=item_branch
                    ).first()
                    if stock:
                        stock.reserved = max(0, stock.reserved - item.quantity)
                        stock.save(update_fields=['reserved', 'updated_at'])

        return Response({
            'detail': 'Pago confirmado.' if success else 'Pago fallido.',
            'order_code': payment.order.code,
            'order_status': payment.order.status,
            'payment_status': payment.status,
        })


class CheckoutReceiptView(APIView):
    """Comprobante de pedido en PDF (con QR). Público por código de pedido."""
    permission_classes = [permissions.AllowAny]

    def get(self, request, code):
        order = (Order.objects
                 .select_related('customer', 'branch')
                 .prefetch_related('items', 'payments')
                 .filter(code=code).first())
        if not order:
            return HttpResponse('Comprobante no encontrado.', status=404)
        from .receipt import build_order_receipt_pdf
        try:
            pdf = build_order_receipt_pdf(order, request)
        except Exception:
            import logging
            logging.getLogger(__name__).exception('Error generando comprobante %s', code)
            return HttpResponse('No se pudo generar el comprobante.', status=500)
        resp = HttpResponse(pdf, content_type='application/pdf')
        resp['Content-Disposition'] = f'inline; filename="comprobante-{order.code}.pdf"'
        return resp
