# Generated manually for CAMBIOS (return-to-stock parcial ligado a la venta)

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('orders', '0006_order_group_code'),
    ]

    operations = [
        migrations.AddField(
            model_name='order',
            name='total_changes',
            field=models.DecimalField(decimal_places=2, default=0, max_digits=10),
        ),
    ]
