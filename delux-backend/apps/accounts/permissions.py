from rest_framework.permissions import BasePermission, SAFE_METHODS


class IsSuperadmin(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated
                    and request.user.role == 'SUPERADMIN')


class IsTenantAdmin(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated
                    and request.user.role in ('SUPERADMIN', 'TENANT_ADMIN'))


class IsBranchManager(BasePermission):
    """Superadmin, Tenant Admin o Branch Manager."""
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated
                    and request.user.role in ('SUPERADMIN', 'TENANT_ADMIN', 'BRANCH_MANAGER'))


class IsStaff(BasePermission):
    """Cualquier miembro del staff (incluye Vendedor)."""
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated
                    and request.user.role in (
                        'SUPERADMIN', 'TENANT_ADMIN', 'BRANCH_MANAGER', 'SALESPERSON'))


class IsStaffReadOrManager(BasePermission):
    """Lectura para todo el staff; escritura solo para gerente o superior.

    El Vendedor puede VER (GET) pero no crear/editar/eliminar.
    """
    def has_permission(self, request, view):
        u = request.user
        if not (u and u.is_authenticated):
            return False
        if u.role in ('SUPERADMIN', 'TENANT_ADMIN', 'BRANCH_MANAGER'):
            return True
        if u.role == 'SALESPERSON':
            return request.method in SAFE_METHODS
        return False
