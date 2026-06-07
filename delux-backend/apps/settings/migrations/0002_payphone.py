from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('platform_settings', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='platformsettings',
            name='payphone_enabled',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='platformsettings',
            name='payphone_token',
            field=models.CharField(blank=True, max_length=240),
        ),
        migrations.AddField(
            model_name='platformsettings',
            name='payphone_store_id',
            field=models.CharField(blank=True, max_length=80),
        ),
        migrations.AddField(
            model_name='platformsettings',
            name='payphone_api_url',
            field=models.URLField(blank=True, default='https://pay.payphonetodoesposible.com/api'),
        ),
        migrations.AddField(
            model_name='platformsettings',
            name='payphone_sandbox',
            field=models.BooleanField(default=True),
        ),
    ]
