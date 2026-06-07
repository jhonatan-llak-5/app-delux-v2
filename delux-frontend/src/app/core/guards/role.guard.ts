import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';

export type AppRole =
  | 'SUPERADMIN'
  | 'TENANT_ADMIN'
  | 'BRANCH_MANAGER'
  | 'SALESPERSON'
  | 'CUSTOMER';

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
  } catch {
    /* noop */
  }
  router.navigate(['/']);
  return false;
};
