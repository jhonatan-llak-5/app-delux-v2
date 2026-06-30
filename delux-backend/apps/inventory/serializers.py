from rest_framework import serializers
from .models import Stock, StockMovement, Supplier, Reception, ReceptionItem


class StockSerializer(serializers.ModelSerializer):
    variant_sku = serializers.CharField(source='variant.sku', read_only=True)
    variant_size = serializers.CharField(source='variant.size', read_only=True)
    variant_color = serializers.CharField(source='variant.color', read_only=True)
    product_id = serializers.IntegerField(source='variant.product.id', read_only=True)
    product_name = serializers.CharField(source='variant.product.name', read_only=True)
    product_main_image = serializers.URLField(source='variant.product.main_image_url', read_only=True)
    brand_name = serializers.CharField(source='variant.product.brand.name', read_only=True)
    category_name = serializers.CharField(source='variant.product.category.name', read_only=True)
    branch_name = serializers.CharField(source='branch.name', read_only=True)
    branch_code = serializers.CharField(source='branch.code', read_only=True)
    base_price = serializers.DecimalField(source='variant.product.base_price', read_only=True, max_digits=10, decimal_places=2)
    price_override = serializers.DecimalField(source='variant.price_override', read_only=True, max_digits=10, decimal_places=2, default=None)
    available = serializers.IntegerField(read_only=True)
    is_low = serializers.SerializerMethodField()

    class Meta:
        model = Stock
        fields = (
            'id', 'variant', 'variant_sku', 'variant_size', 'variant_color',
            'product_id', 'product_name', 'product_main_image',
            'brand_name', 'category_name',
            'branch', 'branch_name', 'branch_code',
            'base_price', 'price_override',
            'quantity', 'reserved', 'min_threshold',
            'available', 'is_low',
            'created_at', 'updated_at',
        )
        read_only_fields = ('id', 'variant', 'branch', 'created_at', 'updated_at')

    def get_is_low(self, obj):
        return obj.quantity <= obj.min_threshold


class StockAdjustSerializer(serializers.Serializer):
    delta = serializers.IntegerField()
    note = serializers.CharField(max_length=240, required=False, allow_blank=True)
    type = serializers.ChoiceField(
        choices=[('IN', 'Entrada'), ('OUT', 'Salida'), ('ADJ', 'Ajuste')],
        default='ADJ',
    )

    def validate_delta(self, v):
        if v == 0:
            raise serializers.ValidationError('Delta no puede ser 0.')
        return v


class StockMovementSerializer(serializers.ModelSerializer):
    stock_id = serializers.IntegerField(source='stock.id', read_only=True)
    variant_sku = serializers.CharField(source='stock.variant.sku', read_only=True)
    product_name = serializers.CharField(source='stock.variant.product.name', read_only=True)
    branch_name = serializers.CharField(source='stock.branch.name', read_only=True)
    actor_name = serializers.CharField(source='actor.full_name', read_only=True, default=None)
    type_label = serializers.SerializerMethodField()

    class Meta:
        model = StockMovement
        fields = (
            'id', 'stock_id', 'variant_sku', 'product_name', 'branch_name',
            'type', 'type_label', 'quantity', 'note', 'actor', 'actor_name',
            'created_at',
        )
        read_only_fields = fields

    def get_type_label(self, obj):
        return dict(StockMovement.TYPES).get(obj.type, obj.type)


class TransferSerializer(serializers.Serializer):
    variant_id = serializers.IntegerField()
    from_branch_id = serializers.IntegerField()
    to_branch_id = serializers.IntegerField()
    quantity = serializers.IntegerField(min_value=1)
    note = serializers.CharField(max_length=240, required=False, allow_blank=True)

    def validate(self, attrs):
        if attrs['from_branch_id'] == attrs['to_branch_id']:
            raise serializers.ValidationError('Las sucursales origen y destino deben ser distintas.')
        return attrs


class SupplierSerializer(serializers.ModelSerializer):
    class Meta:
        model = Supplier
        fields = ('id', 'name', 'contact_name', 'phone', 'email', 'tax_id',
                  'notes', 'is_active', 'created_at')
        read_only_fields = ('id', 'created_at')


class ReceptionItemSerializer(serializers.ModelSerializer):
    variant_sku = serializers.CharField(source='variant.sku', read_only=True)
    barcode = serializers.CharField(source='variant.barcode', read_only=True)
    product_name = serializers.CharField(source='variant.product.name', read_only=True)
    kind = serializers.CharField(source='variant.product.kind', read_only=True)
    size = serializers.CharField(source='variant.size', read_only=True)
    color = serializers.CharField(source='variant.color', read_only=True)
    price = serializers.SerializerMethodField()

    class Meta:
        model = ReceptionItem
        fields = ('id', 'variant', 'variant_sku', 'barcode', 'product_name',
                  'kind', 'size', 'color', 'quantity', 'unit_cost', 'price')

    def get_price(self, obj):
        v = obj.variant
        if v.price_override is not None:
            return v.price_override
        return v.product.base_price


class ReceptionSerializer(serializers.ModelSerializer):
    items = ReceptionItemSerializer(many=True, read_only=True)
    supplier_name = serializers.CharField(source='supplier.name', read_only=True, default=None)
    branch_name = serializers.CharField(source='branch.name', read_only=True)
    created_by_name = serializers.CharField(source='created_by.full_name', read_only=True, default=None)
    total_units = serializers.SerializerMethodField()
    items_count = serializers.SerializerMethodField()

    class Meta:
        model = Reception
        fields = ('id', 'code', 'supplier', 'supplier_name', 'branch', 'branch_name',
                  'status', 'note', 'created_by_name', 'committed_at', 'created_at',
                  'items', 'total_units', 'items_count')

    def get_total_units(self, obj):
        return sum(i.quantity for i in obj.items.all())

    def get_items_count(self, obj):
        return obj.items.count()
