"""Sprint 21 — Ampliar PlatformSettings con SMTP toggle, reCAPTCHA,
branding (logo/favicon), límites de uploads, WhatsApp, etc."""
import apps.settings.models
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('platform_settings', '0002_payphone'),
    ]

    operations = [
        # ── Email toggle + provider + reply_to ──
        migrations.AddField(
            model_name='platformsettings',
            name='email_active',
            field=models.BooleanField(default=True, help_text='Activa el envio de correos'),
        ),
        migrations.AddField(
            model_name='platformsettings',
            name='email_provider',
            field=models.CharField(
                max_length=20, default='custom',
                choices=[
                    ('custom', 'Custom'), ('gmail', 'Gmail'), ('outlook', 'Outlook'),
                    ('yahoo', 'Yahoo'), ('office365', 'Office 365'),
                    ('zoho', 'Zoho'), ('sendgrid', 'SendGrid'), ('mailgun', 'Mailgun'),
                ],
                help_text='Proveedor SMTP (preset)',
            ),
        ),
        migrations.AddField(
            model_name='platformsettings',
            name='email_reply_to',
            field=models.EmailField(blank=True, default='', max_length=254),
        ),
        # ── reCAPTCHA ──
        migrations.AddField(
            model_name='platformsettings',
            name='recaptcha_site_key',
            field=models.CharField(blank=True, max_length=120),
        ),
        migrations.AddField(
            model_name='platformsettings',
            name='recaptcha_secret_key',
            field=models.CharField(blank=True, max_length=120),
        ),
        # ── Branding ──
        migrations.AddField(
            model_name='platformsettings',
            name='site_name',
            field=models.CharField(default='Delux', max_length=120),
        ),
        migrations.AddField(
            model_name='platformsettings',
            name='site_logo',
            field=models.ImageField(blank=True, null=True,
                                    upload_to=apps.settings.models._site_logo_upload_to),
        ),
        migrations.AddField(
            model_name='platformsettings',
            name='site_favicon',
            field=models.ImageField(blank=True, null=True,
                                    upload_to=apps.settings.models._site_favicon_upload_to),
        ),
        # ── Contacto público ──
        migrations.AddField(
            model_name='platformsettings',
            name='whatsapp_contact_number',
            field=models.CharField(blank=True, default='', max_length=30),
        ),
        # ── Uploads ──
        migrations.AddField(
            model_name='platformsettings',
            name='max_image_upload_mb',
            field=models.PositiveIntegerField(default=5),
        ),
        migrations.AddField(
            model_name='platformsettings',
            name='max_file_upload_mb',
            field=models.PositiveIntegerField(default=10),
        ),
        migrations.AddField(
            model_name='platformsettings',
            name='max_video_upload_mb',
            field=models.PositiveIntegerField(default=500),
        ),
        migrations.AddField(
            model_name='platformsettings',
            name='allowed_image_extensions',
            field=models.CharField(
                default='png,jpg,jpeg,webp,svg,avif,gif',
                help_text='CSV de extensiones permitidas para imagenes',
                max_length=200,
            ),
        ),
        migrations.AddField(
            model_name='platformsettings',
            name='allowed_file_extensions',
            field=models.CharField(
                default='pdf,doc,docx,xls,xlsx,csv,txt,zip',
                help_text='CSV de extensiones permitidas para archivos',
                max_length=200,
            ),
        ),
        migrations.AddField(
            model_name='platformsettings',
            name='allowed_video_extensions',
            field=models.CharField(
                default='mp4,webm,mov,avi,mkv',
                help_text='CSV de extensiones permitidas para videos',
                max_length=200,
            ),
        ),
    ]
