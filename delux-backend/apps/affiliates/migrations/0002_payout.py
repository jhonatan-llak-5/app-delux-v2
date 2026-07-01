from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('affiliates', '0001_initial'),
        ('tenants', '0001_initial'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='CommissionPayout',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('amount', models.DecimalField(decimal_places=2, default=0, max_digits=10)),
                ('method', models.CharField(choices=[('CASH', 'Efectivo'), ('TRANSFER', 'Transferencia')], default='CASH', max_length=10)),
                ('reference', models.CharField(blank=True, help_text='Nota / numero de comprobante (opcional)', max_length=160)),
                ('commissions_count', models.PositiveIntegerField(default=0)),
                ('affiliate', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='payouts', to=settings.AUTH_USER_MODEL)),
                ('paid_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='registered_payouts', to=settings.AUTH_USER_MODEL)),
                ('tenant', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='commissionpayout_set', related_query_name='commissionpayout', to='tenants.tenant')),
            ],
            options={'ordering': ['-created_at']},
        ),
        migrations.AddField(
            model_name='commission',
            name='payout',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='commissions', to='affiliates.commissionpayout'),
        ),
        migrations.AddIndex(
            model_name='commissionpayout',
            index=models.Index(fields=['tenant', 'affiliate'], name='affiliates__tenant__po_idx'),
        ),
    ]
