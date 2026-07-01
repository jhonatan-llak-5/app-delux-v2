from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('orders', '0002_orderitem_branch'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name='order',
            name='affiliate',
            field=models.ForeignKey(
                null=True, blank=True, on_delete=django.db.models.deletion.SET_NULL,
                related_name='affiliate_orders', to=settings.AUTH_USER_MODEL,
                help_text='Vendedor afiliado atribuido a este pedido.'),
        ),
        migrations.AddField(
            model_name='order',
            name='affiliate_ref',
            field=models.CharField(blank=True, default='', max_length=20),
            preserve_default=False,
        ),
    ]
