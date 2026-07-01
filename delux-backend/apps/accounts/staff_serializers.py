from django.utils.crypto import get_random_string
from rest_framework import serializers
from django.contrib.auth import get_user_model

User = get_user_model()


class StaffSerializer(serializers.ModelSerializer):
    branch_name = serializers.CharField(source='branch.name', read_only=True)
    role_label = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            'id', 'email', 'full_name', 'phone', 'document_id',
            'role', 'role_label', 'tenant', 'branch', 'branch_name',
            'commission_rate', 'monthly_salary', 'hire_date',
            'is_active', 'is_email_verified',
            'date_joined', 'last_login',
        )
        read_only_fields = ('id', 'date_joined', 'last_login')

    def get_role_label(self, obj):
        return obj.get_role_display()


class StaffCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False, min_length=8)
    role = serializers.ChoiceField(
        choices=[('TENANT_ADMIN', 'Admin de tienda'), ('BRANCH_MANAGER', 'Gerente'), ('SALESPERSON', 'Vendedor')]
    )

    class Meta:
        model = User
        fields = (
            'email', 'full_name', 'phone', 'document_id',
            'role', 'branch', 'commission_rate', 'monthly_salary', 'hire_date',
            'password',
        )

    def create(self, validated_data):
        request = self.context.get('request')
        provided = validated_data.get('password')
        password = validated_data.pop('password', None) or get_random_string(10)
        tenant = getattr(request.user, 'tenant', None) if request else None
        if tenant is None:
            from apps.tenants.models import Tenant
            tenant = Tenant.objects.filter(is_active=True).first()
        validated_data['tenant'] = tenant
        validated_data['username'] = validated_data['email']
        validated_data['is_email_verified'] = True
        validated_data['is_active'] = True
        user = User.objects.create_user(password=password, **validated_data)
        from apps.accounts.groups import sync_user_groups
        sync_user_groups(user)
        # Se exponen al creador una sola vez (en la respuesta del POST).
        user._plain_password = password
        user._password_generated = not bool(provided)
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)
        for k, v in validated_data.items():
            setattr(instance, k, v)
        if password:
            instance.set_password(password)
        instance.save()
        from apps.accounts.groups import sync_user_groups
        sync_user_groups(instance)
        return instance
