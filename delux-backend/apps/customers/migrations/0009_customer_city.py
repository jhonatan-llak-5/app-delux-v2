# Ciudad del cliente (datos de facturación)

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('customers', '0008_document_type_sri'),
    ]

    operations = [
        migrations.AddField(
            model_name='customer',
            name='city',
            field=models.CharField(blank=True, default='', max_length=80),
            preserve_default=False,
        ),
    ]
