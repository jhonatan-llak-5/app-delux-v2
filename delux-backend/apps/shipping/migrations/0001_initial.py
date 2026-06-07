from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True
    dependencies = [
        ('orders', '0001_initial'),
        ('accounts', '0003_staff_fields'),
        ('tenants', '0001_initial'),
    ]
    operations = [
        migrations.CreateModel(
            name='Shipment',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('tracking_code', models.CharField(max_length=40, unique=True)),
                ('carrier', models.CharField(choices=[('SERVIENTREGA','Servientrega'),('LAARCOURIER','Laar Courier'),('URBANOEXPRESS','Urbano Express'),('INHOUSE','Mensajería propia'),('PICKUP','Retiro en tienda')], default='SERVIENTREGA', max_length=20)),
                ('status', models.CharField(choices=[('CREATED','Creado'),('PREPARING','Preparando'),('SHIPPED','Enviado'),('IN_TRANSIT','En tránsito'),('DELIVERED','Entregado'),('FAILED','Fallido'),('RETURNED','Devuelto')], default='CREATED', max_length=15)),
                ('estimated_delivery', models.DateField(blank=True, null=True)),
                ('shipping_cost', models.DecimalField(decimal_places=2, default=0, max_digits=10)),
                ('recipient_name', models.CharField(max_length=160)),
                ('recipient_phone', models.CharField(blank=True, max_length=30)),
                ('address_line1', models.CharField(max_length=200)),
                ('address_line2', models.CharField(blank=True, max_length=200)),
                ('city', models.CharField(max_length=80)),
                ('region', models.CharField(blank=True, max_length=80)),
                ('country', models.CharField(default='Ecuador', max_length=80)),
                ('notes', models.TextField(blank=True)),
                ('order', models.OneToOneField(on_delete=django.db.models.deletion.PROTECT, related_name='shipment', to='orders.order')),
                ('tenant', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='%(class)s_set', related_query_name='%(class)s', to='tenants.tenant')),
            ],
            options={'ordering': ['-created_at']},
        ),
        migrations.CreateModel(
            name='ShipmentEvent',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('status', models.CharField(choices=[('CREATED','Creado'),('PREPARING','Preparando'),('SHIPPED','Enviado'),('IN_TRANSIT','En tránsito'),('DELIVERED','Entregado'),('FAILED','Fallido'),('RETURNED','Devuelto')], max_length=15)),
                ('description', models.CharField(max_length=240)),
                ('location', models.CharField(blank=True, max_length=120)),
                ('actor', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to='accounts.user')),
                ('shipment', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='events', to='shipping.shipment')),
                ('tenant', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='%(class)s_set', related_query_name='%(class)s', to='tenants.tenant')),
            ],
            options={'ordering': ['-created_at']},
        ),
    ]
