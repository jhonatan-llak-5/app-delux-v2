from rest_framework import serializers

from .models import Branch


class BranchSerializer(serializers.ModelSerializer):
    tenant_id = serializers.IntegerField(source='tenant.id', read_only=True)
    tenant_slug = serializers.SlugField(source='tenant.slug', read_only=True)
    products_count = serializers.IntegerField(read_only=True, default=0)
    manager_name = serializers.CharField(source='manager.full_name',
                                         read_only=True, default=None)

    class Meta:
        model = Branch
        fields = (
            'id', 'tenant_id', 'tenant_slug',
            'code', 'name', 'city', 'address',
            'latitude', 'longitude', 'phone', 'email',
            'opening_hours', 'manager', 'manager_name',
            'allows_pickup', 'is_active', 'created_at',
            'products_count',
        )
