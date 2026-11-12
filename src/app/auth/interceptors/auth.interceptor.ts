import { HttpHandlerFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '@auth/services/auth.service';
import { environment } from 'src/environments/environment';

export function authInterceptor(
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
) {
  const isBackendRequest =
    req.url.startsWith(environment.baseUrl) || req.url.startsWith('/api');

  if (!isBackendRequest || req.headers.has('Authorization')) {
    return next(req);
  }

  const token = inject(AuthService).token() ?? localStorage.getItem('token');
  if (!token) {
    return next(req);
  }

  const newReq = req.clone({
    setHeaders: {
      Authorization: `Bearer ${token}`,
    },
  });
  return next(newReq);
}
