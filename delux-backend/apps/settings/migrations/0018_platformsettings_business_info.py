# Datos del negocio (emisor) para el comprobante de venta impreso

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('platform_settings', '0017_platformsettings_einvoice_consumidor_final_max'),
    ]

    operations = [
        migrations.AddField(
            model_name='platformsettings',
            name='business_legal_name',
            field=models.CharField(blank=True, default='', help_text='Razón social del emisor (aparece en el recibo).', max_length=200),
        ),
        migrations.AddField(
            model_name='platformsettings',
            name='business_ruc',
            field=models.CharField(blank=True, default='', help_text='RUC del emisor.', max_length=20),
        ),
        migrations.AddField(
            model_name='platformsettings',
            name='business_address',
            field=models.CharField(blank=True, default='', help_text='Dirección del emisor.', max_length=200),
        ),
        migrations.AddField(
            model_name='platformsettings',
            name='business_phone',
            field=models.CharField(blank=True, default='', help_text='Teléfono del emisor.', max_length=40),
        ),
    ]
