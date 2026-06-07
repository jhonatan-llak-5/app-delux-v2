from django.db.models import Sum
from rest_framework import serializers
from .models import Variant


class VariantSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    total_stock = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Variant
        fields = ('id', 'product', 'product_name', 'sku', 'size', 'color',
                  'material', 'price_override', 'barcode', 'weight_grams',
                  'is_active', 'total_stock', 'created_at')
        read_only_fields = ('id', 'created_at')


class VariantCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Variant
        fields = ('product', 'sku', 'size', 'color', 'material',
                  'price_override', 'barcode', 'weight_grams', 'is_active')

    def create(self, validated_data):
        validated_data['tenant'] = validated_data['product'].tenant
        return super().create(validated_data)
