from rest_framework.permissions import BasePermission


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
