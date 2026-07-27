from django.db import migrations


class Migration(migrations.Migration):
    """Migración anulada intencionalmente.

    En un inicio limpiaba todos los price_override (cuando el precio iba a ser
    único por producto), pero se decidió permitir precio POR VARIANTE, así que
    ya NO se borran. Se deja vacía para no alterar el historial de migraciones.
    """

    dependencies = [
        ('variants', '0002_variant_cost'),
    ]

    operations = []
