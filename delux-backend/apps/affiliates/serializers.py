from rest_framework import serializers
from .models import Commission, CommissionPayout


class CommissionSerializer(serializers.ModelSerializer):
    order_code = serializers.CharField(source='order.code', read_only=True)
    order_status = serializers.CharField(source='order.status', read_only=True)
    order_total = serializers.DecimalField(source='order.total', max_digits=10,
                                           decimal_places=2, read_only=True)
    customer_name = serializers.CharField(source='order.customer.full_name',
                                          read_only=True, default='')
    affiliate_name = serializers.CharField(source='affiliate.full_name',
                                           read_only=True, default='')
    ref_code = serializers.CharField(source='affiliate.ref_code', read_only=True, default='')

    class Meta:
        model = Commission
        fields = (
            'id', 'order_code', 'order_status', 'order_total', 'customer_name',
            'affiliate_name', 'ref_code',
            'base_amount', 'rate', 'amount', 'status', 'paid_at', 'created_at',
        )


class AffiliateAdminSerializer(serializers.Serializer):
    """Resumen por afiliado para la gestion del admin."""
    id = serializers.IntegerField()
    full_name = serializers.CharField()
    email = serializers.EmailField()
    ref_code = serializers.CharField()
    is_active = serializers.BooleanField()
    date_joined = serializers.DateTimeField()
    sales_count = serializers.IntegerField()
    commission_pending = serializers.FloatField()
    commission_paid = serializers.FloatField()


class PayoutSerializer(serializers.ModelSerializer):
    affiliate_name = serializers.CharField(source='affiliate.full_name',
                                           read_only=True, default='')
    ref_code = serializers.CharField(source='affiliate.ref_code', read_only=True, default='')
    paid_by_name = serializers.CharField(source='paid_by.full_name',
                                         read_only=True, default='')
    method_label = serializers.CharField(source='get_method_display', read_only=True)

    class Meta:
        model = CommissionPayout
        fields = (
            'id', 'affiliate', 'affiliate_name', 'ref_code', 'amount',
            'method', 'method_label', 'reference', 'commissions_count',
            'paid_by_name', 'created_at',
        )
        read_only_fields = ('amount', 'commissions_count')


class PayoutCreateSerializer(serializers.Serializer):
    affiliate = serializers.IntegerField()
    method = serializers.ChoiceField(choices=['CASH', 'TRANSFER'], default='CASH')
    reference = serializers.CharField(required=False, allow_blank=True, max_length=160)
    commission_ids = serializers.ListField(
        child=serializers.IntegerField(), required=False)
