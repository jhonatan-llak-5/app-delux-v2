from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('platform_settings', '0018_platformsettings_business_info'),
    ]

    operations = [
        migrations.AddField(
            model_name='platformsettings',
            name='label_size',
            field=models.CharField(choices=[('50x30', '50 × 30 mm'), ('40x30', '40 × 30 mm'), ('40x25', '40 × 25 mm'), ('35x25', '35 × 25 mm'), ('30x20', '30 × 20 mm')], default='50x30', help_text='Tamaño de las etiquetas de producto (ancho x alto en mm).', max_length=10),
        ),
    ]
