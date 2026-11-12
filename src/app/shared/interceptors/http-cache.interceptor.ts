import {
  HttpHandlerFn,
  HttpRequest,
  HttpResponse,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { finalize, of, shareReplay, tap } from 'rxjs';
import {
  HttpCacheService,
  SKIP_HTTP_CACHE,
} from '@shared/services/http-cache.service';

/**
 * Interceptor funcional de caché HTTP persistente (RAM + sessionStorage) con deduplicación
 * de peticiones simultáneas e invalidación automática ante mutaciones.
 */
export function httpCacheInterceptor(
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
) {
  const cache = inject(HttpCacheService);

  // 1. Cualquier escritura exitosa invalida el caché para mantener datos 100% frescos
  if (req.method !== 'GET') {
    return next(req).pipe(
      tap((event) => {
        if (event instanceof HttpResponse) {
          cache.invalidateAll();
        }
      }),
    );
  }

  // 2. Permitir omitir caché explícitamente por contexto o cabecera
  if (req.context.get(SKIP_HTTP_CACHE) || req.headers.has('X-Skip-Cache')) {
    return next(req);
  }

  const ttlMs = cache.resolveTtlMs(req.url);
  if (ttlMs <= 0) {
    return next(req);
  }

  const authHeader = req.headers.get('Authorization');
  const isAuthenticated = Boolean(authHeader);
  const cacheKey = cache.buildKey(req.urlWithParams, authHeader);

  // 3. Cache HIT (RAM o sessionStorage tras recargar con F5): respuesta en 0ms sin red
  const cachedBody = cache.get(cacheKey);
  if (cachedBody !== null) {
    return of(
      new HttpResponse({
        body: cachedBody,
        status: 200,
        statusText: 'OK (Cached)',
        url: req.urlWithParams,
      }),
    );
  }

  // 4. Deduplicación: si otro componente pidió la misma URL en este mismo instante, reutilizar llamada
  const existingInFlight$ = cache.getInFlight(cacheKey);
  if (existingInFlight$) {
    return existingInFlight$;
  }

  // 5. Cache MISS: consultar al backend y persistir respuesta con TTL
  const networkRequest$ = next(req).pipe(
    tap((event) => {
      if (event instanceof HttpResponse && event.status === 200) {
        cache.set(cacheKey, event.body, ttlMs, isAuthenticated);

        // Si es renovación de JWT (/auth/renew) y devuelve un nuevo token rotado,
        // indexamos también bajo ese nuevo Bearer para que los siguientes F5 hagan HIT directo.
        if (
          req.url.includes('/auth/renew') &&
          event.body &&
          typeof event.body === 'object' &&
          'token' in event.body &&
          typeof (event.body as { token?: unknown }).token === 'string'
        ) {
          const rotatedToken = (event.body as { token: string }).token;
          const rotatedKey = cache.buildKey(
            req.urlWithParams,
            `Bearer ${rotatedToken}`,
          );
          cache.set(rotatedKey, event.body, ttlMs, true);
        }
      }
    }),
    shareReplay({ bufferSize: 1, refCount: false }),
    finalize(() => cache.deleteInFlight(cacheKey)),
  );

  cache.setInFlight(cacheKey, networkRequest$);
  return networkRequest$;
}

