from django.db.models import Sum
from django.utils.text import slugify
from rest_framework import serializers

from .models import Product, ProductImage


class ProductImageSerializer(serializers.ModelSerializer):
    # Las imágenes subidas devuelven rutas RELATIVAS (/media/products/...),
    # que un URLField rechazaría. Se aceptan como texto.
    url = serializers.CharField()
    thumb_url = serializers.CharField(required=False, allow_blank=True)

    class Meta:
        model = ProductImage
        fields = ('id', 'url', 'thumb_url', 'alt', 'sort_order', 'is_main')
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
            'base_price', 'compare_at_price', 'tax_rate',
            'gender', 'status', 'tag', 'is_featured', 'variant_options',
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
            out.append({'sku': v.sku, 'size': v.size, 'color': v.color, 'barcode': v.barcode})
        return out


class ProductCreateUpdateSerializer(serializers.ModelSerializer):
    images = ProductImageSerializer(many=True, required=False)
    variants = serializers.ListField(child=serializers.DictField(), required=False, write_only=True)
    initial_stock = serializers.ListField(child=serializers.DictField(), required=False, write_only=True)
    # Alta rápida de marca/categoría por nombre (crea si no existe). Permite
    # usar el mismo formulario de creación en la edición, sin selects por id.
    brand_name = serializers.CharField(required=False, allow_blank=True, write_only=True)
    category_name = serializers.CharField(required=False, allow_blank=True, write_only=True)
    # Acepta rutas relativas de imagen (/media/...), no solo URLs absolutas.
    main_image_url = serializers.CharField(required=False, allow_blank=True)

    class Meta:
        model = Product
        fields = (
            'name', 'slug', 'short_description', 'description',
            'brand', 'category', 'brand_name', 'category_name',
            'base_price', 'compare_at_price', 'tax_rate',
            'gender', 'status', 'tag', 'is_featured', 'variant_options',
            'main_image_url', 'meta_title', 'meta_description',
            'images', 'variants', 'initial_stock',
        )
        extra_kwargs = {
            'slug': {'required': False, 'allow_blank': True},
            'brand': {'required': False, 'allow_null': True},
            'category': {'required': False, 'allow_null': True},
        }

    def validate(self, attrs):
        if not attrs.get('slug'):
            attrs['slug'] = slugify(attrs.get('name', ''))[:180]
        return attrs

    def _resolve_brand_by_name(self, tenant, name):
        from apps.brands.models import Brand
        name = (name or '').strip()
        if not name:
            return None
        b = Brand.objects.filter(tenant=tenant, name__iexact=name).first()
        if b:
            return b
        from django.utils.text import slugify as _sl
        base = _sl(name) or 'marca'
        slug, i = base, 2
        while Brand.objects.filter(tenant=tenant, slug=slug).exists():
            slug = f'{base}-{i}'; i += 1
        return Brand.objects.create(tenant=tenant, name=name, slug=slug)

    def _resolve_category_by_name(self, tenant, name):
        from apps.categories.models import Category
        name = (name or '').strip()
        if not name:
            return None
        c = Category.objects.filter(tenant=tenant, name__iexact=name).first()
        if c:
            return c
        from django.utils.text import slugify as _sl
        base = _sl(name) or 'categoria'
        slug, i = base, 2
        while Category.objects.filter(tenant=tenant, slug=slug).exists():
            slug = f'{base}-{i}'; i += 1
        return Category.objects.create(tenant=tenant, name=name, slug=slug)

    @staticmethod
    def _default_brand(tenant):
        from apps.brands.models import Brand
        obj, _ = Brand.objects.get_or_create(
            tenant=tenant, slug='general', defaults={'name': 'General'})
        return obj

    @staticmethod
    def _default_category(tenant):
        from apps.categories.models import Category
        obj, _ = Category.objects.get_or_create(
            tenant=tenant, slug='general', defaults={'name': 'General'})
        return obj

    def create(self, validated_data):
        images_data = validated_data.pop('images', [])
        variants_data = validated_data.pop('variants', [])
        stock_map = self._stock_map(validated_data.pop('initial_stock', []))
        brand_name = validated_data.pop('brand_name', '')
        category_name = validated_data.pop('category_name', '')
        # Tenant del usuario o primero activo (superadmin global)
        request = self.context.get('request')
        tenant = getattr(request.user, 'tenant', None) if request else None
        if tenant is None:
            from apps.tenants.models import Tenant
            tenant = Tenant.objects.filter(is_active=True).first()
        validated_data['tenant'] = tenant
        if not validated_data.get('brand') and brand_name:
            validated_data['brand'] = self._resolve_brand_by_name(tenant, brand_name)
        if not validated_data.get('category') and category_name:
            validated_data['category'] = self._resolve_category_by_name(tenant, category_name)
        if not validated_data.get('brand'):
            validated_data['brand'] = self._default_brand(tenant)
        if not validated_data.get('category'):
            validated_data['category'] = self._default_category(tenant)
        product = Product.objects.create(**validated_data)
        for idx, img in enumerate(images_data):
            ProductImage.objects.create(product=product, sort_order=img.get('sort_order', idx), **{k: v for k, v in img.items() if k != 'sort_order'})
        if variants_data:
            self._sync_variants(product, variants_data, tenant, stock_map)
        return product

    def update(self, instance, validated_data):
        images_data = validated_data.pop('images', None)
        variants_data = validated_data.pop('variants', None)
        stock_map = self._stock_map(validated_data.pop('initial_stock', []))
        brand_name = validated_data.pop('brand_name', None)
        category_name = validated_data.pop('category_name', None)
        if brand_name:
            validated_data['brand'] = self._resolve_brand_by_name(instance.tenant, brand_name)
        if category_name:
            validated_data['category'] = self._resolve_category_by_name(instance.tenant, category_name)
        if 'brand' in validated_data and not validated_data['brand']:
            validated_data['brand'] = self._default_brand(instance.tenant)
        if 'category' in validated_data and not validated_data['category']:
            validated_data['category'] = self._default_category(instance.tenant)
        # ¿Cambió el precio del producto? (comparando el valor nuevo con el
        # actual). Solo entonces se considera "aplicar a todas las variantes".
        from decimal import Decimal, InvalidOperation
        base_price_changed = False
        if 'base_price' in validated_data:
            try:
                base_price_changed = Decimal(str(validated_data['base_price'])) != (instance.base_price or Decimal('0'))
            except (InvalidOperation, TypeError):
                base_price_changed = True
        for k, v in validated_data.items():
            setattr(instance, k, v)
        instance.save()
        # Al CAMBIAR el precio en el formulario del producto, ese precio se
        # aplica a TODAS las variantes: se limpia cualquier precio propio
        # (price_override) que tuvieran. Si el precio no cambió, se respetan los
        # precios por variante ya definidos.
        if base_price_changed:
            instance.variants.update(price_override=None)
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
            self._sync_variants(instance, variants_data, instance.tenant, stock_map)
        return instance

    def _stock_map(self, rows):
        out = {}
        for r in rows or []:
            try:
                out[int(r.get('branch'))] = max(0, int(r.get('quantity', 0)))
            except (TypeError, ValueError):
                continue
        return out

    def _sync_variants(self, product, variants, tenant, stock_map=None):
        """Crea/elimina variantes (talla x color) y stock 0 por sucursal."""
        import uuid
        from apps.variants.models import Variant
        from apps.inventory.models import Stock
        from apps.branches.models import Branch
        from apps.orders.models import OrderItem

        branches = list(Branch.objects.filter(tenant=tenant, is_active=True))
        desired, seen = [], set()
        barcode_map = {}
        for v in variants:
            size = (v.get('size') or '').strip()
            color = (v.get('color') or '').strip()
            key = (size, color)
            bc = str(v.get('barcode') or '').strip()
            if bc:
                barcode_map[key] = bc
            if key in seen:
                continue
            seen.add(key)
            desired.append(key)

        existing = {(vv.size, vv.color): vv for vv in product.variants.all()}
        # Actualiza el codigo de barras de variantes ya existentes (si vino).
        for key, var in existing.items():
            bc = barcode_map.get(key)
            if bc and var.barcode != bc:
                var.barcode = bc
                var.save(update_fields=['barcode'])

        for size, color in desired:
            if (size, color) in existing:
                continue
            sku = f"{(product.slug or 'prod')[:8].upper()}-{(size or 'U')[:3].upper()}-{(color or 'STD')[:3].upper()}-{uuid.uuid4().hex[:4].upper()}"
            var = Variant.objects.create(
                tenant=tenant, product=product, sku=sku,
                size=size, color=color, is_active=True,
                barcode=barcode_map.get((size, color), ''),
            )
            for b in branches:
                qty = (stock_map or {}).get(b.id, 0)
                Stock.objects.get_or_create(
                    tenant=tenant, variant=var, branch=b,
                    defaults={'quantity': qty, 'min_threshold': 2},
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
