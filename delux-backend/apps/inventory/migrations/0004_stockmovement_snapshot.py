from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0003_receptionitem_branch'),
    ]

    operations = [
        migrations.AddField(
            model_name='stockmovement',
            name='qty_before',
            field=models.IntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='stockmovement',
            name='qty_after',
            field=models.IntegerField(blank=True, null=True),
        ),
    ]
