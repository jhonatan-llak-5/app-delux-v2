from rest_framework import serializers
from .models import PlatformSettings


class PlatformSettingsSerializer(serializers.ModelSerializer):
    smtp_password = serializers.CharField(write_only=True, required=False, allow_blank=True)
    recaptcha_secret_key = serializers.CharField(write_only=True, required=False, allow_blank=True)
    payphone_token = serializers.CharField(required=False, allow_blank=True)

    class Meta:
        model = PlatformSettings
        fields = (
            # Email
            'email_active', 'email_provider',
            'smtp_host', 'smtp_port', 'smtp_username', 'smtp_password',
            'smtp_use_tls', 'smtp_use_ssl',
            'default_from_email', 'default_from_name', 'email_reply_to', 'support_email',
            # reCAPTCHA
            'recaptcha_site_key', 'recaptcha_secret_key',
            # Cuentas
            'activation_code_ttl_minutes', 'password_reset_ttl_minutes',
            # Marca
            'site_name', 'platform_name', 'platform_tagline',
            'site_logo', 'site_favicon',
            'whatsapp_contact_number',
            # Subidas
            'max_image_upload_mb', 'max_file_upload_mb', 'max_video_upload_mb',
            'allowed_image_extensions', 'allowed_file_extensions', 'allowed_video_extensions',
            # PayPhone
            'payphone_enabled', 'payphone_token', 'payphone_store_id',
            'payphone_api_url', 'payphone_sandbox',
            # Audit
            'updated_at',
        )
        read_only_fields = ('updated_at',)

    def to_representation(self, instance):
        data = super().to_representation(instance)
        # Indicadores "configured" sin exponer secretos
        data['smtp_password_configured'] = bool(instance.smtp_password)
        data['recaptcha_secret_configured'] = bool(instance.recaptcha_secret_key)
        token = getattr(instance, 'payphone_token', '')
        data['payphone_token_masked'] = ('••••••••' + token[-4:]) if token else ''
        # URLs absolutas de archivos
        request = self.context.get('request')
        for fld in ('site_logo', 'site_favicon'):
            f = getattr(instance, fld, None)
            try:
                url = f.url if f else None
            except Exception:
                url = None
            if url and request:
                url = request.build_absolute_uri(url)
            data[fld + '_url'] = url
        return data

    def update(self, instance, validated_data):
        # Si vienen blanks en campos sensibles, no los sobreescribimos
        for sensitive in ('smtp_password', 'recaptcha_secret_key', 'payphone_token'):
            if sensitive in validated_data and not validated_data[sensitive]:
                validated_data.pop(sensitive)
        return super().update(instance, validated_data)


class TestEmailSerializer(serializers.Serializer):
    to = serializers.EmailField()


class TestPayPhoneSerializer(serializers.Serializer):
    """Valida que las credenciales de PayPhone respondan."""
    pass


class PayPhoneInitSerializer(serializers.Serializer):
    order_id = serializers.IntegerField()
    return_url = serializers.URLField()
