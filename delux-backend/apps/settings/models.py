"""
PlatformSettings (singleton)
Configuracion global de plataforma editable desde el panel del superadmin.
"""
from django.db import models


def _site_logo_upload_to(instance, filename):
    return f'platform/logo/{filename}'


def _site_favicon_upload_to(instance, filename):
    return f'platform/favicon/{filename}'


class PlatformSettings(models.Model):
    # ─── Email / SMTP ───
    email_active = models.BooleanField(default=True, help_text='Activa el envio de correos')
    email_provider = models.CharField(
        max_length=20, default='custom',
        choices=[
            ('custom', 'Custom'), ('gmail', 'Gmail'), ('outlook', 'Outlook'),
            ('yahoo', 'Yahoo'), ('office365', 'Office 365'),
            ('zoho', 'Zoho'), ('sendgrid', 'SendGrid'), ('mailgun', 'Mailgun'),
        ],
        help_text='Proveedor SMTP (preset)'
    )
    smtp_host = models.CharField(max_length=120, blank=True)
    smtp_port = models.PositiveIntegerField(default=587)
    smtp_username = models.CharField(max_length=160, blank=True)
    smtp_password = models.CharField(max_length=240, blank=True)
    smtp_use_tls = models.BooleanField(default=True)
    smtp_use_ssl = models.BooleanField(default=False)

    default_from_email = models.EmailField(default='no-reply@delux.local')
    default_from_name = models.CharField(max_length=120, default='Delux')
    email_reply_to = models.EmailField(blank=True, default='')
    support_email = models.EmailField(blank=True, default='soporte@delux.local')

    # ─── reCAPTCHA ───
    recaptcha_site_key = models.CharField(max_length=120, blank=True)
    recaptcha_secret_key = models.CharField(max_length=120, blank=True)

    # ─── Cuentas / expiraciones ───
    activation_code_ttl_minutes = models.PositiveIntegerField(default=15)
    password_reset_ttl_minutes = models.PositiveIntegerField(default=30)

    # ─── Marca / branding ───
    site_name = models.CharField(max_length=120, default='Delux')
    platform_name = models.CharField(max_length=120, default='Delux')
    platform_tagline = models.CharField(max_length=240, blank=True, default='Sneakers, Ropa y mas')
    site_logo = models.ImageField(upload_to=_site_logo_upload_to, blank=True, null=True)
    site_favicon = models.ImageField(upload_to=_site_favicon_upload_to, blank=True, null=True)

    # ─── Contacto público ───
    whatsapp_contact_number = models.CharField(max_length=30, blank=True, default='')

    # ─── Subidas: limites y tipos permitidos ───
    max_image_upload_mb = models.PositiveIntegerField(default=5)
    max_file_upload_mb = models.PositiveIntegerField(default=10)
    max_video_upload_mb = models.PositiveIntegerField(default=500)
    allowed_image_extensions = models.CharField(
        max_length=200,
        default='png,jpg,jpeg,webp,svg,avif,gif',
        help_text='CSV de extensiones permitidas para imagenes'
    )
    allowed_file_extensions = models.CharField(
        max_length=200,
        default='pdf,doc,docx,xls,xlsx,csv,txt,zip',
        help_text='CSV de extensiones permitidas para archivos'
    )
    allowed_video_extensions = models.CharField(
        max_length=200,
        default='mp4,webm,mov,avi,mkv',
        help_text='CSV de extensiones permitidas para videos'
    )

    # ─── PayPhone integration ───
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

    # Helpers para validacion de archivos
    def allowed_image_exts_list(self) -> list[str]:
        return [e.strip().lower() for e in (self.allowed_image_extensions or '').split(',') if e.strip()]

    def allowed_file_exts_list(self) -> list[str]:
        return [e.strip().lower() for e in (self.allowed_file_extensions or '').split(',') if e.strip()]

    def allowed_video_exts_list(self) -> list[str]:
        return [e.strip().lower() for e in (self.allowed_video_extensions or '').split(',') if e.strip()]


class ContactMessage(models.Model):
    """Mensaje del formulario de contacto público."""
    name = models.CharField(max_length=120)
    email = models.EmailField()
    subject = models.CharField(max_length=160, blank=True)
    message = models.TextField()
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self) -> str:
        return f'{self.name} <{self.email}>'


class NewsletterSubscriber(models.Model):
    """Suscriptor al newsletter."""
    email = models.EmailField(unique=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self) -> str:
        return self.email
