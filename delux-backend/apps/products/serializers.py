from django.db.models import Sum
from django.utils.text import slugify
from rest_framework import serializers

from .models import Product, ProductImage


class ProductImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductImage
        fields = ('id', 'url', 'alt', 'sort_order', 'is_main')
        read_only_fields = ('id',)


class ProductSerializer(serializers.ModelSerializer):
    brand_name = serializers.CharField(source='brand.name', read_only=True)
    category_name = serializers.CharField(source='category.name', read_only=True)
    images = ProductImageSerializer(many=True, read_only=True)
    images_count = serializers.IntegerField(read_only=True, default=0)
    variants_count = serializers.IntegerField(read_only=True, default=0)
    total_stock = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Product
        fields = (
            'id', 'name', 'slug', 'short_description', 'description',
            'brand', 'brand_name', 'category', 'category_name',
            'base_price', 'compare_at_price',
            'gender', 'status', 'tag', 'is_featured',
            'main_image_url',
            'meta_title', 'meta_description',
            'images', 'images_count', 'variants_count', 'total_stock',
            'created_at', 'updated_at',
        )
        read_only_fields = ('id', 'created_at', 'updated_at')


class ProductCreateUpdateSerializer(serializers.ModelSerializer):
    images = ProductImageSerializer(many=True, required=False)

    class Meta:
        model = Product
        fields = (
            'name', 'slug', 'short_description', 'description',
            'brand', 'category', 'base_price', 'compare_at_price',
            'gender', 'status', 'tag', 'is_featured',
            'main_image_url', 'meta_title', 'meta_description',
            'images',
        )
        extra_kwargs = {'slug': {'required': False, 'allow_blank': True}}

    def validate(self, attrs):
        if not attrs.get('slug'):
            attrs['slug'] = slugify(attrs.get('name', ''))[:180]
        return attrs

    def create(self, validated_data):
        images_data = validated_data.pop('images', [])
        # Tenant del usuario o primero activo (superadmin global)
        request = self.context.get('request')
        tenant = getattr(request.user, 'tenant', None) if request else None
        if tenant is None:
            from apps.tenants.models import Tenant
            tenant = Tenant.objects.filter(is_active=True).first()
        validated_data['tenant'] = tenant
        product = Product.objects.create(**validated_data)
        for idx, img in enumerate(images_data):
            ProductImage.objects.create(product=product, sort_order=img.get('sort_order', idx), **{k: v for k, v in img.items() if k != 'sort_order'})
        return product

    def update(self, instance, validated_data):
        images_data = validated_data.pop('images', None)
        for k, v in validated_data.items():
            setattr(instance, k, v)
        instance.save()
        # Si vienen imágenes, reemplaza todas
        if images_data is not None:
            instance.images.all().delete()
            for idx, img in enumerate(images_data):
                ProductImage.objects.create(
                    product=instance,
                    sort_order=img.get('sort_order', idx),
                    **{k: v for k, v in img.items() if k != 'sort_order'}
                )
        return instance


class ProductWithStockSerializer(ProductSerializer):
    branch_stock = serializers.SerializerMethodField()

    class Meta(ProductSerializer.Meta):
        fields = ProductSerializer.Meta.fields + ('branch_stock',)

    def get_branch_stock(self, obj):
        branch = self.context.get('branch')
        if not branch:
            return 0
        agg = (
            obj.variants.filter(stocks__branch=branch)
            .aggregate(total=Sum('stocks__quantity'))
        )
        return agg['total'] or 0
