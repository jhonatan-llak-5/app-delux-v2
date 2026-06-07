from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ('products', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='product',
            name='is_featured',
            field=models.BooleanField(default=False),
        ),
        migrations.AddIndex(
            model_name='product',
            index=models.Index(fields=['tenant', 'status'], name='products_pr_tenant__d6d1ce_idx'),
        ),
        migrations.AddIndex(
            model_name='product',
            index=models.Index(fields=['brand', 'category'], name='products_pr_brand_i_a5e9bf_idx'),
        ),
        migrations.CreateModel(
            name='ProductImage',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('url', models.URLField()),
                ('alt', models.CharField(blank=True, max_length=160)),
                ('sort_order', models.PositiveSmallIntegerField(default=0)),
                ('is_main', models.BooleanField(default=False)),
                ('product', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='images', to='products.product')),
            ],
            options={'ordering': ['sort_order', 'id']},
        ),
    ]
