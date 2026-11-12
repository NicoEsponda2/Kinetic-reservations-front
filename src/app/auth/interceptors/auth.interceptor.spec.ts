import { TestBed } from '@angular/core/testing';
import {
  HttpClient,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from '@auth/services/auth.service';
import { environment } from 'src/environments/environment';

describe('authInterceptor (Seguridad de Token JWT en Frontend)', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  const tokenSignal = signal<string | null>(null);

  beforeEach(() => {
    tokenSignal.set('jwt-secret-token-123');

    TestBed.configureTestingModule({
      providers: [
        {
          provide: AuthService,
          useValue: {
            token: tokenSignal,
          },
        },
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });

    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('debe adjuntar el encabezado Authorization Bearer en peticiones dirigidas al backend (environment.baseUrl)', () => {
    http.get(`${environment.baseUrl}/admin/dashboard`).subscribe();

    const req = httpMock.expectOne(`${environment.baseUrl}/admin/dashboard`);
    expect(req.request.headers.get('Authorization')).toBe(
      'Bearer jwt-secret-token-123',
    );
    req.flush({ ok: true });
  });

  it('NO debe adjuntar ni filtrar el token JWT hacia dominios externos de terceros', () => {
    const externalUrl = 'https://res.cloudinary.com/demo/image/upload/sample.jpg';
    http.get(externalUrl).subscribe();

    const req = httpMock.expectOne(externalUrl);
    expect(req.request.headers.has('Authorization')).toBeFalse();
    req.flush({});
  });

  it('no debe adjuntar el encabezado Authorization cuando no hay sesión activa', () => {
    tokenSignal.set(null);

    http.get(`${environment.baseUrl}/sport/home`).subscribe();

    const req = httpMock.expectOne(`${environment.baseUrl}/sport/home`);
    expect(req.request.headers.has('Authorization')).toBeFalse();
    req.flush({});
  });
});
