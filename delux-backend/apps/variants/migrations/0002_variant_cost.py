from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('variants', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='variant',
            name='cost',
            field=models.DecimalField(decimal_places=2, default=0, help_text='Costo de compra (para márgenes).', max_digits=10),
        ),
    ]
