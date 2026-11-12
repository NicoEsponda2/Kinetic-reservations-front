import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AuthLayoutComponent } from './auth-layout.component';
import { GlobalService } from '@user-front/services/global.service';
import { ServicesParkService } from '@user-front/services/service-park.service';

describe('AuthLayoutComponent (Estadísticas reales en tarjetas Bento)', () => {
  let component: AuthLayoutComponent;
  let fixture: ComponentFixture<AuthLayoutComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AuthLayoutComponent],
      providers: [
        provideRouter([]),
        {
          provide: ServicesParkService,
          useValue: {
            obtenerServicios: () =>
              of([
                {
                  id_deporte: 'sport-1',
                  nombre: 'Tenis',
                  descripcion: '',
                  is_active: true,
                  pistas: [
                    { id_pista: 1, nombre: 'Cancha 1', precio_hora: 15000, is_active: true },
                    { id_pista: 2, nombre: 'Cancha 2', precio_hora: 15000, is_active: true },
                  ],
                },
                {
                  id_deporte: 'sport-2',
                  nombre: 'Hockey',
                  descripcion: '',
                  is_active: true,
                  pistas: [
                    { id_pista: 3, nombre: 'Cancha 1', precio_hora: 20000, is_active: true },
                  ],
                },
              ]),
          },
        },
        {
          provide: GlobalService,
          useValue: {
            obtenerComentariosInicio: () =>
              of([
                {
                  deporte: 'Tenis',
                  titulo: 'Excelente',
                  calificacion: 5,
                  comentario: 'Muy buena',
                  nombre: 'Ana',
                  fecha: '10 de noviembre de 2026',
                },
                {
                  deporte: 'Hockey',
                  titulo: 'Muy buen servicio',
                  calificacion: 4,
                  comentario: 'Buen estado',
                  nombre: 'Luis',
                  fecha: '11 de noviembre de 2026',
                },
              ]),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AuthLayoutComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('calcula y muestra la cantidad real de canchas activas y el promedio real de experiencia manteniendo 24/7', () => {
    expect(component.totalCanchas()).toBe(3);
    expect(component.totalResenas()).toBe(2);
    expect(component.promedioExperiencia()).toBe('4.5');

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('3');
    expect(text).toContain('Canchas Activas');
    expect(text).toContain('24/7');
    expect(text).toContain('Acceso Total');
    expect(text).toContain('★ 4.5');
    expect(text).toContain('Experiencia');
  });
});
