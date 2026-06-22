from rest_framework import serializers
from .models import Payment


class PaymentSerializer(serializers.ModelSerializer):
    order_code = serializers.CharField(source='order.code', read_only=True)
    method_label = serializers.CharField(source='get_method_display', read_only=True)
    status_label = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = Payment
        fields = ('id', 'order', 'order_code', 'method', 'method_label',
                  'status', 'status_label', 'amount', 'external_id',
                  'created_at', 'updated_at')


class PayPhoneInitOrderSerializer(serializers.Serializer):
    """Crea orden WEB+PENDING + inicia pago PayPhone en un solo paso."""
    branch_id = serializers.IntegerField()
    fulfillment = serializers.ChoiceField(
        choices=['SHIPPING', 'PICKUP'], required=False, default='SHIPPING'
    )
    customer_data = serializers.DictField()
    items = serializers.ListField(child=serializers.DictField(), allow_empty=False)
    discount = serializers.DecimalField(max_digits=10, decimal_places=2, default=0)
    coupon_code = serializers.CharField(required=False, allow_blank=True)
    return_url = serializers.URLField()
    notes = serializers.CharField(max_length=500, required=False, allow_blank=True)


class PayPhoneConfirmSerializer(serializers.Serializer):
    """Confirmación tras retorno de PayPhone (o webhook)."""
    payment_id = serializers.IntegerField()
    success = serializers.BooleanField()
    transaction_id = serializers.CharField(required=False, allow_blank=True)
    raw = serializers.DictField(required=False)
