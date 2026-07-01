from decimal import Decimal
from django.db import transaction
from django.db.models import F
from django.utils import timezone
from rest_framework import serializers

from apps.customers.models import Customer
from apps.inventory.models import Stock, StockMovement
from apps.variants.models import Variant
from .models import Order, OrderItem, OrderStatus, OrderChannel, FulfillmentType


class OrderItemSerializer(serializers.ModelSerializer):
    product_image = serializers.URLField(source='variant.product.main_image_url', read_only=True)

    class Meta:
        model = OrderItem
        fields = ('id', 'variant', 'product_name', 'sku', 'size', 'color',
                  'quantity', 'unit_price', 'subtotal', 'product_image')
        read_only_fields = ('id', 'subtotal')


class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)
    items_count = serializers.IntegerField(read_only=True, default=0)
    branch_name = serializers.CharField(source='branch.name', read_only=True)
    customer_name = serializers.CharField(source='customer.full_name', read_only=True, default=None)
    seller_name = serializers.CharField(source='seller.full_name', read_only=True, default=None)

    class Meta:
        model = Order
        fields = ('id', 'code', 'branch', 'branch_name',
                  'customer', 'customer_name', 'seller', 'seller_name',
                  'channel', 'fulfillment', 'status',
                  'subtotal', 'discount', 'shipping_fee', 'tax', 'total',
                  'coupon_code', 'notes',
                  'items', 'items_count', 'created_at', 'updated_at')
        read_only_fields = ('id', 'code', 'subtotal', 'total', 'created_at', 'updated_at')


class POSItemInput(serializers.Serializer):
    variant_id = serializers.IntegerField()
    quantity = serializers.IntegerField(min_value=1)


def _safe_broadcast(order):
    from apps.notifications.broadcast import notify_new_sale
    notify_new_sale(order)


class POSCheckoutSerializer(serializers.Serializer):
    branch_id = serializers.IntegerField()
    items = POSItemInput(many=True)
    customer_id = serializers.IntegerField(required=False, allow_null=True)
    customer_data = serializers.DictField(required=False)
    discount = serializers.DecimalField(max_digits=10, decimal_places=2, default=0)
    notes = serializers.CharField(max_length=500, required=False, allow_blank=True)
    seller_id = serializers.IntegerField(required=False, allow_null=True)

    def validate(self, attrs):
        if not attrs.get('items'):
            raise serializers.ValidationError({'items': 'Carrito vacio.'})
        return attrs

    def create(self, validated_data):
        request = self.context['request']
        user = request.user
        items_input = validated_data.pop('items')
        branch_id = validated_data['branch_id']

        tenant = getattr(user, 'tenant', None)
        if tenant is None:
            from apps.tenants.models import Tenant
            tenant = Tenant.objects.filter(is_active=True).first()

        # Vendedor de la venta:
        # - Vendedor logueado -> siempre queda a su nombre.
        # - Gerente/Admin/Superadmin -> pueden elegir un vendedor o dejarla anonima (mostrador).
        seller = user if getattr(user, 'is_authenticated', False) else None
        role = getattr(user, 'role', None)
        if role in ('SUPERADMIN', 'TENANT_ADMIN', 'BRANCH_MANAGER') and 'seller_id' in validated_data:
            sid = validated_data.get('seller_id')
            if sid:
                from apps.accounts.models import User as _User
                seller = _User.objects.filter(pk=sid, tenant=tenant).first() or None
            else:
                seller = None  # venta anonima / mostrador

        customer = None
        if validated_data.get('customer_id'):
            customer = Customer.objects.filter(pk=validated_data['customer_id']).first()
        elif validated_data.get('customer_data'):
            cd = validated_data['customer_data']
            _email = (cd.get('email') or '').strip()
            _email_ok = False
            if _email:
                from django.core.validators import validate_email as _ve
                from django.core.exceptions import ValidationError as _VE
                try:
                    _ve(_email)
                    _email_ok = True
                except _VE:
                    _email_ok = False
            if _email_ok:
                customer, _ = Customer.objects.get_or_create(
                    tenant=tenant, email=_email,
                    defaults={
                        'full_name': cd.get('full_name', 'Cliente POS'),
                        'phone': cd.get('phone', ''),
                        'document_id': cd.get('document_id', ''),
                    },
                )
                from apps.customers.utils import link_customer_to_user
                link_customer_to_user(customer)

        with transaction.atomic():
            today = timezone.now().strftime('%Y%m%d')
            seq = Order.objects.filter(
                tenant=tenant, code__startswith=f'POS-{today}-'
            ).count() + 1
            code = f'POS-{today}-{seq:04d}'

            order = Order.objects.create(
                tenant=tenant, code=code, branch_id=branch_id,
                customer=customer,
                seller=seller,
                channel=OrderChannel.POS,
                fulfillment=FulfillmentType.PICKUP,
                status=OrderStatus.PAID,
                discount=validated_data.get('discount', 0),
                notes=validated_data.get('notes', ''),
            )

            subtotal = Decimal('0')
            from apps.settings.models import PlatformSettings
            tax_rate = Decimal(str(PlatformSettings.load().tax_rate or 0))
            for it in items_input:
                variant = Variant.objects.select_related('product').filter(
                    pk=it['variant_id']
                ).first()
                if not variant:
                    raise serializers.ValidationError(
                        {'items': f"Variante {it['variant_id']} no existe."}
                    )

                stock = Stock.objects.select_for_update().filter(
                    variant=variant, branch_id=branch_id
                ).first()
                if not stock or stock.quantity < it['quantity']:
                    raise serializers.ValidationError(
                        {'items': f'Stock insuficiente para {variant.sku}.'}
                    )
                stock.quantity -= it['quantity']
                stock.save(update_fields=['quantity', 'updated_at'])

                StockMovement.objects.create(
                    tenant=tenant, stock=stock,
                    type=StockMovement.TYPE_OUT,
                    quantity=-it['quantity'],
                    note=f'Venta POS {code}',
                    actor=user if user.is_authenticated else None,
                )

                net_price = variant.price_override or variant.product.base_price
                # Precio unitario con IVA incluido (la tienda no factura
                # electrónicamente: el IVA es solo para mostrar/cobrar).
                unit_price = (net_price * (Decimal('1') + tax_rate / Decimal('100'))
                              ).quantize(Decimal('0.01'))
                item_subtotal = unit_price * it['quantity']
                OrderItem.objects.create(
                    tenant=tenant, order=order, variant=variant,
                    product_name=variant.product.name,
                    sku=variant.sku, size=variant.size, color=variant.color,
                    quantity=it['quantity'], unit_price=unit_price,
                    subtotal=item_subtotal,
                )
                subtotal += item_subtotal

            # subtotal ya viene con IVA incluido; desglosamos el IVA contenido.
            tax_amount = (subtotal - subtotal / (Decimal('1') + tax_rate / Decimal('100'))
                          ).quantize(Decimal('0.01')) if tax_rate else Decimal('0')
            order.subtotal = subtotal
            order.tax = tax_amount
            order.total = subtotal - Decimal(str(validated_data.get('discount', 0)))
            order.save(update_fields=['subtotal', 'tax', 'total', 'updated_at'])

        try: _safe_broadcast(order)
        except Exception as e: print(f'[broadcast_pos] {e}')

        # Comprobante por email (solo si el cliente dejó un correo válido).
        if customer and getattr(customer, 'email', ''):
            try:
                from apps.notifications.services import notify_pos_receipt
                notify_pos_receipt(order)
            except Exception as e:
                print(f'[pos_receipt] {e}')

        return order
