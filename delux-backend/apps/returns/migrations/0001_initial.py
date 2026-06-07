from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True
    dependencies = [
        ('orders', '0001_initial'),
        ('customers', '0002_wishlistitem'),
        ('tenants', '0001_initial'),
    ]
    operations = [
        migrations.CreateModel(
            name='ReturnRequest',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('code', models.CharField(max_length=20)),
                ('reason', models.CharField(choices=[('DEFECTIVE','Producto defectuoso'),('WRONG','Producto equivocado'),('SIZE','Talla incorrecta'),('DISLIKE','No me gustó'),('OTHER','Otro')], max_length=15)),
                ('note', models.TextField(blank=True)),
                ('status', models.CharField(choices=[('REQUESTED','Solicitada'),('APPROVED','Aprobada'),('REJECTED','Rechazada'),('REFUNDED','Reembolsada'),('CLOSED','Cerrada')], default='REQUESTED', max_length=12)),
                ('refund_amount', models.DecimalField(decimal_places=2, default=0, max_digits=10)),
                ('admin_note', models.TextField(blank=True)),
                ('customer', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='returns', to='customers.customer')),
                ('order', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='returns', to='orders.order')),
                ('tenant', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='%(class)s_set', related_query_name='%(class)s', to='tenants.tenant')),
            ],
            options={'ordering': ['-created_at'], 'unique_together': {('tenant','code')}},
        ),
        migrations.CreateModel(
            name='ReturnItem',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('quantity', models.PositiveIntegerField(default=1)),
                ('refund_amount', models.DecimalField(decimal_places=2, default=0, max_digits=10)),
                ('order_item', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='return_items', to='orders.orderitem')),
                ('return_request', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='items', to='returns.returnrequest')),
                ('tenant', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='%(class)s_set', related_query_name='%(class)s', to='tenants.tenant')),
            ],
        ),
    ]
