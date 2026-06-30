from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('products', '0004_productimage_thumb_url'),
    ]

    operations = [
        migrations.AddField(
            model_name='product',
            name='kind',
            field=models.CharField(choices=[('CALZADO', 'Calzado'), ('ROPA', 'Ropa'), ('GORRA', 'Gorras'), ('MOCHILA', 'Mochilas'), ('BISUTERIA', 'Bisutería'), ('ACCESORIO', 'Accesorios'), ('OTRO', 'Otro')], default='OTRO', help_text='Tipo de producto: define las tallas/medidas en la carga.', max_length=15),
        ),
    ]
