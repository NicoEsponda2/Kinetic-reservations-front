import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, NgZone, signal } from '@angular/core';
import { environment } from 'src/environments/environment';
import {
  catchError,
  finalize,
  firstValueFrom,
  map,
  Observable,
  of,
  shareReplay,
  switchMap,
} from 'rxjs';

import {
  AuthResponse,
  RegisterFormValues,
} from '@auth/interfaces/auth-response.interface';
import { User } from '@auth/interfaces/user.interface';
import { Router } from '@angular/router';
import { HttpCacheService } from '@shared/services/http-cache.service';

declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2?: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            prompt?: string;
            callback: (response: {
              access_token?: string;
              error?: string;
              error_description?: string;
            }) => void;
            error_callback?: (error: {
              type?: string;
              message?: string;
            }) => void;
          }) => {
            requestAccessToken: (overrideConfig?: { prompt?: string }) => void;
          };
        };
      };
    };
  }
}

type AuthStatus = 'checking' | 'authenticated' | 'not-authenticated';
const baseUrl = environment.baseUrl;
const SESSION_USER_KEY = 'kr_auth_user_v2';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly initialToken = localStorage.getItem('token');
  private readonly initialUser = this.initialToken
    ? this.readCachedUser()
    : null;

  private _authStatus = signal<AuthStatus>(
    this.initialToken
      ? this.initialUser
        ? 'authenticated'
        : 'checking'
      : 'not-authenticated',
  );
  private _user = signal<User | null>(this.initialUser);
  private _token = signal<string | null>(this.initialToken);
  private cachedGoogleClientId: string | null = null;

  private sessionVerified = false;
  private checkStatusInFlight$: Observable<boolean> | null = null;

  private http = inject(HttpClient);
  private router = inject(Router);
  private ngZone = inject(NgZone);
  private httpCache = inject(HttpCacheService);

  authStatus = computed<AuthStatus>(() => {
    if (this._authStatus() === 'checking') return 'checking';

    if (this._user()) {
      return 'authenticated';
    }

    return 'not-authenticated';
  });

  user = computed(() => this._user());
  token = computed(this._token);
  isAdmin = computed(() => this._user()?.roles?.includes('admin') ?? false);

  constructor() {
    if (this.initialToken) {
      queueMicrotask(() => {
        this.checkStatus().subscribe();
      });
    }
  }

  /**
   * Indica si la sesión actual ya fue validada durante este ciclo de vida,
   * permitiendo a los guards resolver en 0ms sin crear promesas innecesarias.
   */
  isSessionVerified(): boolean {
    return this.sessionVerified && this._authStatus() === 'authenticated';
  }

  login(email: string, password: string): Observable<[boolean, string]> {
    return this.http
      .post<AuthResponse>(`${baseUrl}/auth/login`, {
        email,
        password,
      })
      .pipe(
        map((resp) => this.handleAuthSuccess(resp)),
        catchError((error) =>
          this.handleAuthError(
            this.extractErrorMessage(error, 'Error al iniciar sesión'),
          ),
        ),
      );
  }

  register(formData: RegisterFormValues): Observable<[boolean, string]> {
    return this.http
      .post<AuthResponse>(`${baseUrl}/auth/register`, formData)
      .pipe(
        map((resp) => this.handleAuthSuccess(resp)),
        catchError((error) =>
          this.handleAuthError(
            this.extractErrorMessage(error, 'Error al registrarse'),
          ),
        ),
      );
  }

  /**
   * Abre el selector de cuentas de Google (sirve tanto para Login como para Registro)
   * y valida el token con el módulo /api/auth/google del backend.
   */
  loginWithGoogle(): Observable<[boolean, string]> {
    return new Observable<string>((subscriber) => {
      this.resolveGoogleClientId()
        .then(async (clientId) => {
          if (!clientId) {
            subscriber.error({
              error: {
                message:
                  'Falta configurar GOOGLE_CLIENT_ID en el archivo .env del backend o en environment.ts',
              },
            });
            return;
          }

          await this.ensureGoogleScriptLoaded();

          const oauth2 = window.google?.accounts?.oauth2;
          if (!oauth2) {
            subscriber.error({
              error: {
                message:
                  'No se pudo cargar el servicio de autenticación de Google',
              },
            });
            return;
          }

          const tokenClient = oauth2.initTokenClient({
            client_id: clientId,
            scope: 'openid email profile',
            prompt: 'select_account',
            callback: (response) => {
              this.ngZone.run(() => {
                if (response.error || !response.access_token) {
                  subscriber.error({
                    error: {
                      message:
                        response.error_description ||
                        'Se canceló o falló la autenticación con Google',
                    },
                  });
                  return;
                }
                subscriber.next(response.access_token);
                subscriber.complete();
              });
            },
            error_callback: (err) => {
              this.ngZone.run(() => {
                const msg =
                  err?.type === 'popup_closed'
                    ? 'Se cerró la ventana de Google antes de completar el acceso'
                    : 'No se pudo abrir la ventana de autenticación de Google';
                subscriber.error({ error: { message: msg } });
              });
            },
          });

          tokenClient.requestAccessToken({ prompt: 'select_account' });
        })
        .catch((err) => {
          this.ngZone.run(() => subscriber.error(err));
        });
    }).pipe(
      switchMap((googleToken) =>
        this.http.post<AuthResponse>(`${baseUrl}/auth/google`, {
          token: googleToken,
        }),
      ),
      map((resp) => {
        const [ok] = this.handleAuthSuccess(resp);
        const msg = resp.isNewUser
          ? '¡Cuenta creada con Google exitosamente!'
          : '¡Inicio de sesión con Google exitoso!';
        return [ok, msg] as [boolean, string];
      }),
      catchError((error) =>
        this.handleAuthError(
          this.extractErrorMessage(
            error,
            'Error al autenticar con tu cuenta de Google',
          ),
        ),
      ),
    );
  }

  checkStatus(): Observable<boolean> {
    const token = localStorage.getItem('token');
    if (!token) {
      if (this._authStatus() !== 'not-authenticated') {
        this.logout();
      }
      return of(false);
    }

    if (this.sessionVerified && this._user()) {
      return of(true);
    }

    if (this.checkStatusInFlight$) {
      return this.checkStatusInFlight$;
    }

    this.checkStatusInFlight$ = this.http
      .get<AuthResponse>(`${baseUrl}/auth/renew`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      .pipe(
        map((resp) => {
          this.handleAuthSuccess(resp);
          return true;
        }),
        catchError(() => {
          this.logout();
          this.router.navigate(['/']);
          return of(false);
        }),
        shareReplay({ bufferSize: 1, refCount: false }),
        finalize(() => {
          this.checkStatusInFlight$ = null;
        }),
      );

    return this.checkStatusInFlight$;
  }

  updateUser(usuario: User) {
    if (!usuario) return;
    const normalized: User = {
      ...usuario,
      fullName:
        usuario.fullName ||
        [usuario.nombre, usuario.apellido].filter(Boolean).join(' '),
    };
    this._user.set(normalized);
    this.writeCachedUser(normalized);
  }

  logout() {
    this.sessionVerified = false;
    this._user.set(null);
    this._token.set(null);
    this._authStatus.set('not-authenticated');
    localStorage.removeItem('token');
    this.clearCachedUser();
    this.httpCache.invalidateAuthenticated();
  }

  private handleAuthSuccess({
    token,
    usuario,
  }: AuthResponse): [boolean, string] {
    this.sessionVerified = true;
    this._authStatus.set('authenticated');
    this.updateUser(usuario);
    this._token.set(token);
    localStorage.setItem('token', token);
    return [true, 'Autenticación exitosa'];
  }

  private handleAuthError(error: string): Observable<[boolean, string]> {
    this.logout();
    return of([false, error]);
  }

  private readCachedUser(): User | null {
    try {
      const raw =
        sessionStorage.getItem(SESSION_USER_KEY) ||
        localStorage.getItem(SESSION_USER_KEY);
      return raw ? (JSON.parse(raw) as User) : null;
    } catch {
      return null;
    }
  }

  private writeCachedUser(user: User): void {
    try {
      const serialized = JSON.stringify(user);
      sessionStorage.setItem(SESSION_USER_KEY, serialized);
      localStorage.setItem(SESSION_USER_KEY, serialized);
    } catch {
      // No-op si el almacenamiento está restringido
    }
  }

  private clearCachedUser(): void {
    try {
      sessionStorage.removeItem(SESSION_USER_KEY);
      localStorage.removeItem(SESSION_USER_KEY);
    } catch {
      // No-op
    }
  }

  private extractErrorMessage(error: any, fallback: string): string {
    const rawMsg = error?.error?.message || error?.error?.msg;
    if (Array.isArray(rawMsg)) {
      return rawMsg.join('. ');
    }
    if (typeof rawMsg === 'string' && rawMsg.trim().length > 0) {
      return rawMsg;
    }
    return fallback;
  }

  private async resolveGoogleClientId(): Promise<string> {
    if (this.cachedGoogleClientId) {
      return this.cachedGoogleClientId;
    }
    try {
      const resp = await firstValueFrom(
        this.http.get<{ clientId: string }>(`${baseUrl}/auth/google/config`),
      );
      if (resp?.clientId) {
        this.cachedGoogleClientId = resp.clientId;
        return resp.clientId;
      }
    } catch {
      // Ignorar si no está disponible y devolver vacío
    }
    return '';
  }

  private ensureGoogleScriptLoaded(): Promise<void> {
    if (window.google?.accounts?.oauth2) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      const existingScript = document.querySelector(
        'script[src="https://accounts.google.com/gsi/client"]',
      ) as HTMLScriptElement | null;

      if (existingScript) {
        existingScript.addEventListener('load', () => resolve(), {
          once: true,
        });
        existingScript.addEventListener(
          'error',
          () => reject(new Error('No se pudo cargar Google Identity Services')),
          { once: true },
        );
        if (window.google?.accounts?.oauth2) {
          resolve();
        }
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () =>
        reject(new Error('No se pudo cargar Google Identity Services'));
      document.head.appendChild(script);
    });
  }
}
