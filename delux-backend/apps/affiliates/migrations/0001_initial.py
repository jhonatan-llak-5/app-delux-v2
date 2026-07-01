from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('orders', '0003_order_affiliate'),
        ('tenants', '0001_initial'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='Commission',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('base_amount', models.DecimalField(decimal_places=2, default=0, max_digits=10)),
                ('rate', models.DecimalField(decimal_places=2, default=0, max_digits=5)),
                ('amount', models.DecimalField(decimal_places=2, default=0, max_digits=10)),
                ('status', models.CharField(choices=[('APPROVED', 'Por pagar'), ('PAID', 'Pagada'), ('CANCELLED', 'Anulada')], default='APPROVED', max_length=10)),
                ('paid_at', models.DateTimeField(blank=True, null=True)),
                ('affiliate', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='commissions', to=settings.AUTH_USER_MODEL)),
                ('order', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='commission', to='orders.order')),
                ('tenant', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='commission_set', related_query_name='commission', to='tenants.tenant')),
            ],
            options={'ordering': ['-created_at']},
        ),
        migrations.AddIndex(
            model_name='commission',
            index=models.Index(fields=['tenant', 'affiliate', 'status'], name='affiliates__tenant__idx'),
        ),
    ]
