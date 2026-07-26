from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('platform_settings', '0014_store_options'),
    ]

    operations = [
        migrations.AddField(
            model_name='platformsettings',
            name='consumidor_final_enabled',
            field=models.BooleanField(default=False, help_text='Asigna "Consumidor Final" a las ventas sin cliente (para facturación).'),
        ),
    ]
