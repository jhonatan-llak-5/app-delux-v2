from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ('branches', '0001_initial'),
        ('tenants', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='BranchSchedule',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('weekday', models.PositiveSmallIntegerField(choices=[
                    (0, 'Lunes'), (1, 'Martes'), (2, 'Miercoles'),
                    (3, 'Jueves'), (4, 'Viernes'), (5, 'Sabado'), (6, 'Domingo'),
                ])),
                ('open_time', models.TimeField(blank=True, null=True)),
                ('close_time', models.TimeField(blank=True, null=True)),
                ('is_closed', models.BooleanField(default=False)),
                ('branch', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE,
                                              related_name='schedules', to='branches.branch')),
                ('tenant', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT,
                                              related_name='%(class)s_set',
                                              related_query_name='%(class)s', to='tenants.tenant')),
            ],
            options={'unique_together': {('branch', 'weekday')}, 'ordering': ['branch', 'weekday']},
        ),
    ]
