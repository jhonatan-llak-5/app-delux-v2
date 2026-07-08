"""Seed MÍNIMO para PRODUCCIÓN.

Deja la base lista para empezar a cargar datos reales:
  - 1 superadmin        (jhonatan.dev@gmail.com)
  - 1 tienda            (Delux)
  - 1 sucursal          (Delux Valle, datos de ejemplo editables)
  - 1 gerente           (pablo@gmail.com) asignado a Delux Valle

NO crea productos, marcas, categorías ni cuentas de demostración.
Es idempotente: se puede correr varias veces sin duplicar.

Uso:
    python manage.py seed_prod
"""
from __future__ import annotations

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction

from apps.accounts.models import Role
from apps.branches.models import Branch
from apps.settings.models import PlatformSettings
from apps.tenants.models import Tenant

User = get_user_model()

SUPERADMIN_EMAIL = 'jhonatan.dev@gmail.com'
SUPERADMIN_PASSWORD = '1998MARIAjose@'
SUPERADMIN_NAME = 'Jhonatan Llamuca'

MANAGER_EMAIL = 'pablo@gmail.com'
MANAGER_PASSWORD = '1234568Delux@'
MANAGER_NAME = 'Pablo'


class Command(BaseCommand):
    help = 'Seed mínimo de producción (superadmin + tienda Delux + sucursal Delux Valle + gerente).'

    @transaction.atomic
    def handle(self, *args, **kwargs):
        self.stdout.write(self.style.NOTICE('-> Sembrando datos MÍNIMOS de producción...'))
        PlatformSettings.load()

        # ── Superadmin ──────────────────────────────────────────────────────
        sa, _ = User.objects.get_or_create(
            email=SUPERADMIN_EMAIL,
            defaults={'username': SUPERADMIN_EMAIL, 'full_name': SUPERADMIN_NAME},
        )
        sa.set_password(SUPERADMIN_PASSWORD)
        sa.full_name = SUPERADMIN_NAME
        sa.role = Role.SUPERADMIN
        sa.is_staff = True
        sa.is_superuser = True
        sa.is_active = True
        sa.is_email_verified = True
        sa.save()
        self.stdout.write(self.style.SUCCESS(f'  superadmin -> {SUPERADMIN_EMAIL}'))

        # ── Tienda (tenant) ─────────────────────────────────────────────────
        tenant, _ = Tenant.objects.get_or_create(
            slug='delux',
            defaults={
                'name': 'Delux', 'legal_id': '1790000000001',
                'primary_color': '#22D3EE', 'accent_color': '#7C3AED',
                'is_active': True,
            },
        )
        self.stdout.write(self.style.SUCCESS(f'  tienda -> {tenant.name}'))

        # ── Sucursal Delux Valle (datos de ejemplo, editables desde el panel) ─
        branch, _ = Branch.objects.get_or_create(
            tenant=tenant, code='VALLE',
            defaults={
                'name': 'Delux Valle',
                'city': 'Quito',
                'address': 'Av. Ilaló y Conocoto — Valle de los Chillos',
                'latitude': -0.315000,
                'longitude': -78.455000,
                'phone': '+593 99 000 0000',
                'email': 'valle@deluxstyle.com',
                'opening_hours': 'Lun - Sáb 10:00 a 20:00',
                'allows_pickup': True,
                'is_active': True,
            },
        )
        self.stdout.write(self.style.SUCCESS(f'  sucursal -> {branch.name}'))

        # ── Gerente de Delux Valle (Pablo) ──────────────────────────────────
        mgr, _ = User.objects.get_or_create(
            email=MANAGER_EMAIL,
            defaults={'username': MANAGER_EMAIL, 'full_name': MANAGER_NAME},
        )
        mgr.set_password(MANAGER_PASSWORD)
        mgr.full_name = MANAGER_NAME
        mgr.role = Role.BRANCH_MANAGER
        mgr.tenant = tenant
        mgr.branch = branch
        mgr.is_active = True
        mgr.is_email_verified = True
        mgr.save()
        if branch.manager_id != mgr.id:
            branch.manager = mgr
            branch.save(update_fields=['manager'])
        self.stdout.write(self.style.SUCCESS(f'  gerente -> {MANAGER_EMAIL}  ({branch.name})'))

        self.stdout.write(self.style.SUCCESS(
            'OK. Base lista para producción (sin productos ni datos de demostración).'
        ))
