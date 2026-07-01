from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0003_staff_fields'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='ref_code',
            field=models.CharField(
                blank=True, db_index=True, default='', max_length=20,
                help_text='Codigo unico de afiliado (ej. VEND0001)'),
            preserve_default=False,
        ),
        migrations.AlterField(
            model_name='user',
            name='role',
            field=models.CharField(default='CUSTOMER', max_length=20, choices=[
                ('SUPERADMIN', 'Superadmin'),
                ('TENANT_ADMIN', 'Admin Tenant'),
                ('BRANCH_MANAGER', 'Gerente Sucursal'),
                ('SALESPERSON', 'Vendedor'),
                ('CUSTOMER', 'Cliente'),
                ('AFFILIATE', 'Vendedor Afiliado'),
            ]),
        ),
    ]
