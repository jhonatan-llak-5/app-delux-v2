# Generated manually for CAMBIOS (return-to-stock parcial ligado a la venta)

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('returns', '0002_alter_returnitem_id_alter_returnrequest_id'),
        ('orders', '0007_order_total_changes'),
        ('variants', '0001_initial'),
        ('branches', '0001_initial'),
        ('tenants', '0001_initial'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='SaleChange',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('code', models.CharField(blank=True, default='', max_length=20)),
                ('product_name', models.CharField(blank=True, default='', max_length=200)),
                ('quantity', models.PositiveIntegerField(default=1)),
                ('valor_devuelto', models.DecimalField(decimal_places=2, default=0, max_digits=10)),
                ('tipo', models.CharField(choices=[('PARCIAL', 'Cambio parcial'), ('TOTAL', 'Cambio total')], default='PARCIAL', max_length=8)),
                ('descripcion', models.TextField(blank=True, default='')),
                ('actor', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='+', to=settings.AUTH_USER_MODEL)),
                ('branch', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='+', to='branches.branch')),
                ('order', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='changes', to='orders.order')),
                ('order_item', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='changes', to='orders.orderitem')),
                ('tenant', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='%(class)s_set', related_query_name='%(class)s', to='tenants.tenant')),
                ('variant', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name='+', to='variants.variant')),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
    ]
