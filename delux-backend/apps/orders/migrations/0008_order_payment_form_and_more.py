# Generated manually for FORMAS DE PAGO (SRI tabla 24; tarjeta de crédito a plazos)

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('orders', '0007_order_total_changes'),
    ]

    operations = [
        migrations.AddField(
            model_name='order',
            name='payment_form',
            field=models.CharField(default='01', max_length=2),
        ),
        migrations.AddField(
            model_name='order',
            name='payment_plazo',
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AddField(
            model_name='order',
            name='payment_unidad',
            field=models.CharField(default='dias', max_length=8),
        ),
    ]
