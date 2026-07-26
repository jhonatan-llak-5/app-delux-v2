from django.db import migrations, models


MAP = {'CEDULA': '05', 'RUC': '04', 'PASAPORTE': '06', 'CONSUMIDOR_FINAL': '07'}


def to_sri(apps, schema_editor):
    Customer = apps.get_model('customers', 'Customer')
    for old, new in MAP.items():
        Customer.objects.filter(document_type=old).update(document_type=new)
    # cualquier valor no reconocido -> Cédula (05)
    Customer.objects.exclude(document_type__in=['04', '05', '06', '07', '08', '09']).update(document_type='05')


def to_words(apps, schema_editor):
    Customer = apps.get_model('customers', 'Customer')
    inv = {v: k for k, v in MAP.items()}
    for new, old in inv.items():
        Customer.objects.filter(document_type=new).update(document_type=old)


class Migration(migrations.Migration):

    dependencies = [
        ('customers', '0007_customer_is_active'),
    ]

    operations = [
        migrations.RunPython(to_sri, to_words),
        migrations.AlterField(
            model_name='customer',
            name='document_type',
            field=models.CharField(blank=True, choices=[('05', 'Cédula'), ('04', 'RUC'), ('06', 'Pasaporte'), ('07', 'Consumidor final'), ('08', 'Identificación del exterior'), ('09', 'Placa')], default='05', max_length=2),
        ),
    ]
