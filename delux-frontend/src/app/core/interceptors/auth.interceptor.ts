import { HttpClient, HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, catchError, filter, switchMap, take, throwError } from 'rxjs';
import { environment } from '@env/environment';

const ACCESS_KEY = 'dlx_access_token';
const REFRESH_KEY = 'dlx_refresh_token';

// Estado compartido: múltiples requests en paralelo solo disparan UN refresh.
let refreshing = false;
const refreshed$ = new BehaviorSubject<string | null>(null);

function attach(req: HttpRequest<unknown>, token: string | null): HttpRequest<unknown> {
  return token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;
}

/**
 * authInterceptor:
 *  - Adjunta el access token a cada request.
 *  - Si una request protegida responde 401 (token expirado), refresca el token
 *    con el refresh token (valido 14 dias) y reintenta la request. Asi una
 *    sesion activa (p. ej. subiendo productos) no se corta a los 60 min.
 *  - Solo si el refresh falla (refresh expirado/invalidado) cierra sesion.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const http = inject(HttpClient);
  const router = inject(Router);
  const token = typeof window !== 'undefined' ? localStorage.getItem(ACCESS_KEY) : null;

  const isAuthCall = req.url.includes('/auth/refresh') || req.url.includes('/auth/login');

  return next(attach(req, token)).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status !== 401 || isAuthCall || typeof window === 'undefined') {
        return throwError(() => err);
      }

      const refreshToken = localStorage.getItem(REFRESH_KEY);
      if (!refreshToken) {
        return throwError(() => err);
      }

      if (refreshing) {
        return refreshed$.pipe(
          filter(t => t !== null),
          take(1),
          switchMap(t => next(attach(req, t))),
        );
      }

      refreshing = true;
      refreshed$.next(null);
      return http.post<{ access: string }>(
        `${environment.apiUrl}/auth/refresh/`, { refresh: refreshToken },
      ).pipe(
        switchMap(r => {
          refreshing = false;
          localStorage.setItem(ACCESS_KEY, r.access);
          refreshed$.next(r.access);
          return next(attach(req, r.access));
        }),
        catchError(e => {
          refreshing = false;
          localStorage.removeItem(ACCESS_KEY);
          localStorage.removeItem(REFRESH_KEY);
          router.navigate(['/auth/login']);
          return throwError(() => e);
        }),
      );
    }),
  );
};
