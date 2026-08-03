# Generated manually: sri_message + autorización + estados PENDING_SRI/ANNULLED

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('orders', '0008_order_payment_form_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='order',
            name='invoice_authorization',
            field=models.CharField(blank=True, default='', help_text='Nro de autorización del SRI.', max_length=64),
        ),
        migrations.AddField(
            model_name='order',
            name='invoice_message',
            field=models.CharField(blank=True, default='', max_length=500),
        ),
        migrations.AlterField(
            model_name='order',
            name='invoice_status',
            field=models.CharField(
                choices=[
                    ('NOT_ISSUED', 'No emitida'),
                    ('PROCESSING', 'Procesando'),
                    ('PENDING_SRI', 'En espera del SRI'),
                    ('AUTHORIZED', 'Autorizada'),
                    ('REJECTED', 'Rechazada'),
                    ('ANNULLED', 'Anulada'),
                    ('ERROR', 'Error'),
                ],
                db_index=True, default='NOT_ISSUED', max_length=12,
            ),
        ),
    ]
