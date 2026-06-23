"""Crea los grupos por rol y sincroniza a todos los usuarios."""
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from apps.accounts.groups import ensure_groups, sync_user_groups

User = get_user_model()


class Command(BaseCommand):
    help = 'Crea/actualiza los grupos por rol y los asigna a cada usuario.'

    def handle(self, *args, **kwargs):
        groups = ensure_groups()
        self.stdout.write(self.style.SUCCESS(
            f' OK grupos: {", ".join(g.name for g in groups.values())}'
        ))
        count = 0
        for user in User.objects.all():
            sync_user_groups(user)
            count += 1
        self.stdout.write(self.style.SUCCESS(f' OK {count} usuarios sincronizados a sus grupos'))
