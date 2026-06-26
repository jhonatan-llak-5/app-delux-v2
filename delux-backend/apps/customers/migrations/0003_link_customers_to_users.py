"""Backfill: enlaza fichas de cliente (Customer) con cuentas (User) por correo."""
from django.db import migrations


def link_by_email(apps, schema_editor):
    Customer = apps.get_model('customers', 'Customer')
    User = apps.get_model('accounts', 'User')
    used_user_ids = set(
        Customer.objects.exclude(user__isnull=True).values_list('user_id', flat=True)
    )
    for c in Customer.objects.filter(user__isnull=True).exclude(email=''):
        user = User.objects.filter(email__iexact=c.email).first()
        if not user or user.id in used_user_ids:
            continue
        c.user_id = user.id
        c.save(update_fields=['user'])
        used_user_ids.add(user.id)


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ('customers', '0002_wishlistitem'),
        ('accounts', '0001_initial'),
    ]
    operations = [migrations.RunPython(link_by_email, noop)]
