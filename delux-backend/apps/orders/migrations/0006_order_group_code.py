# Generated manually for FASE 2 (pedidos web multi-sucursal)

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('orders', '0005_order_cancel_reason'),
    ]

    operations = [
        migrations.AddField(
            model_name='order',
            name='group_code',
            field=models.CharField(blank=True, db_index=True, default='', max_length=40),
        ),
    ]
