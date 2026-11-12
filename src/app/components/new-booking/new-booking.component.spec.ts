import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { ToastrService } from 'ngx-toastr';
import { NewBookingComponent } from './new-booking.component';
import { AuthService } from '@auth/services/auth.service';
import { GlobalService } from '@user-front/services/global.service';
import { environment } from 'src/environments/environment';

describe('NewBookingComponent (Validación de Reserva e Integración Webpay)', () => {
  let component: NewBookingComponent;
  let fixture: ComponentFixture<NewBookingComponent>;
  let httpMock: HttpTestingController;

  const mockUser = {
    id_usuario: '11111111-1111-4111-8111-111111111111',
    nombre: 'Ana Pérez',
    email: 'ana@example.com',
    telefono: '+56912345678',
    roles: ['user'],
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NewBookingComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: AuthService,
          useValue: {
            user: signal(mockUser),
            isAdmin: () => false,
          },
        },
        {
          provide: GlobalService,
          useValue: {
            buscarNombreServicios: () =>
              of([
                {
                  id_servicio: 'sport-uuid-1',
                  nombre: 'Pádel',
                  pistas: [
                    { id_pista: 5, nombre: 'Cancha Cristal 1', precio_hora: 20000 },
                  ],
                },
              ]),
            obtenerHorariosDisponibles: () =>
              of([{ hora_inicio: '18:00:00', hora_termino: '19:00:00' }]),
          },
        },
        {
          provide: ToastrService,
          useValue: {
            error: jasmine.createSpy('error'),
            success: jasmine.createSpy('success'),
            warning: jasmine.createSpy('warning'),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(NewBookingComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('debe inicializar el formulario con los datos del usuario autenticado y validar campos requeridos', () => {
    expect(component.bookingForm.get('fullName')?.value).toBe('Ana Pérez');
    expect(component.bookingForm.get('email')?.value).toBe('ana@example.com');
    expect(component.bookingForm.get('phone')?.value).toBe('+56912345678');
    // Sin deporte, cancha, fecha ni bloque horario el formulario debe ser inválido
    expect(component.bookingForm.valid).toBeFalse();
  });

  it('debe permitir seleccionar el dia actual de America/Santiago', () => {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Santiago',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date());
    const getPart = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find((part) => part.type === type)?.value ?? '';
    const today = `${getPart('year')}-${getPart('month')}-${getPart('day')}`;
    const dateInput: HTMLInputElement =
      fixture.nativeElement.querySelector('input[type="date"]');

    expect(component.minDate).toBe(today);
    expect(dateInput.min).toBe(today);
  });

  it('debe rechazar teléfonos que no cumplan con el formato chileno +569XXXXXXXX', () => {
    const phoneControl = component.bookingForm.get('phone');
    phoneControl?.setValue('+569123');
    expect(phoneControl?.valid).toBeFalse();

    phoneControl?.setValue('+56987654321');
    expect(phoneControl?.valid).toBeTrue();
  });

  it('debe enviar id_pista, fecha, hora_inicio y hora_termino al iniciar el pago en Webpay', () => {
    component.bookingForm.patchValue({
      sport: 'sport-uuid-1',
      court: 5,
      date: '2026-11-25',
      timeSlot: '18:00:00 - 19:00:00',
      players: 4,
    });

    expect(component.bookingForm.valid).toBeTrue();

    component.iniciarPagoTransbank();

    const req = httpMock.expectOne(
      `${environment.baseUrl}/payment/initiate-payment`,
    );
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(
      jasmine.objectContaining({
        id_usuario: mockUser.id_usuario,
        id_pista: 5,
        fecha: '2026-11-25',
        hora_inicio: '18:00:00',
        hora_termino: '19:00:00',
        monto: 20000,
      }),
    );

    req.flush({
      ok: true,
      url: 'https://webpay3gint.transbank.cl/webpayserver/initTransaction',
      token: 'token-test-123',
    });
  });
});
