# Generated manually for FASE 1: catálogo por provincia.

from django.db import migrations, models


# Mapa ciudad -> provincia (claves en minúscula para comparación case-insensitive).
CITY_TO_PROVINCE = {
    'quito': 'Pichincha',
    'guayaquil': 'Guayas',
    'cuenca': 'Azuay',
    'ambato': 'Tungurahua',
    'manta': 'Manabí',
    'portoviejo': 'Manabí',
    'machala': 'El Oro',
    'loja': 'Loja',
    'riobamba': 'Chimborazo',
    'ibarra': 'Imbabura',
    'latacunga': 'Cotopaxi',
    'santo domingo': 'Santo Domingo de los Tsáchilas',
    'esmeraldas': 'Esmeraldas',
    'durán': 'Guayas',
    'duran': 'Guayas',
    'milagro': 'Guayas',
}


def fill_province_from_city(apps, schema_editor):
    Branch = apps.get_model('branches', 'Branch')
    # Itera todas las filas (todos los tenants). Solo actualiza las que aún
    # no tengan provincia asignada.
    for branch in Branch.objects.all().iterator():
        if (branch.province or '').strip():
            continue
        key = (branch.city or '').strip().lower()
        province = CITY_TO_PROVINCE.get(key, '')
        if province:
            branch.province = province
            branch.save(update_fields=['province'])


class Migration(migrations.Migration):

    dependencies = [
        ('branches', '0006_alter_branchschedule_options_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='branch',
            name='province',
            field=models.CharField(blank=True, default='', max_length=80),
        ),
        migrations.RunPython(fill_province_from_city, migrations.RunPython.noop),
    ]
