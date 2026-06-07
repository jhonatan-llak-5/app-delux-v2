"""
PlatformSettings (singleton)
Configuracion global de plataforma editable desde el panel del superadmin:
SMTP, remitente por defecto, expiraciones, branding.
"""
from django.db import models


class PlatformSettings(models.Model):
    # Email / SMTP
    smtp_host = models.CharField(max_length=120, blank=True)
    smtp_port = models.PositiveIntegerField(default=587)
    smtp_username = models.CharField(max_length=160, blank=True)
    smtp_password = models.CharField(max_length=240, blank=True)
    smtp_use_tls = models.BooleanField(default=True)
    smtp_use_ssl = models.BooleanField(default=False)

    default_from_email = models.EmailField(default='no-reply@delux.local')
    default_from_name = models.CharField(max_length=120, default='Delux')
    support_email = models.EmailField(blank=True, default='soporte@delux.local')

    activation_code_ttl_minutes = models.PositiveIntegerField(default=15)
    password_reset_ttl_minutes = models.PositiveIntegerField(default=30)

    platform_name = models.CharField(max_length=120, default='Delux')
    platform_tagline = models.CharField(max_length=240, blank=True,
                                        default='Sneakers, Ropa y mas')

    # PayPhone integration (Sprint 11)
    payphone_enabled = models.BooleanField(default=False)
    payphone_token = models.CharField(max_length=240, blank=True)
    payphone_store_id = models.CharField(max_length=80, blank=True)
    payphone_api_url = models.URLField(
        blank=True,
        default='https://pay.payphonetodoesposible.com/api'
    )
    payphone_sandbox = models.BooleanField(default=True)

    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Configuracion de plataforma'
        verbose_name_plural = 'Configuracion de plataforma'

    def __str__(self) -> str:
        return f'PlatformSettings (#{self.pk})'

    @classmethod
    def load(cls) -> 'PlatformSettings':
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise RuntimeError('PlatformSettings es un singleton: no se elimina.')
