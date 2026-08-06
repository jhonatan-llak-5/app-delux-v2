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


class SaleChangeMiniSerializer(serializers.Serializer):
    """Serializer ligero de un CAMBIO, embebido en el detalle de la venta.
    Definido inline para evitar imports circulares con apps.returns."""
    id = serializers.IntegerField(read_only=True)
    code = serializers.CharField(read_only=True)
    product_name = serializers.CharField(read_only=True)
    quantity = serializers.IntegerField(read_only=True)
    valor_devuelto = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    tipo = serializers.CharField(read_only=True)
    tipo_label = serializers.CharField(source='get_tipo_display', read_only=True)
    descripcion = serializers.CharField(read_only=True)
    created_at = serializers.DateTimeField(read_only=True)


class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)
    items_count = serializers.IntegerField(read_only=True, default=0)
    branch_name = serializers.CharField(source='branch.name', read_only=True)
    customer_name = serializers.CharField(source='customer.full_name', read_only=True, default=None)
    seller_name = serializers.CharField(source='seller.full_name', read_only=True, default=None)
    customer_email = serializers.CharField(source='customer.email', read_only=True, default=None)
    customer_phone = serializers.CharField(source='customer.phone', read_only=True, default=None)
    customer_document = serializers.CharField(source='customer.document_id', read_only=True, default=None)
    customer_address = serializers.CharField(source='customer.address', read_only=True, default=None)
    customer_city = serializers.CharField(source='customer.city', read_only=True, default=None)
    net_total = serializers.SerializerMethodField()
    changes = serializers.SerializerMethodField()

    def get_net_total(self, obj):
        return str(obj.net_total)

    def get_changes(self, obj):
        return SaleChangeMiniSerializer(obj.changes.all(), many=True).data

    class Meta:
        model = Order
        fields = ('id', 'code', 'group_code', 'branch', 'branch_name',
                  'customer', 'customer_name', 'customer_email', 'customer_phone', 'customer_document',
                  'customer_address', 'customer_city',
                  'seller', 'seller_name',
                  'channel', 'fulfillment', 'status', 'cancel_reason',
                  'subtotal', 'discount', 'shipping_fee', 'tax', 'total',
                  'total_changes', 'net_total', 'changes',
                  'coupon_code', 'notes',
                  'payment_form', 'payment_plazo', 'payment_unidad',
                  'invoice_status', 'invoice_number', 'invoice_access_key', 'invoice_authorization',
                  'invoice_pdf_url', 'invoice_xml_url', 'invoice_message', 'invoice_error', 'invoice_updated_at',
                  'items', 'items_count', 'created_at', 'updated_at')
        read_only_fields = ('id', 'code', 'group_code', 'subtotal', 'total', 'total_changes',
                            'payment_form', 'payment_plazo', 'payment_unidad',
                            'created_at', 'updated_at',
                            'invoice_status', 'invoice_number', 'invoice_access_key', 'invoice_authorization',
                            'invoice_pdf_url', 'invoice_xml_url', 'invoice_message', 'invoice_error', 'invoice_updated_at')


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
    payment_form = serializers.CharField(max_length=2, required=False, default='01')
    payment_plazo = serializers.IntegerField(required=False, default=0)
    payment_unidad = serializers.CharField(max_length=8, required=False, default='dias')

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
        if role in ('SUPERADMIN', 'BRANCH_MANAGER') and 'seller_id' in validated_data:
            sid = validated_data.get('seller_id')
            if sid:
                from apps.accounts.models import User as _User
                seller = _User.objects.filter(pk=sid, tenant=tenant).first() or None
            else:
                seller = None  # venta anonima / mostrador

        customer = None
        if validated_data.get('customer_id'):
            customer = Customer.objects.filter(pk=validated_data['customer_id'], tenant=tenant).first()
            # Si el vendedor editó los datos del cliente en el POS, se actualiza la
            # ficha (todo menos el email, que es la clave única del cliente).
            cd = validated_data.get('customer_data') or {}
            if customer and cd:
                _upd = []
                for _f in ('full_name', 'phone', 'document_id', 'document_type',
                           'business_name', 'address', 'province'):
                    if _f in cd and (cd.get(_f) or '') != (getattr(customer, _f, '') or ''):
                        setattr(customer, _f, cd.get(_f) or '')
                        _upd.append(_f)
                if _upd:
                    customer.save(update_fields=_upd)
        elif validated_data.get('customer_data'):
            cd = validated_data['customer_data']
            _email = (cd.get('email') or '').strip()
            _defaults = {
                'full_name': cd.get('full_name') or 'Cliente POS',
                'phone': cd.get('phone', ''),
                'document_id': cd.get('document_id', ''),
                'document_type': cd.get('document_type') or '05',
                'business_name': cd.get('business_name', ''),
                'address': cd.get('address', ''),
                'province': cd.get('province', ''),
            }
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
                    tenant=tenant, email=_email, defaults=_defaults,
                )
                from apps.customers.utils import link_customer_to_user
                link_customer_to_user(customer)
            elif (cd.get('full_name') or '').strip():
                # Cliente sin correo (mostrador con datos): se crea y queda guardado.
                customer = Customer.objects.create(tenant=tenant, email='', **_defaults)

        # Consumidor Final: si el dueño lo activó y la venta no tiene cliente.
        if customer is None:
            from apps.settings.models import PlatformSettings as _PS
            if getattr(_PS.load(), 'consumidor_final_enabled', False):
                from apps.customers.utils import get_or_create_consumidor_final
                customer = get_or_create_consumidor_final(tenant)

        # Forma de pago (SRI tabla 24). Se normaliza con valores por defecto
        # seguros para no romper la emisión si llega algo inesperado.
        _pf = (validated_data.get('payment_form') or '01')
        if _pf not in ('01', '16', '17', '18', '19', '20'):
            _pf = '01'
        try:
            _plazo = int(validated_data.get('payment_plazo') or 0)
        except (TypeError, ValueError):
            _plazo = 0
        if _plazo < 0:
            _plazo = 0
        _unidad = (validated_data.get('payment_unidad') or 'dias')
        if _unidad not in ('dias', 'meses'):
            _unidad = 'dias'

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
                payment_form=_pf,
                payment_plazo=_plazo,
                payment_unidad=_unidad,
            )

            subtotal = Decimal('0')
            tax_amount = Decimal('0')
            for it in items_input:
                variant = Variant.objects.select_related('product').filter(
                    pk=it['variant_id'], product__deleted_at__isnull=True
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
                pos_before = stock.quantity
                stock.quantity -= it['quantity']
                stock.save(update_fields=['quantity', 'updated_at'])

                StockMovement.objects.create(
                    tenant=tenant, stock=stock,
                    type=StockMovement.TYPE_OUT,
                    quantity=-it['quantity'],
                    note=f'Venta POS {code}',
                    actor=user if user.is_authenticated else None,
                    qty_before=pos_before, qty_after=stock.quantity,
                )

                prod = variant.product
                # base_price / price_override YA es el precio final (IVA incluido).
                # Si el producto está en oferta, se aplica el % de descuento global.
                _base = variant.price_override or prod.base_price
                unit_price = prod.offer_price(_base)
                item_subtotal = unit_price * it['quantity']
                OrderItem.objects.create(
                    tenant=tenant, order=order, variant=variant,
                    product_name=prod.name,
                    sku=variant.sku, size=variant.size, color=variant.color,
                    quantity=it['quantity'], unit_price=unit_price,
                    subtotal=item_subtotal,
                )
                subtotal += item_subtotal
                # IVA contenido segun el IVA propio del producto.
                ptax = prod.effective_tax_rate()
                if ptax:
                    tax_amount += (item_subtotal - item_subtotal / (Decimal('1') + ptax / Decimal('100'))).quantize(Decimal('0.01'))

            # tax_amount ya se acumulo por item (IVA por producto).
            order.subtotal = subtotal
            order.tax = tax_amount
            order.total = subtotal - Decimal(str(validated_data.get('discount', 0)))
            order.save(update_fields=['subtotal', 'tax', 'total', 'updated_at'])

            # Regla SRI: Consumidor Final solo para ventas por debajo del umbral
            # (por defecto $50). De ese monto en adelante, se exige cliente con
            # cedula/RUC real. Solo aplica si la facturacion electronica esta
            # activa. Se valida dentro de la transaccion: al lanzar el error se
            # revierte el pedido y el descuento de stock.
            from apps.settings.models import PlatformSettings as _PScf
            _cfg = _PScf.load()
            if getattr(_cfg, 'einvoice_enabled', False):
                _ident = (getattr(customer, 'document_id', '') or '').strip() if customer else ''
                _is_cf = (not _ident) or _ident == '9999999999999'
                _limit = Decimal(str(getattr(_cfg, 'einvoice_consumidor_final_max', 50) or 50))
                if _is_cf and order.total >= _limit:
                    raise serializers.ValidationError({
                        'customer': (
                            f'Las ventas de ${_limit:.2f} o más no pueden facturarse '
                            f'como Consumidor Final. Selecciona o crea un cliente con '
                            f'cédula o RUC para continuar.'
                        )
                    })

        try: _safe_broadcast(order)
        except Exception as e: print(f'[broadcast_pos] {e}')

        # Comprobante por email (solo si el cliente dejó un correo válido).
        # Se ENCOLA en segundo plano para no bloquear el cobro en el POS: la
        # respuesta vuelve al instante y el correo se envía después (Celery).
        # Si el broker no está disponible, dispatch() cae a envío en línea.
        if customer and getattr(customer, 'email', ''):
            try:
                from apps.accounts.tasks import dispatch
                from apps.notifications.tasks import send_pos_receipt_email
                dispatch(send_pos_receipt_email, order.id)
            except Exception as e:
                print(f'[pos_receipt] {e}')

        # Factura electrónica (NovaFactura), en segundo plano y sin bloquear el
        # cobro. Solo se dispara si la facturación está activa en la config.
        try:
            from apps.orders.einvoice import enqueue_invoice
            enqueue_invoice(order)
        except Exception as e:
            print(f'[einvoice] {e}')

        return order
