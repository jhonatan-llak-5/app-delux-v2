import { HttpInterceptorFn } from '@angular/common/http';

const ACCESS_KEY = 'dlx_access_token';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem(ACCESS_KEY) : null;
  if (token) {
    req = req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
  }
  return next(req);
};
