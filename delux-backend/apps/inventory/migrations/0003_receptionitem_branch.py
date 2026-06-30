import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0002_supplier_reception_receptionitem'),
        ('branches', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='receptionitem',
            name='branch',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name='reception_items', to='branches.branch'),
        ),
    ]
