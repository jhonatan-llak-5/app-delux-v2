import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';

export type AppRole =
  | 'SUPERADMIN'
  | 'BRANCH_MANAGER'
  | 'SALESPERSON'
  | 'WAREHOUSE'
  | 'CUSTOMER'
  | 'AFFILIATE';

/** Página de inicio según el rol, usada cuando el usuario está autenticado pero
 * intenta abrir una ruta que no le corresponde. Evita "botarlo" a la landing. */
function roleHome(role?: AppRole): string {
  switch (role) {
    case 'SUPERADMIN':
    case 'BRANCH_MANAGER':
      return '/app/admin/overview';
    case 'SALESPERSON':
      return '/app/admin/seller';
    case 'WAREHOUSE':
      return '/app/admin/inventory';
    case 'AFFILIATE':
      return '/app/affiliate';
    case 'CUSTOMER':
      return '/app/account';
    default:
      return '/';
  }
}

export const roleGuard = (allowed: AppRole[]): CanActivateFn => () => {
  const router = inject(Router);
  const raw = typeof window !== 'undefined' ? localStorage.getItem('dlx_user') : null;
  if (!raw) {
    router.navigate(['/auth/login']);
    return false;
  }
  try {
    const user = JSON.parse(raw) as { role?: AppRole };
    if (user.role && allowed.includes(user.role)) return true;
    // Autenticado pero sin permiso para esta ruta: lo llevamos a su panel.
    router.navigateByUrl(roleHome(user?.role));
    return false;
  } catch {
    router.navigate(['/']);
    return false;
  }
};
