from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('accounts', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='commission_rate',
            field=models.DecimalField(default=0, max_digits=5, decimal_places=2,
                                      help_text='Porcentaje de comision (0-100)'),
        ),
        migrations.AddField(
            model_name='user',
            name='hire_date',
            field=models.DateField(null=True, blank=True),
        ),
        migrations.AddField(
            model_name='user',
            name='phone',
            field=models.CharField(max_length=30, blank=True),
        ),
        migrations.AddField(
            model_name='user',
            name='document_id',
            field=models.CharField(max_length=30, blank=True),
        ),
    ]
