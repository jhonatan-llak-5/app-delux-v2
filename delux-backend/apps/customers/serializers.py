from django.db.models import Sum, Count, Max
from rest_framework import serializers
from .models import Customer, Address


class AddressSerializer(serializers.ModelSerializer):
    class Meta:
        model = Address
        fields = ('id', 'label', 'line1', 'line2', 'city', 'region',
                  'country', 'postal_code', 'is_default')


class CustomerSerializer(serializers.ModelSerializer):
    addresses = AddressSerializer(many=True, read_only=True)
    total_orders = serializers.IntegerField(read_only=True, default=0)
    total_spent = serializers.DecimalField(read_only=True, max_digits=12, decimal_places=2, default=0)
    last_order_at = serializers.DateTimeField(read_only=True, default=None)

    class Meta:
        model = Customer
        fields = (
            'id', 'full_name', 'email', 'phone', 'document_id',
            'accepts_marketing', 'tags',
            'total_orders', 'total_spent', 'last_order_at',
            'addresses', 'created_at',
        )
        read_only_fields = ('id', 'created_at')


class CustomerCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Customer
        fields = ('full_name', 'email', 'phone', 'document_id',
                  'accepts_marketing', 'tags')

    def create(self, validated_data):
        request = self.context.get('request')
        tenant = getattr(request.user, 'tenant', None) if request else None
        if tenant is None:
            from apps.tenants.models import Tenant
            tenant = Tenant.objects.filter(is_active=True).first()
        validated_data['tenant'] = tenant
        return super().create(validated_data)
