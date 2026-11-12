import { ChangeDetectionStrategy, Component } from '@angular/core';

interface DatosInicio {
  numero: number;
  icono: string;
  titulo: string;
  descripcion: string;
  imagen: string;
}

@Component({
  standalone: true,
  selector: 'app-home',
  imports: [],
  templateUrl: './home.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeComponent {
  readonly fondoHero =
    'https://res.cloudinary.com/dhwoq5fdq/image/upload/f_auto,q_auto,w_800/v1791386286/KINETIC-RESERVATIONS/Static/sydue45ekjbnfxxfoini.jpg';

  pasosReserva: DatosInicio[] = [
    {
      numero: 1,
      icono: 'person_add',
      titulo: 'Regístrate / Inicia Sesión',
      descripcion:
        'Crea tu cuenta o accede para gestionar tus reservas en segundos.',
      imagen:
        'https://res.cloudinary.com/dhwoq5fdq/image/upload/f_auto,q_auto,w_800/v1791386285/KINETIC-RESERVATIONS/Static/gdz56k1oqwutsnelxinc.jpg',
    },
    {
      numero: 2,
      icono: 'touch_app',
      titulo: 'Reserva',
      descripcion: 'Selecciona tu horario y asegura tu plaza al instante.',
      imagen:
        'https://res.cloudinary.com/dhwoq5fdq/image/upload/f_auto,q_auto,w_800/v1791386286/KINETIC-RESERVATIONS/Static/t34dcvshpn9dtehi1waz.jpg',
    },
    {
      numero: 3,
      icono: 'sports_soccer',
      titulo: 'Juega',
      descripcion:
        'Preséntate en el centro deportivo y ¡a dejarlo todo en la cancha!',
      imagen:
        'https://res.cloudinary.com/dhwoq5fdq/image/upload/f_auto,q_auto,w_800/v1791386286/KINETIC-RESERVATIONS/Static/d0sinqaglemtimuv2gyw.jpg',
    },
  ];
}
