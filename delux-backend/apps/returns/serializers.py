from rest_framework import serializers
from .models import ReturnRequest, ReturnItem, SaleChange


class ReturnItemSerializer(serializers.ModelSerializer):
    sku = serializers.CharField(source='order_item.sku', read_only=True)
    product_name = serializers.CharField(source='order_item.product_name', read_only=True)
    size = serializers.CharField(source='order_item.size', read_only=True)
    color = serializers.CharField(source='order_item.color', read_only=True)

    class Meta:
        model = ReturnItem
        fields = ('id', 'order_item', 'product_name', 'sku', 'size', 'color',
                  'quantity', 'refund_amount')


class ReturnSerializer(serializers.ModelSerializer):
    items = ReturnItemSerializer(many=True, read_only=True)
    order_code = serializers.CharField(source='order.code', read_only=True)
    customer_name = serializers.CharField(source='customer.full_name', read_only=True)
    reason_label = serializers.CharField(source='get_reason_display', read_only=True)
    status_label = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = ReturnRequest
        fields = ('id', 'code', 'order', 'order_code', 'customer', 'customer_name',
                  'reason', 'reason_label', 'note', 'status', 'status_label',
                  'refund_amount', 'admin_note', 'items', 'created_at')


class SaleChangeSerializer(serializers.ModelSerializer):
    """Historial admin de CAMBIOS (return-to-stock parcial ligado a la venta)."""
    order_code = serializers.CharField(source='order.code', read_only=True)
    tipo_label = serializers.CharField(source='get_tipo_display', read_only=True)
    branch_name = serializers.SerializerMethodField()
    actor_name = serializers.SerializerMethodField()
    sku = serializers.SerializerMethodField()
    size = serializers.SerializerMethodField()
    color = serializers.SerializerMethodField()

    class Meta:
        model = SaleChange
        fields = ('id', 'code', 'order', 'order_code', 'product_name',
                  'sku', 'size', 'color', 'quantity', 'valor_devuelto',
                  'tipo', 'tipo_label', 'descripcion', 'branch_name',
                  'actor_name', 'created_at')

    def get_branch_name(self, obj):
        return getattr(obj.branch, 'name', None) if obj.branch_id else None

    def get_actor_name(self, obj):
        return getattr(obj.actor, 'full_name', None) if obj.actor_id else None

    def get_sku(self, obj):
        return getattr(obj.order_item, 'sku', None) if obj.order_item_id else None

    def get_size(self, obj):
        return getattr(obj.order_item, 'size', None) if obj.order_item_id else None

    def get_color(self, obj):
        return getattr(obj.order_item, 'color', None) if obj.order_item_id else None
