from rest_framework import serializers
from .models import ReturnRequest, ReturnItem


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
