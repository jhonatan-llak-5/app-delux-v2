from rest_framework import serializers

from .models import Tenant


class TenantSerializer(serializers.ModelSerializer):
    branches_count = serializers.IntegerField(read_only=True, default=0)
    users_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Tenant
        fields = (
            'id', 'name', 'slug', 'legal_id',
            'primary_color', 'accent_color', 'logo_url',
            'is_active', 'created_at',
            'branches_count', 'users_count',
        )
