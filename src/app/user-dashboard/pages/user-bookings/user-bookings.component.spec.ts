import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { ToastrService } from 'ngx-toastr';
import { UserBookingsComponent } from './user-bookings.component';
import { UserService } from '../../services/user.service';
import { AuthService } from '@auth/services/auth.service';
import { ImageCacheService } from '@shared/services/image-cache.service';
import { DiasRestantesPipe } from '../../../pipes/dias-restantes.pipe';

describe('UserBookingsComponent (Próximos Partidos e Historial)', () => {
  let component: UserBookingsComponent;
  let fixture: ComponentFixture<UserBookingsComponent>;

  const mockReservas = [
    {
      id_reserva: 101,
      id_servicio: 'sport-1',
      servicio: 'Tenis',
      imagen_principal: 'https://cdn.example.com/tenis.webp',
      pista: 'Cancha 1 - Arcilla',
      estado: 'Pagada',
      fecha: '2026-11-11',
      horaInicio: '13:00:00',
      tieneResena: false,
    },
    {
      id_reserva: 102,
      id_servicio: 'sport-2',
      servicio: 'Hockey',
      imagen_principal: null,
      pista: 'Cancha 1',
      estado: 'Pagada',
      fecha: '2026-11-11',
      horaInicio: '15:00:00',
      tieneResena: false,
    },
    {
      id_reserva: 103,
      id_servicio: 'sport-3',
      servicio: 'Fútbol',
      imagen_principal: null,
      pista: 'Cancha 2',
      estado: 'Cancelada',
      fecha: '2026-11-12',
      horaInicio: '18:00:00',
      tieneResena: false,
    },
    {
      id_reserva: 104,
      id_servicio: 'sport-1',
      servicio: 'Tenis',
      imagen_principal: null,
      pista: 'Cancha 1 - Arcilla',
      estado: 'Pagada',
      fecha: '2026-11-10',
      horaInicio: '18:00:00',
      tieneResena: false,
    },
  ];

  beforeEach(async () => {
    jasmine.clock().install();
    // 11 nov 2026 12:42:00 America/Santiago (UTC-3 => 15:42:00Z)
    jasmine.clock().mockDate(new Date('2026-11-11T15:42:00.000Z'));

    await TestBed.configureTestingModule({
      imports: [UserBookingsComponent],
      providers: [
        {
          provide: AuthService,
          useValue: {
            user: signal({ id_usuario: 'user-uuid-1' }),
          },
        },
        {
          provide: UserService,
          useValue: {
            obtenerHistorialReservas: () =>
              of({ ok: true, data: mockReservas }),
            obtenerResenaById: () => of({ data: null }),
          },
        },
        {
          provide: ImageCacheService,
          useValue: {
            resolveImageUrl: (url: string) => Promise.resolve(url),
          },
        },
        {
          provide: ToastrService,
          useValue: {
            error: jasmine.createSpy('error'),
            success: jasmine.createSpy('success'),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(UserBookingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    jasmine.clock().uninstall();
  });

  it('muestra las reservas próximas del mismo día en la sección superior sin mostrar el estado vacío', () => {
    expect(component.proximosPartidos.length).toBe(2);
    expect(component.proximosPartidos.map((p) => p.id_reserva)).toEqual([
      101,
      102,
    ]);

    const compiled = fixture.nativeElement as HTMLElement;
    const text = compiled.textContent ?? '';

    expect(text).toContain('PRÓXIMOS PARTIDOS');
    expect(text).toContain('2 PRÓXIMAS');
    expect(text).toContain('Cancha 1 - Arcilla');
    expect(text).not.toContain('No tienes reservas próximas');
  });

  it('solo habilita gestionar reseña cuando la fecha y hora de la reserva ya comenzaron', () => {
    expect(component.puedeGestionarResena(mockReservas[0])).toBeFalse();
    expect(component.puedeGestionarResena(mockReservas[3])).toBeTrue();
    expect(component.puedeGestionarResena(mockReservas[2])).toBeFalse();
  });

  it('DiasRestantesPipe calcula Hoy y Mañana sin desplazamiento UTC para cadenas YYYY-MM-DD', () => {
    const pipe = new DiasRestantesPipe();
    expect(pipe.transform('2026-11-11')).toBe('Hoy');
    expect(pipe.transform('2026-11-12')).toBe('Mañana');
    expect(pipe.transform('2026-11-10')).toBe('Ayer');
  });
});
