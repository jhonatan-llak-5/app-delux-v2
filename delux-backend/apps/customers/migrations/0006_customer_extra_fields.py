from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('customers', '0005_customer_uniq_customer_tenant_email'),
    ]

    operations = [
        migrations.AlterField(
            model_name='customer',
            name='email',
            field=models.EmailField(blank=True, max_length=254),
        ),
        migrations.AddField(
            model_name='customer',
            name='document_type',
            field=models.CharField(blank=True, choices=[('CEDULA', 'Cedula'), ('RUC', 'RUC'), ('PASAPORTE', 'Pasaporte')], default='CEDULA', max_length=12),
        ),
        migrations.AddField(
            model_name='customer',
            name='business_name',
            field=models.CharField(blank=True, default='', max_length=160),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name='customer',
            name='address',
            field=models.CharField(blank=True, default='', max_length=240),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name='customer',
            name='province',
            field=models.CharField(blank=True, default='', max_length=80),
            preserve_default=False,
        ),
    ]
