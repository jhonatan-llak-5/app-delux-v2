import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0001_initial'),
        ('branches', '0001_initial'),
        ('tenants', '0001_initial'),
        ('variants', '0001_initial'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='Supplier',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('name', models.CharField(max_length=160)),
                ('contact_name', models.CharField(blank=True, max_length=120)),
                ('phone', models.CharField(blank=True, max_length=40)),
                ('email', models.EmailField(blank=True, max_length=254)),
                ('tax_id', models.CharField(blank=True, max_length=40)),
                ('notes', models.CharField(blank=True, max_length=400)),
                ('is_active', models.BooleanField(default=True)),
                ('tenant', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='%(class)s_set', related_query_name='%(class)s', to='tenants.tenant')),
            ],
            options={'ordering': ['name']},
        ),
        migrations.CreateModel(
            name='Reception',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('code', models.CharField(blank=True, max_length=30)),
                ('status', models.CharField(choices=[('DRAFT', 'Borrador'), ('COMMITTED', 'Confirmada')], default='DRAFT', max_length=12)),
                ('note', models.CharField(blank=True, max_length=300)),
                ('committed_at', models.DateTimeField(blank=True, null=True)),
                ('branch', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='receptions', to='branches.branch')),
                ('created_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to=settings.AUTH_USER_MODEL)),
                ('supplier', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='receptions', to='inventory.supplier')),
                ('tenant', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='%(class)s_set', related_query_name='%(class)s', to='tenants.tenant')),
            ],
            options={'ordering': ['-created_at']},
        ),
        migrations.CreateModel(
            name='ReceptionItem',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('quantity', models.PositiveIntegerField(default=0)),
                ('unit_cost', models.DecimalField(decimal_places=2, default=0, max_digits=10)),
                ('reception', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='items', to='inventory.reception')),
                ('tenant', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='%(class)s_set', related_query_name='%(class)s', to='tenants.tenant')),
                ('variant', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='reception_items', to='variants.variant')),
            ],
            options={'abstract': False},
        ),
    ]
