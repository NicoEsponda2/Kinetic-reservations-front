import { ChangeDetectorRef, Component, inject, NgZone, OnInit } from '@angular/core';
import { DatePipe, DecimalPipe, SlicePipe } from '@angular/common';
import { AuthService } from '@auth/services/auth.service';
import { UserService } from '../../services/user.service';
import { SportImagePipe } from '../../../pipes/sport-image.pipe';
import { CachedImgDirective } from '@shared/directives/cached-img.directive';
import { ToastrService } from 'ngx-toastr';

interface respDataDashboard {
  data: DashboardData;
}
interface DashboardData {
  proximoPartido: ProximoPartido[];
  metricas: Metricas | null | undefined;
}

interface ProximoPartido {
  servicio: string;
  horaInicio: string;
  fecha: string;
  ubicacion: string;
  pista: string;
}

interface Metricas {
  crecimientoPorcentual: number | null;
  reservasRealizadas: number | null;
  deportesPracticados: number | null;
  dineroTotalGastado: number | null;
  promedioPorReserva: number | null;
}

@Component({
  selector: 'app-user-dashboard',
  imports: [DatePipe, DecimalPipe, SlicePipe, SportImagePipe, CachedImgDirective],
  templateUrl: './user-dashboard.component.html',
})
export class UserDashboardComponent implements OnInit {
  private authService = inject(AuthService);
  private userService = inject(UserService);
  private toastr = inject(ToastrService);
  private cdr = inject(ChangeDetectorRef);
  private ngZone = inject(NgZone);

  Math = Math;
  dashboardData?: DashboardData;
  cargando = true;

  get userName(): string {
    return this.authService.user()?.fullName ?? 'Usuario';
  }

  ngOnInit(): void {
    const userId = this.authService.user()?.id_usuario;
    if (userId) {
      this.cargarDatosDashboard(userId);
      return;
    }

    this.authService.checkStatus().subscribe({
      next: () => {
        const resolvedId = this.authService.user()?.id_usuario;
        if (resolvedId) {
          this.cargarDatosDashboard(resolvedId);
        } else {
          this.ngZone.run(() => {
            this.cargando = false;
            this.cdr.markForCheck();
          });
        }
      },
      error: () => {
        this.ngZone.run(() => {
          this.cargando = false;
          this.cdr.markForCheck();
        });
      },
    });
  }

  private cargarDatosDashboard(userId: string): void {
    this.cargando = true;
    this.cdr.markForCheck();

    this.userService.datosDashboardUsuario(userId).subscribe({
      next: (dataDashboard: respDataDashboard) => {
        this.ngZone.run(() => {
          this.dashboardData = dataDashboard.data;
          this.cargando = false;
          this.cdr.markForCheck();
        });
      },
      error: (err) => {
        this.ngZone.run(() => {
          this.cargando = false;
          this.toastr.error(err);
          this.cdr.markForCheck();
        });
      },
    });
  }
}
