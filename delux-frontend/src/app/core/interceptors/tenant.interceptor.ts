import { HttpInterceptorFn } from '@angular/common/http';
import { environment } from '@env/environment';

/**
 * Multi-tenant: añade el slug del tenant en cada request
 * Si en el futuro la plataforma corre varios tenants se resuelve por subdominio
 */
export const tenantInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(environment.apiUrl)) {
    return next(req);
  }
  return next(req.clone({ setHeaders: { 'X-Tenant': environment.tenant } }));
};
