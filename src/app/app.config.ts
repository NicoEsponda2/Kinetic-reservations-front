import {
  ApplicationConfig,
  importProvidersFrom,
  provideZoneChangeDetection,
  LOCALE_ID,
} from '@angular/core';
import {
  provideRouter,
  withInMemoryScrolling,
  withPreloading,
} from '@angular/router';
import { ToastNoAnimationModule } from 'ngx-toastr';
import { registerLocaleData } from '@angular/common';
import localeEsCL from '@angular/common/locales/es-CL';

registerLocaleData(localeEsCL);

import { routes } from './app.routes';
import {
  provideHttpClient,
  withFetch,
  withInterceptors,
} from '@angular/common/http';

import { authInterceptor } from '@auth/interceptors/auth.interceptor';
import { httpCacheInterceptor } from '@shared/interceptors/http-cache.interceptor';
import { IdlePreloadingStrategy } from '@shared/strategies/idle-preloading.strategy';

export const appConfig: ApplicationConfig = {
  providers: [
    { provide: LOCALE_ID, useValue: 'es-CL' },
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(
      routes,
      withPreloading(IdlePreloadingStrategy),
      withInMemoryScrolling({
        anchorScrolling: 'enabled',
        scrollPositionRestoration: 'top',
      }),
    ),
    provideHttpClient(
      withFetch(),
      withInterceptors([authInterceptor, httpCacheInterceptor]),
    ),
    importProvidersFrom(
      ToastNoAnimationModule.forRoot({
        timeOut: 1300,
        positionClass: 'toast-top-right',
        preventDuplicates: true,
        progressBar: true,
        closeButton: true,
        newestOnTop: true,
      }),
    ),
  ],
};
