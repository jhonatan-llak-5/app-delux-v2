from rest_framework.permissions import BasePermission, SAFE_METHODS

# ─── Grupos de roles ───
# Gerente (BRANCH_MANAGER) hereda TODO lo que antes tenía el Admin de tienda
# (TENANT_ADMIN, ya eliminado). El Bodeguero (WAREHOUSE) es un rol acotado a
# inventario/bodega. El Vendedor (SALESPERSON) maneja ventas + inventario.
MANAGER_ROLES = ('SUPERADMIN', 'BRANCH_MANAGER')                       # admin / finanzas / análisis / config
SALES_ROLES   = ('SUPERADMIN', 'BRANCH_MANAGER', 'SALESPERSON')        # ventas, devoluciones, cupones, gastos
STAFF_ROLES   = ('SUPERADMIN', 'BRANCH_MANAGER', 'SALESPERSON', 'WAREHOUSE')  # inventario, productos, proveedores, categorías, marcas, etiquetas


class IsSuperadmin(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated
                    and request.user.role == 'SUPERADMIN')


class IsManager(BasePermission):
    """Gerente o superior: acceso completo a administración, finanzas,
    análisis, configuración, usuarios, clientes, etc."""
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated
                    and request.user.role in MANAGER_ROLES)


class IsSalesStaff(BasePermission):
    """Personal de ventas: gerente y vendedor (NO bodeguero). Cubre POS,
    devoluciones, cupones y gastos."""
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated
                    and request.user.role in SALES_ROLES)


class IsStaff(BasePermission):
    """Cualquier miembro del staff (gerente, vendedor y bodeguero). Cubre los
    módulos de inventario/bodega compartidos."""
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated
                    and request.user.role in STAFF_ROLES)


class IsStaffReadOrManager(BasePermission):
    """Lectura para todo el staff; escritura solo para gerente o superior."""
    def has_permission(self, request, view):
        u = request.user
        if not (u and u.is_authenticated):
            return False
        if u.role in MANAGER_ROLES:
            return True
        if u.role in ('SALESPERSON', 'WAREHOUSE'):
            return request.method in SAFE_METHODS
        return False


# ─── Alias de compatibilidad ───
# Antes existían IsTenantAdmin (admin de tienda) e IsBranchManager (gerente).
# Al eliminar el rol Admin de tienda, ambos equivalen ahora a "gerente o
# superior" (IsManager). Los módulos que el vendedor/bodeguero también usan se
# reasignan explícitamente a IsSalesStaff / IsStaff en cada vista.
IsTenantAdmin = IsManager
IsBranchManager = IsManager
