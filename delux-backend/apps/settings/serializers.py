from rest_framework import serializers
from .models import PlatformSettings


class PlatformSettingsSerializer(serializers.ModelSerializer):
    smtp_password = serializers.CharField(write_only=True, required=False, allow_blank=True)
    payphone_token = serializers.CharField(required=False, allow_blank=True)

    class Meta:
        model = PlatformSettings
        fields = (
            'smtp_host', 'smtp_port', 'smtp_username', 'smtp_password',
            'smtp_use_tls', 'smtp_use_ssl',
            'default_from_email', 'default_from_name', 'support_email',
            'activation_code_ttl_minutes', 'password_reset_ttl_minutes',
            'platform_name', 'platform_tagline',
            'payphone_enabled', 'payphone_token', 'payphone_store_id',
            'payphone_api_url', 'payphone_sandbox',
            'updated_at',
        )
        read_only_fields = ('updated_at',)

    def to_representation(self, instance):
        data = super().to_representation(instance)
        # Enmascarar token PayPhone si existe (mostrar solo últimos 4 char)
        token = getattr(instance, 'payphone_token', '')
        if token:
            data['payphone_token_masked'] = '••••••••' + token[-4:]
        else:
            data['payphone_token_masked'] = ''
        return data

    def update(self, instance, validated_data):
        if 'smtp_password' in validated_data and not validated_data['smtp_password']:
            validated_data.pop('smtp_password')
        if 'payphone_token' in validated_data and not validated_data['payphone_token']:
            validated_data.pop('payphone_token')
        return super().update(instance, validated_data)


class TestEmailSerializer(serializers.Serializer):
    to = serializers.EmailField()


class PayPhoneInitSerializer(serializers.Serializer):
    """Inicia transacción PayPhone para una orden existente."""
    order_id = serializers.IntegerField()
    return_url = serializers.URLField()
