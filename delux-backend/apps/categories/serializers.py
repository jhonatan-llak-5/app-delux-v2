from rest_framework import serializers
from django.utils.text import slugify
from .models import Category


class CategoryTreeNodeSerializer(serializers.ModelSerializer):
    """Serializer recursivo para árbol."""
    children = serializers.SerializerMethodField()
    products_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Category
        fields = [
            'id', 'name', 'slug', 'icon', 'sort_order', 'is_active',
            'parent', 'children', 'products_count'
        ]

    def get_children(self, obj):
        children = obj.children.filter(is_active=True).order_by('sort_order', 'name') \
            if self.context.get('only_active') else obj.children.all().order_by('sort_order', 'name')
        return CategoryTreeNodeSerializer(children, many=True, context=self.context).data


class CategorySerializer(serializers.ModelSerializer):
    parent_name = serializers.CharField(source='parent.name', read_only=True, default=None)
    children_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Category
        fields = [
            'id', 'name', 'slug', 'parent', 'parent_name', 'icon',
            'sort_order', 'is_active', 'children_count',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class CategoryCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ['name', 'slug', 'parent', 'icon', 'sort_order', 'is_active']
        extra_kwargs = {
            'slug': {'required': False, 'allow_blank': True},
        }

    def validate(self, attrs):
        # Auto-slug si vacío
        if not attrs.get('slug'):
            attrs['slug'] = slugify(attrs.get('name', ''))[:80]
        # Evitar parent = self (en update)
        parent = attrs.get('parent')
        if self.instance and parent and parent.pk == self.instance.pk:
            raise serializers.ValidationError({'parent': 'No puede ser su propio padre.'})
        # Evitar ciclos (parent no puede ser un descendiente)
        if self.instance and parent:
            cur = parent
            while cur is not None:
                if cur.pk == self.instance.pk:
                    raise serializers.ValidationError({'parent': 'Se generaría un ciclo en el árbol.'})
                cur = cur.parent
        return attrs

    def create(self, validated_data):
        # Heredar tenant del request (middleware ya lo asigna en el queryset)
        tenant = self.context['request'].user.tenant or self.context.get('tenant')
        if tenant is None:
            # Superadmin global: tomar el primer tenant activo
            from apps.tenants.models import Tenant
            tenant = Tenant.objects.filter(is_active=True).first()
        validated_data['tenant'] = tenant
        return super().create(validated_data)


class CategoryReorderSerializer(serializers.Serializer):
    """Para drag-and-drop: lista [{id, sort_order, parent}]."""
    items = serializers.ListField(
        child=serializers.DictField(),
        allow_empty=False,
    )

    def validate_items(self, items):
        for it in items:
            if 'id' not in it or 'sort_order' not in it:
                raise serializers.ValidationError('Cada item requiere id y sort_order.')
        return items
