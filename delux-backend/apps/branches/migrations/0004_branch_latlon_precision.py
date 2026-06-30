from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('branches', '0003_branch_kiosk'),
    ]

    operations = [
        migrations.AlterField(
            model_name='branch',
            name='latitude',
            field=models.DecimalField(max_digits=12, decimal_places=8, null=True, blank=True),
        ),
        migrations.AlterField(
            model_name='branch',
            name='longitude',
            field=models.DecimalField(max_digits=12, decimal_places=8, null=True, blank=True),
        ),
    ]
