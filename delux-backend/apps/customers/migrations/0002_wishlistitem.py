from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ('customers', '0001_initial'),
        ('products', '0002_productimage_isfeatured'),
        ('tenants', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='WishlistItem',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('customer', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE,
                                                related_name='wishlist_items', to='customers.customer')),
                ('product', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE,
                                               related_name='wishlist_items', to='products.product')),
                ('tenant', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT,
                                              related_name='%(class)s_set',
                                              related_query_name='%(class)s', to='tenants.tenant')),
            ],
            options={'ordering': ['-created_at'], 'unique_together': {('customer', 'product')}},
        ),
    ]
