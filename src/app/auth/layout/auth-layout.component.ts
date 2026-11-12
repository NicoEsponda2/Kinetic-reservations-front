import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { forkJoin } from 'rxjs';
import { GlobalService } from '@user-front/services/global.service';
import { ServicesParkService } from '@user-front/services/service-park.service';

@Component({
  selector: 'app-auth-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './auth-layout.component.html',
  styleUrl: './auth-layout.component.css',
})
export class AuthLayoutComponent implements OnInit {
  isLoginActive = true;
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);
  private servicesPark = inject(ServicesParkService);
  private globalService = inject(GlobalService);

  readonly cargandoStats = signal(true);
  readonly totalCanchas = signal(0);
  readonly promedioExperiencia = signal<string | null>(null);
  readonly totalResenas = signal(0);

  ngOnInit() {
    this.updateActiveTab();
    this.router.events
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.updateActiveTab();
      });

    this.cargarEstadisticasReales();
  }

  private cargarEstadisticasReales(): void {
    forkJoin({
      servicios: this.servicesPark.obtenerServicios(),
      comentarios: this.globalService.obtenerComentariosInicio(),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ servicios, comentarios }) => {
          const canchas = servicios.reduce(
            (sum, s) => sum + (s.pistas?.length ?? 0),
            0,
          );
          const count = comentarios.length;
          const avg =
            count > 0
              ? (
                  comentarios.reduce(
                    (sum, c) => sum + Number(c.calificacion || 0),
                    0,
                  ) / count
                ).toFixed(1)
              : null;

          this.totalCanchas.set(canchas);
          this.totalResenas.set(count);
          this.promedioExperiencia.set(avg);
          this.cargandoStats.set(false);
        },
        error: () => {
          this.cargandoStats.set(false);
        },
      });
  }

  private updateActiveTab() {
    this.isLoginActive =
      this.router.url.includes('/auth/login') || this.router.url === '/auth';
  }
}
