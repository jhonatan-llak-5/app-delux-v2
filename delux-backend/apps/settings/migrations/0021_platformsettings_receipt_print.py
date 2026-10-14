from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('platform_settings', '0020_platformsettings_receipt_exchange_note'),
    ]

    operations = [
        migrations.AddField(
            model_name='platformsettings',
            name='receipt_print_mode',
            field=models.CharField(
                choices=[('BROWSER', 'Diálogo del navegador'),
                         ('DIRECT', 'Directo a la impresora (NovaPrint)')],
                default='BROWSER', max_length=10,
                help_text='Cómo imprime el sistema el comprobante de venta.'),
        ),
        migrations.AddField(
            model_name='platformsettings',
            name='receipt_print_agent_url',
            field=models.CharField(
                blank=True, default='http://127.0.0.1:9123', max_length=200,
                help_text='Dirección de NovaPrint en la PC de caja. Casi siempre la '
                          'predeterminada; solo cambia si moviste el puerto.'),
        ),
        migrations.AddField(
            model_name='platformsettings',
            name='receipt_print_agent_token',
            field=models.CharField(
                blank=True, default='', max_length=128,
                help_text='Clave compartida con NovaPrint. La misma debe quedar en el '
                          'config.json de cada PC de caja.'),
        ),
    ]
