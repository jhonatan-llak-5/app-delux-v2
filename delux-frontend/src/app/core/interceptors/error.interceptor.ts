import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

/**
 * errorInterceptor — sólo redirige a /auth/login si:
 *   1) Hay un token guardado (sesión expirada)
 *   2) Y la ruta actual NO es ya una ruta pública (landing, shop, contact, etc.)
 *
 * Anteriormente cualquier 401 en una página pública (ej. autocomplete del
 * buscador o tenant.load()) te expulsaba al login.
 */
const PUBLIC_PREFIXES = ['/', '/shop', '/product', '/contact', '/cart',
                         '/tracking', '/auth', '/checkout'];

function isPublicRoute(url: string): boolean {
  // Quitar query string para comparar
  const path = url.split('?')[0];
  return PUBLIC_PREFIXES.some(p => p === path || path.startsWith(p + '/') || (p === '/' && path === ''));
}

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  return next(req).pipe(
    catchError((err) => {
      if (err?.status === 401) {
        const hadSession =
          typeof window !== 'undefined' && !!localStorage.getItem('dlx_access_token');
        const onPublic = isPublicRoute(router.url);

        // Limpiar token expirado siempre
        if (hadSession && typeof window !== 'undefined') {
          localStorage.removeItem('dlx_access_token');
          localStorage.removeItem('dlx_refresh_token');
        }

        // Sólo redirigir si estaba autenticado y trataba de entrar a una ruta protegida
        if (hadSession && !onPublic) {
          router.navigate(['/auth/login']);
        }
      }
      return throwError(() => err);
    })
  );
};
