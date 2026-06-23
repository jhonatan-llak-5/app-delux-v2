"""Grupos de Django asociados a cada rol de la plataforma.

La autorización de la API se hace por el campo `role` + permisos DRF, pero
además mantenemos Grupos de Django sincronizados con el rol para que:
  - El admin de Django sea usable y coherente.
  - Las cuentas estén asociadas a grupos con permisos reales.

`ensure_groups()` crea/actualiza los grupos y sus permisos.
`sync_user_groups(user)` deja al usuario solo en el grupo de su rol.
"""
from __future__ import annotations

from django.contrib.auth.models import Group, Permission

from apps.accounts.models import Role

# Rol -> nombre de Grupo
ROLE_GROUP = {
    Role.SUPERADMIN: 'Superadmin',
    Role.TENANT_ADMIN: 'Admin Tienda',
    Role.BRANCH_MANAGER: 'Gerente Sucursal',
    Role.SALESPERSON: 'Vendedor',
    Role.CUSTOMER: 'Cliente',
}

# Apps operativas del dominio (para asignar permisos por rol)
_OPERATIONAL_APPS = [
    'products', 'variants', 'inventory', 'orders', 'payments',
    'customers', 'shipping', 'returns', 'reviews', 'branches',
    'coupons', 'reports', 'categories', 'brands', 'accounts',
]


def _perms_for_apps(app_labels, actions=None):
    qs = Permission.objects.filter(content_type__app_label__in=app_labels)
    if actions:
        prefixes = tuple(f'{a}_' for a in actions)
        qs = [p for p in qs if p.codename.startswith(prefixes)]
        return list(qs)
    return list(qs)


def ensure_groups() -> dict[str, Group]:
    """Crea los grupos y asigna sus permisos. Idempotente."""
    groups: dict[str, Group] = {}
    for name in ROLE_GROUP.values():
        groups[name], _ = Group.objects.get_or_create(name=name)

    all_perms = list(Permission.objects.all())

    # Superadmin y Admin Tienda: todos los permisos.
    groups['Superadmin'].permissions.set(all_perms)
    groups['Admin Tienda'].permissions.set(all_perms)

    # Gerente de sucursal: CRUD sobre apps operativas (no config/tenants).
    groups['Gerente Sucursal'].permissions.set(
        _perms_for_apps(_OPERATIONAL_APPS, ['view', 'add', 'change', 'delete'])
    )

    # Vendedor: ver catálogo/inventario + registrar ventas y pagos.
    seller_perms = (
        _perms_for_apps(
            ['products', 'variants', 'inventory', 'branches', 'customers'],
            ['view'],
        )
        + _perms_for_apps(['orders', 'payments'], ['view', 'add'])
    )
    groups['Vendedor'].permissions.set(seller_perms)

    # Cliente: sin permisos de administración.
    groups['Cliente'].permissions.clear()

    return groups


def sync_user_groups(user) -> None:
    """Deja al usuario únicamente en el grupo correspondiente a su rol."""
    target_name = ROLE_GROUP.get(user.role)
    if not target_name:
        return
    group, _ = Group.objects.get_or_create(name=target_name)
    # Quita de otros grupos de rol y agrega al correcto.
    other_role_groups = [n for n in ROLE_GROUP.values() if n != target_name]
    user.groups.remove(*Group.objects.filter(name__in=other_role_groups))
    user.groups.add(group)
