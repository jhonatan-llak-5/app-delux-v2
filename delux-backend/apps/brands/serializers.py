from rest_framework import serializers

from .models import Brand


class BrandSerializer(serializers.ModelSerializer):
    products_count = serializers.IntegerField(read_only=True, default=0)
    active_products_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Brand
        fields = (
            'id', 'name', 'slug',
            'logo_url', 'logo_dark_url',
            'description', 'country_of_origin', 'website', 'founded_year',
            'is_active', 'is_featured', 'sort_order',
            'products_count', 'active_products_count',
            'created_at', 'updated_at',
        )
        read_only_fields = ('id', 'created_at', 'updated_at')

    def validate_slug(self, value):
        if not value:
            raise serializers.ValidationError('Slug es requerido.')
        return value.lower()


class BrandCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Brand
        fields = (
            'name', 'slug',
            'logo_url', 'logo_dark_url',
            'description', 'country_of_origin', 'website', 'founded_year',
            'is_active', 'is_featured', 'sort_order',
        )

    def validate_slug(self, value):
        return value.lower().strip()

    def validate(self, attrs):
        # Auto-slug si no se provee
        if not attrs.get('slug') and attrs.get('name'):
            from django.utils.text import slugify
            attrs['slug'] = slugify(attrs['name'])
        return attrs
