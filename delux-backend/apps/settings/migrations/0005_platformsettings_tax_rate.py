from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('platform_settings', '0004_contactmessage_newslettersubscriber'),
    ]

    operations = [
        migrations.AddField(
            model_name='platformsettings',
            name='tax_rate',
            field=models.DecimalField(
                max_digits=5, decimal_places=2, default=15,
                help_text='IVA % aplicado al precio de venta para mostrar el precio final.',
            ),
        ),
    ]
