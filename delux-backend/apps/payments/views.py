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
from apps.orders.models import Order, OrderItem, OrderStatus, OrderChannel, FulfillmentType
from apps.customers.models import Customer
from apps.variants.models import Variant
from apps.inventory.models import Stock, StockMovement
from .models import Payment, PaymentMethod, PaymentStatus
from .serializers import (
    PaymentSerializer, PayPhoneInitOrderSerializer, PayPhoneConfirmSerializer,
    CheckoutCODSerializer,
)
from .services import init_payphone_transaction, confirm_payment


def _active_tenant():
    from apps.tenants.models import Tenant
    return Tenant.objects.filter(is_active=True).first()


def create_web_order(tenant, data):
    """Crea un pedido WEB (PENDING) con sus ítems y RESERVA el stock.

    Reutilizado por el checkout PayPhone y por el de contra entrega.
    Lanza ValidationError (-> 400) si falta el cliente, una variante o el stock.
    """
    cd = data['customer_data']
    if not cd.get('email'):
        raise ValidationError({'detail': 'Email del cliente requerido.'})

    customer, _ = Customer.objects.get_or_create(
        tenant=tenant, email=cd['email'],
        defaults={
            'full_name': cd.get('full_name', 'Cliente Web'),
            'phone': cd.get('phone', ''),
            'document_id': cd.get('document_id', ''),
        },
    )
    from apps.customers.utils import link_customer_to_user
    link_customer_to_user(customer)

    today = timezone.now().strftime('%Y%m%d')
    seq = Order.objects.filter(
        tenant=tenant, code__startswith=f'WEB-{today}-'
    ).count() + 1
    code = f'WEB-{today}-{seq:04d}'

    fulfillment = data.get('fulfillment', 'SHIPPING')
    addr = data.get('shipping_address') or {}
    notes_val = (data.get('notes') or '').strip() or (addr.get('address') or '').strip()
    order = Order.objects.create(
        tenant=tenant, code=code, branch_id=data['branch_id'],
        customer=customer,
        channel=OrderChannel.WEB,
        fulfillment=(FulfillmentType.PICKUP if fulfillment == 'PICKUP'
                     else FulfillmentType.SHIPPING),
        status=OrderStatus.PENDING,
        discount=data.get('discount', 0),
        coupon_code=data.get('coupon_code', ''),
        notes=notes_val,
    )

    subtotal = Decimal('0')
    for it in data['items']:
        variant = Variant.objects.select_related('product').filter(
            pk=it['variant_id']
        ).first()
        if not variant:
            raise ValidationError({'detail': f"Variante {it['variant_id']} no existe."})

        qty = it['quantity']
        stock = Stock.objects.filter(
            variant=variant, branch_id=data['branch_id']
        ).first()
        has_local = stock and (stock.quantity - stock.reserved) >= qty
        if has_local:
            chosen = stock
        elif fulfillment == 'PICKUP':
            raise ValidationError(
                {'detail': f'Sin stock para retiro de {variant.product.name} '
                           f'({variant.size}/{variant.color}) en la sucursal elegida. '
                           f'Prueba con envío a domicilio.'}
            )
        else:
            chosen = (Stock.objects
                      .filter(variant=variant, tenant=tenant)
                      .annotate(avail=F('quantity') - F('reserved'))
                      .filter(avail__gte=qty)
                      .order_by('-avail')
                      .first())
            if not chosen:
                raise ValidationError(
                    {'detail': f'Sin stock disponible para {variant.product.name} '
                               f'({variant.size}/{variant.color}) en ninguna sucursal.'}
                )
        chosen.reserved += qty
        chosen.save(update_fields=['reserved', 'updated_at'])

        unit_price = variant.price_override or variant.product.base_price
        item_subtotal = unit_price * qty
        OrderItem.objects.create(
            tenant=tenant, order=order, variant=variant,
            branch=chosen.branch,
            product_name=variant.product.name,
            sku=variant.sku, size=variant.size, color=variant.color,
            quantity=qty, unit_price=unit_price,
            subtotal=item_subtotal,
        )
        subtotal += item_subtotal

    order.subtotal = subtotal
    order.total = subtotal - Decimal(str(data.get('discount', 0)))
    order.save(update_fields=['subtotal', 'total', 'updated_at'])

    if fulfillment == 'SHIPPING':
        try:
            from apps.shipping.views import auto_create_shipment
            auto_create_shipment(order, addr)
        except Exception as e:
            print(f'[create_web_order shipment] {e}')
    return order


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
        return qs.order_by('-created_at')


class CheckoutPayPhoneInitView(APIView):
    """Crea orden WEB+PENDING + inicia transacción PayPhone. PUBLICO."""
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        s = PayPhoneInitOrderSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        data = s.validated_data

        tenant = _active_tenant()
        with transaction.atomic():
            order = create_web_order(tenant, data)
            init_resp = init_payphone_transaction(order, data['return_url'])

        return Response({
            'order_id': order.id,
            'order_code': order.code,
            'order_total': str(order.total),
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
        with transaction.atomic():
            order = create_web_order(tenant, data)

            # Convierte la reserva en salida real (stock correcto desde ya).
            for item in order.items.all():
                item_branch = item.branch_id or order.branch_id
                stock = Stock.objects.select_for_update().filter(
                    variant=item.variant, branch_id=item_branch
                ).first()
                if stock:
                    stock.reserved = max(0, stock.reserved - item.quantity)
                    stock.quantity = max(0, stock.quantity - item.quantity)
                    stock.save(update_fields=['reserved', 'quantity', 'updated_at'])
                    StockMovement.objects.create(
                        tenant=tenant, stock=stock,
                        type=StockMovement.TYPE_OUT,
                        quantity=-item.quantity,
                        note=f'Venta WEB contra entrega {order.code}',
                    )

            order.status = OrderStatus.PREPARING
            order.save(update_fields=['status', 'updated_at'])

            Payment.objects.create(
                tenant=tenant, order=order,
                method=PaymentMethod.CASH,
                status=PaymentStatus.PENDING,
                amount=order.total,
                raw_payload={'cod': True},
            )

            # Envío a domicilio: genera el seguimiento del pedido.
            shipment = _maybe_create_shipment(order)

        _broadcast_new_order(order)
        _email_receipt(order)

        return Response({
            'order_id': order.id,
            'order_code': order.code,
            'order_total': str(order.total),
            'method': 'CASH',
            'order_status': order.status,
            'tracking_code': shipment.tracking_code if shipment else None,
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
                        stock.reserved = max(0, stock.reserved - item.quantity)
                        stock.quantity = max(0, stock.quantity - item.quantity)
                        stock.save(update_fields=['reserved', 'quantity', 'updated_at'])
                        StockMovement.objects.create(
                            tenant=payment.tenant, stock=stock,
                            type=StockMovement.TYPE_OUT,
                            quantity=-item.quantity,
                            note=f'Venta WEB {payment.order.code}',
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
            return Response({'detail': 'Pedido no encontrado.'}, status=404)
        from .receipt import build_order_receipt_pdf
        pdf = build_order_receipt_pdf(order, request)
        resp = HttpResponse(pdf, content_type='application/pdf')
        resp['Content-Disposition'] = f'inline; filename="comprobante-{order.code}.pdf"'
        return resp
