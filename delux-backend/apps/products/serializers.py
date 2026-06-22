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
    variants_detail = serializers.SerializerMethodField()
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
            'images', 'images_count', 'variants_count', 'variants_detail', 'total_stock',
            'created_at', 'updated_at',
        )
        read_only_fields = ('id', 'created_at', 'updated_at')


    def get_variants_detail(self, obj):
        seen, out = set(), []
        for v in obj.variants.all():
            key = (v.size, v.color)
            if key in seen:
                continue
            seen.add(key)
            out.append({'size': v.size, 'color': v.color})
        return out


class ProductCreateUpdateSerializer(serializers.ModelSerializer):
    images = ProductImageSerializer(many=True, required=False)
    variants = serializers.ListField(child=serializers.DictField(), required=False, write_only=True)

    class Meta:
        model = Product
        fields = (
            'name', 'slug', 'short_description', 'description',
            'brand', 'category', 'base_price', 'compare_at_price',
            'gender', 'status', 'tag', 'is_featured',
            'main_image_url', 'meta_title', 'meta_description',
            'images', 'variants',
        )
        extra_kwargs = {'slug': {'required': False, 'allow_blank': True}}

    def validate(self, attrs):
        if not attrs.get('slug'):
            attrs['slug'] = slugify(attrs.get('name', ''))[:180]
        return attrs

    def create(self, validated_data):
        images_data = validated_data.pop('images', [])
        variants_data = validated_data.pop('variants', [])
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
        if variants_data:
            self._sync_variants(product, variants_data, tenant)
        return product

    def update(self, instance, validated_data):
        images_data = validated_data.pop('images', None)
        variants_data = validated_data.pop('variants', None)
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
        if variants_data is not None:
            self._sync_variants(instance, variants_data, instance.tenant)
        return instance

    def _sync_variants(self, product, variants, tenant):
        """Crea/elimina variantes (talla x color) y stock 0 por sucursal."""
        import uuid
        from apps.variants.models import Variant
        from apps.inventory.models import Stock
        from apps.branches.models import Branch
        from apps.orders.models import OrderItem

        branches = list(Branch.objects.filter(tenant=tenant, is_active=True))
        desired, seen = [], set()
        for v in variants:
            size = (v.get('size') or '').strip()
            color = (v.get('color') or '').strip()
            key = (size, color)
            if key in seen:
                continue
            seen.add(key)
            desired.append(key)

        existing = {(vv.size, vv.color): vv for vv in product.variants.all()}

        for size, color in desired:
            if (size, color) in existing:
                continue
            sku = f"{(product.slug or 'prod')[:8].upper()}-{(size or 'U')[:3].upper()}-{(color or 'STD')[:3].upper()}-{uuid.uuid4().hex[:4].upper()}"
            var = Variant.objects.create(
                tenant=tenant, product=product, sku=sku,
                size=size, color=color, is_active=True,
            )
            for b in branches:
                Stock.objects.get_or_create(
                    tenant=tenant, variant=var, branch=b,
                    defaults={'quantity': 0, 'min_threshold': 2},
                )

        desired_set = set(desired)
        for key, var in existing.items():
            if key in desired_set:
                continue
            if OrderItem.objects.filter(variant=var).exists():
                continue
            if var.stocks.filter(quantity__gt=0).exists():
                continue
            var.delete()


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
