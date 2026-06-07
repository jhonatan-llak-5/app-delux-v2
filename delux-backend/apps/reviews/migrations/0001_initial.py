from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True
    dependencies = [
        ('products', '0002_productimage_isfeatured'),
        ('customers', '0002_wishlistitem'),
        ('tenants', '0001_initial'),
    ]
    operations = [
        migrations.CreateModel(
            name='Review',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('rating', models.PositiveSmallIntegerField()),
                ('title', models.CharField(blank=True, max_length=120)),
                ('comment', models.TextField(blank=True)),
                ('verified_purchase', models.BooleanField(default=False)),
                ('status', models.CharField(choices=[('PENDING','Pendiente'),('APPROVED','Aprobada'),('REJECTED','Rechazada')], default='PENDING', max_length=10)),
                ('helpful_count', models.PositiveIntegerField(default=0)),
                ('customer', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='reviews', to='customers.customer')),
                ('product', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='reviews', to='products.product')),
                ('tenant', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='%(class)s_set', related_query_name='%(class)s', to='tenants.tenant')),
            ],
            options={'ordering': ['-created_at'], 'unique_together': {('product','customer')}},
        ),
        migrations.AddIndex(model_name='review',
            index=models.Index(fields=['product','status'], name='reviews_re_product_idx')),
        migrations.AddIndex(model_name='review',
            index=models.Index(fields=['rating'], name='reviews_re_rating__idx')),
    ]
