import { Component, inject, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from 'src/environments/environment';
import { CachedImgDirective } from '@shared/directives/cached-img.directive';

export interface BookingDetail {
  courtName: string;
  courtType: string;
  fecha: string;
  schedule: string;
  totalPaid: string;
  imageUrl: string;
}

@Component({
  selector: 'app-confirm-booking',
  imports: [CachedImgDirective],
  templateUrl: './confirm-booking.component.html',
})
export class ConfirmBookingComponent implements OnInit {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private http = inject(HttpClient);

  booking!: BookingDetail;
  cargando = true;
  errorPago = false;
  estadoNavegacion = this.router.getCurrentNavigation()?.extras?.state;

  ngOnInit(): void {
    // Escenario A: Retorno exitoso de la pasarela de pagos
    const tokenWsUrl = this.route.snapshot.queryParamMap.get('token_ws');
    if (tokenWsUrl) {
      this.confirmarPagoTransbank(tokenWsUrl);
      return;
    }

    // Escenario B: Navegacion manual desde otra vista del sistema
    if (this.estadoNavegacion?.['booking']) {
      this.booking = this.estadoNavegacion['booking'];
      this.cargando = false;
      return;
    }

    // Escenario C: Intruso o recarga de pagina sin datos
    this.router.navigate(['/']);
  }

  private confirmarPagoTransbank(tokenWsString: string): void {
    const reservaGuardada =
      sessionStorage.getItem('reservaPendiente') ||
      localStorage.getItem('reservaPendiente');
    const datosReserva = reservaGuardada ? JSON.parse(reservaGuardada) : null;

    const payloadBackend = {
      tokenWs: tokenWsString,
      datosReserva: {
        idUsuario: datosReserva?.idUsuario,
        idPista:
          datosReserva?.idPista !== undefined
            ? Number(datosReserva.idPista)
            : undefined,
        fecha: datosReserva?.fecha,
        horaInicio: datosReserva?.horaInicio,
        horaTermino: datosReserva?.horaTermino,
        comentario: datosReserva?.comentario || '',
        email: datosReserva?.email,
        nombreUsuario: datosReserva?.nombreUsuario,
        nombreCancha: datosReserva?.nombreCancha,
      },
    };

    this.http
      .post<any>(`${environment.baseUrl}/payment/commit`, payloadBackend)
      .subscribe({
        next: (res) => {
          if (res.ok && res.status === 'AUTHORIZED') {
            this.booking = {
              courtName:
                datosReserva?.courtName ||
                res.courtName ||
                'Cancha Reservada',
              courtType:
                datosReserva?.courtType || res.courtType || 'Deporte',
              fecha: datosReserva?.fecha || res.fecha || '',
              schedule: datosReserva?.schedule || res.schedule || '',
              totalPaid: `$${res.amount.toLocaleString('es-CL')}`,
              imageUrl: res.imageUrl || datosReserva?.imageUrl || '',
            };

            sessionStorage.removeItem('reservaPendiente');
            localStorage.removeItem('reservaPendiente');
            this.cargando = false;
          } else {
            this.errorPago = true;
            this.cargando = false;
          }
        },
        error: () => {
          this.errorPago = true;
          this.cargando = false;
        },
      });
  }

  verReserva(): void {
    if (this.router.url.startsWith('/admin')) {
      this.router.navigate(['/admin/bookings']);
      return;
    }
    this.router.navigate(['/panel-usuario/dashboard-usuario']);
  }

  volverInicio(): void {
    this.router.navigate(['/']);
  }

  contactarSoporte(): void {
    this.router.navigate(['/soporte']);
  }
}
