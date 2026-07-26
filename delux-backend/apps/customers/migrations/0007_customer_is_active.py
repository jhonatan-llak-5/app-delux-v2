from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('customers', '0006_customer_extra_fields'),
    ]

    operations = [
        migrations.AddField(
            model_name='customer',
            name='is_active',
            field=models.BooleanField(default=True),
        ),
        migrations.AlterField(
            model_name='customer',
            name='document_type',
            field=models.CharField(blank=True, choices=[('CEDULA', 'Cedula'), ('RUC', 'RUC'), ('PASAPORTE', 'Pasaporte'), ('CONSUMIDOR_FINAL', 'Consumidor Final')], default='CEDULA', max_length=20),
        ),
    ]
