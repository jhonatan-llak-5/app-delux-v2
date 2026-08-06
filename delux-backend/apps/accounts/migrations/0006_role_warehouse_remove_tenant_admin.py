from django.db import migrations, models


def tenant_admin_to_manager(apps, schema_editor):
    """El rol 'Admin de tienda' (TENANT_ADMIN) se elimina; sus usuarios pasan a
    Gerente (BRANCH_MANAGER), que ahora hereda todos sus accesos."""
    User = apps.get_model('accounts', 'User')
    User.objects.filter(role='TENANT_ADMIN').update(role='BRANCH_MANAGER')


def manager_to_tenant_admin(apps, schema_editor):
    # Reverso best-effort (no distingue cuáles eran admin originalmente).
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0005_user_monthly_salary'),
    ]

    operations = [
        migrations.RunPython(tenant_admin_to_manager, manager_to_tenant_admin),
        migrations.AlterField(
            model_name='user',
            name='role',
            field=models.CharField(
                choices=[
                    ('SUPERADMIN', 'Superadmin'),
                    ('BRANCH_MANAGER', 'Gerente'),
                    ('SALESPERSON', 'Vendedor'),
                    ('WAREHOUSE', 'Bodeguero'),
                    ('CUSTOMER', 'Cliente'),
                    ('AFFILIATE', 'Vendedor Afiliado'),
                ],
                default='CUSTOMER', max_length=20,
            ),
        ),
    ]
