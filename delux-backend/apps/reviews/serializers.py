from django.db.models import Avg, Count
from rest_framework import serializers
from .models import Review, ReviewStatus


class ReviewSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source='customer.full_name', read_only=True)
    customer_initials = serializers.SerializerMethodField()
    product_name = serializers.CharField(source='product.name', read_only=True)

    class Meta:
        model = Review
        fields = ('id', 'product', 'product_name', 'customer', 'customer_name',
                  'customer_initials', 'rating', 'title', 'comment',
                  'verified_purchase', 'status', 'helpful_count', 'created_at')
        read_only_fields = ('id', 'customer', 'verified_purchase',
                            'status', 'helpful_count', 'created_at')

    def get_customer_initials(self, obj):
        name = obj.customer.full_name or 'Anónimo'
        return ''.join([s[0] for s in name.split()[:2]]).upper() or 'A'


class ReviewSummarySerializer(serializers.Serializer):
    average = serializers.FloatField()
    total = serializers.IntegerField()
    distribution = serializers.DictField()
