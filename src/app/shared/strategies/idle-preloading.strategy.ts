import { Injectable } from '@angular/core';
import { PreloadingStrategy, Route } from '@angular/router';
import { Observable, of } from 'rxjs';

/**
 * Precarga en segundo plano (cuando el hilo principal está inactivo) únicamente
 * las rutas públicas marcadas con `data: { preload: true }`, evitando competir
 * con el render inicial (LCP/FCP) y sin descargar paneles privados innecesariamente.
 */
@Injectable({ providedIn: 'root' })
export class IdlePreloadingStrategy implements PreloadingStrategy {
  preload(route: Route, load: () => Observable<unknown>): Observable<unknown> {
    if (!route.data?.['preload'] || typeof window === 'undefined') {
      return of(null);
    }

    return new Observable((subscriber) => {
      const triggerLoad = () => {
        load().subscribe({
          next: (val) => subscriber.next(val),
          error: () => {
            subscriber.next(null);
            subscriber.complete();
          },
          complete: () => subscriber.complete(),
        });
      };

      if (typeof window.requestIdleCallback === 'function') {
        const idleId = window.requestIdleCallback(triggerLoad, {
          timeout: 2500,
        });
        return () => {
          if (typeof window.cancelIdleCallback === 'function') {
            window.cancelIdleCallback(idleId);
          }
        };
      }

      const timerId = setTimeout(triggerLoad, 1200);
      return () => clearTimeout(timerId);
    });
  }
}
