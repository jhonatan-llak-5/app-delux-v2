from decimal import Decimal
from django.db import transaction
from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsBranchManager
from apps.orders.models import Order, OrderItem, OrderStatus, OrderChannel, FulfillmentType
from apps.customers.models import Customer
from apps.variants.models import Variant
from apps.inventory.models import Stock, StockMovement
from .models import Payment, PaymentMethod, PaymentStatus
from .serializers import PaymentSerializer, PayPhoneInitOrderSerializer, PayPhoneConfirmSerializer
from .services import init_payphone_transaction, confirm_payment


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

        from apps.tenants.models import Tenant
        tenant = Tenant.objects.filter(is_active=True).first()

        # Cliente
        cd = data['customer_data']
        if not cd.get('email'):
            return Response({'detail': 'Email del cliente requerido.'}, status=400)
        customer, _ = Customer.objects.get_or_create(
            tenant=tenant, email=cd['email'],
            defaults={
                'full_name': cd.get('full_name', 'Cliente Web'),
                'phone': cd.get('phone', ''),
                'document_id': cd.get('document_id', ''),
            },
        )

        with transaction.atomic():
            # Generar codigo WEB
            today = timezone.now().strftime('%Y%m%d')
            seq = Order.objects.filter(
                tenant=tenant, code__startswith=f'WEB-{today}-'
            ).count() + 1
            code = f'WEB-{today}-{seq:04d}'

            order = Order.objects.create(
                tenant=tenant, code=code, branch_id=data['branch_id'],
                customer=customer,
                channel=OrderChannel.WEB,
                fulfillment=(FulfillmentType.PICKUP
                             if data.get('fulfillment') == 'PICKUP'
                             else FulfillmentType.SHIPPING),
                status=OrderStatus.PENDING,
                discount=data.get('discount', 0),
                coupon_code=data.get('coupon_code', ''),
                notes=data.get('notes', ''),
            )

            subtotal = Decimal('0')
            for it in data['items']:
                variant = Variant.objects.select_related('product').filter(
                    pk=it['variant_id']
                ).first()
                if not variant:
                    return Response({'detail': f"Variante {it['variant_id']} no existe."}, status=400)

                # Reservar stock (no decrementar — se hace en confirm)
                stock = Stock.objects.filter(
                    variant=variant, branch_id=data['branch_id']
                ).first()
                if not stock or stock.quantity - stock.reserved < it['quantity']:
                    return Response({'detail': f'Stock insuficiente para {variant.sku}.'}, status=400)
                stock.reserved += it['quantity']
                stock.save(update_fields=['reserved', 'updated_at'])

                unit_price = variant.price_override or variant.product.base_price
                item_subtotal = unit_price * it['quantity']
                OrderItem.objects.create(
                    tenant=tenant, order=order, variant=variant,
                    product_name=variant.product.name,
                    sku=variant.sku, size=variant.size, color=variant.color,
                    quantity=it['quantity'], unit_price=unit_price,
                    subtotal=item_subtotal,
                )
                subtotal += item_subtotal

            order.subtotal = subtotal
            order.total = subtotal - Decimal(str(data.get('discount', 0)))
            order.save(update_fields=['subtotal', 'total', 'updated_at'])

            # Iniciar PayPhone
            init_resp = init_payphone_transaction(order, data['return_url'])

        return Response({
            'order_id': order.id,
            'order_code': order.code,
            'order_total': str(order.total),
            **init_resp,
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
            # Si exitoso: convertir reservaciones en OUT y crear movimientos
            if success:
                for item in payment.order.items.all():
                    stock = Stock.objects.select_for_update().filter(
                        variant=item.variant, branch=payment.order.branch
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
            else:
                # Liberar reservaciones
                for item in payment.order.items.all():
                    stock = Stock.objects.filter(
                        variant=item.variant, branch=payment.order.branch
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
