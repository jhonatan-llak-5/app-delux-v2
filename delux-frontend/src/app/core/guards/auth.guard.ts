import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';

export const authGuard: CanActivateFn = () => {
  const router = inject(Router);
  const token = typeof window !== 'undefined' ? localStorage.getItem('dlx_access_token') : null;
  if (token) return true;
  router.navigate(['/auth/login']);
  return false;
};
