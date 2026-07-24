from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('platform_settings', '0013_platformsettings_recaptcha_enabled'),
    ]

    operations = [
        migrations.AddField(
            model_name='platformsettings',
            name='pickup_enabled',
            field=models.BooleanField(default=True, help_text='Permite "Retiro en tienda" en el checkout.'),
        ),
        migrations.AddField(
            model_name='platformsettings',
            name='delivery_enabled',
            field=models.BooleanField(default=True, help_text='Permite "Env\u00edo a domicilio" en el checkout.'),
        ),
        migrations.AddField(
            model_name='platformsettings',
            name='out_of_stock_display',
            field=models.CharField(default='SHOW', max_length=10, choices=[('SHOW', 'Mostrar como est\u00e1n'), ('HIDE', 'Ocultar del cat\u00e1logo'), ('SOLD_OUT', 'Mostrar como agotado')], help_text='C\u00f3mo se muestran en el cat\u00e1logo los productos sin stock.'),
        ),
    ]
