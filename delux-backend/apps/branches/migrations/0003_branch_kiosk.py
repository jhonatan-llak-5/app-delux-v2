import secrets
from django.db import migrations, models


def gen_tokens(apps, schema_editor):
    Branch = apps.get_model('branches', 'Branch')
    for b in Branch.objects.filter(kiosk_token=''):
        b.kiosk_token = secrets.token_urlsafe(12)[:24]
        b.save(update_fields=['kiosk_token'])


class Migration(migrations.Migration):

    dependencies = [
        ('branches', '0002_branchschedule'),
    ]

    operations = [
        migrations.AddField(
            model_name='branch',
            name='kiosk_token',
            field=models.CharField(blank=True, db_index=True, max_length=32),
        ),
        migrations.AddField(
            model_name='branch',
            name='kiosk_pin',
            field=models.CharField(blank=True, max_length=8),
        ),
        migrations.RunPython(gen_tokens, migrations.RunPython.noop),
    ]
