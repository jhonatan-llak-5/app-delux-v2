from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('platform_settings', '0019_platformsettings_label_size'),
    ]

    operations = [
        migrations.AddField(
            model_name='platformsettings',
            name='receipt_exchange_note',
            field=models.BooleanField(
                default=True,
                help_text='Imprime "Para cambios es INDISPENSABLE presentar este documento" '
                          'al pie del comprobante de venta.'),
        ),
    ]
