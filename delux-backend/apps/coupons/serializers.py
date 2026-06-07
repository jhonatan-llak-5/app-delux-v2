from decimal import Decimal
from django.utils import timezone
from rest_framework import serializers
from .models import Coupon


class CouponSerializer(serializers.ModelSerializer):
    is_valid = serializers.SerializerMethodField()
    type_label = serializers.SerializerMethodField()

    class Meta:
        model = Coupon
        fields = (
            'id', 'code', 'type', 'type_label', 'value', 'min_purchase',
            'usage_limit', 'times_used',
            'starts_at', 'ends_at', 'is_active', 'is_valid',
            'created_at',
        )
        read_only_fields = ('id', 'times_used', 'created_at')

    def get_type_label(self, obj):
        return dict(Coupon.TYPES).get(obj.type, obj.type)

    def get_is_valid(self, obj):
        now = timezone.now()
        if not obj.is_active: return False
        if obj.starts_at and obj.starts_at > now: return False
        if obj.ends_at and obj.ends_at < now: return False
        if obj.usage_limit and obj.times_used >= obj.usage_limit: return False
        return True


class CouponCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Coupon
        fields = ('code', 'type', 'value', 'min_purchase',
                  'usage_limit', 'starts_at', 'ends_at', 'is_active')

    def validate_code(self, value):
        return value.upper().strip()

    def create(self, validated_data):
        request = self.context.get('request')
        tenant = getattr(request.user, 'tenant', None) if request else None
        if tenant is None:
            from apps.tenants.models import Tenant
            tenant = Tenant.objects.filter(is_active=True).first()
        validated_data['tenant'] = tenant
        return super().create(validated_data)


class CouponValidateSerializer(serializers.Serializer):
    code = serializers.CharField()
    subtotal = serializers.DecimalField(max_digits=10, decimal_places=2)
