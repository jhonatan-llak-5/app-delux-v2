from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('products', '0009_product_discount_percent'),
    ]

    operations = [
        migrations.AddField(
            model_name='product',
            name='online_visible',
            field=models.BooleanField(
                default=True, db_index=True,
                help_text='Si está desactivado, el producto no aparece en el sitio '
                          'web pero sigue vendiéndose en tienda física (POS) y kiosko.',
            ),
        ),
    ]
