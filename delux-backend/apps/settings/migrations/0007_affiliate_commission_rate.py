from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('platform_settings', '0006_alter_platformsettings_tax_rate'),
    ]

    operations = [
        migrations.AddField(
            model_name='platformsettings',
            name='affiliate_commission_rate',
            field=models.DecimalField(
                max_digits=5, decimal_places=2, default=10,
                help_text='% de comision global para vendedores afiliados.'),
        ),
    ]
