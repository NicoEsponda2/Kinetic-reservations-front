import { ChangeDetectorRef, Component, inject, NgZone, OnInit } from '@angular/core';
import { ComentarioDetalle } from '../../interfaces/comments';
import { ComentariosService } from '../../services/comments.service';
import { AuthService } from '@auth/services/auth.service';
import { SportImagePipe } from '../../../pipes/sport-image.pipe';
import { CachedImgDirective } from '@shared/directives/cached-img.directive';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-user-commets',
  imports: [SportImagePipe, CachedImgDirective],
  templateUrl: './user-commets.component.html',
  styleUrl: './user-commets.component.css',
})
export class UserCommetsComponent implements OnInit {
  private toastr = inject(ToastrService);
  private commentsService = inject(ComentariosService);
  private authService = inject(AuthService);
  private cdr = inject(ChangeDetectorRef);
  private ngZone = inject(NgZone);

  comentarios: ComentarioDetalle[] = [];
  cargando = true;

  ngOnInit(): void {
    const id_usuario = this.authService.user()?.id_usuario;
    if (id_usuario) {
      this.cargarComentarios(id_usuario);
      return;
    }

    this.authService.checkStatus().subscribe({
      next: () => {
        const resolvedId = this.authService.user()?.id_usuario;
        if (resolvedId) {
          this.cargarComentarios(resolvedId);
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

  private cargarComentarios(id_usuario: string): void {
    this.cargando = true;
    this.cdr.markForCheck();

    this.commentsService.getComentariosByUsuario(id_usuario).subscribe({
      next: (data) => {
        this.ngZone.run(() => {
          this.comentarios = data;
          this.cargando = false;
          this.cdr.markForCheck();
        });
      },
      error: () => {
        this.ngZone.run(() => {
          this.cargando = false;
          this.toastr.error(
            'Contacte al Administrador.',
            'Error al cargar los comentarios',
          );
          this.cdr.markForCheck();
        });
      },
    });
  }

  get totalComentarios(): number {
    return this.comentarios.length;
  }

  get comentariosEsteMes(): number {
    if (!this.comentarios.length) return 0;
    const now = new Date();
    return this.comentarios.filter((c) => {
      const d = new Date(c.created_at);
      return (
        d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
      );
    }).length;
  }

  get promedioCalificacion(): string {
    if (!this.comentarios.length) return '0.0';
    const sum = this.comentarios.reduce((acc, c) => acc + c.calificacion, 0);
    return (sum / this.comentarios.length).toFixed(1);
  }

  get deportesEvaluados(): number {
    if (!this.comentarios.length) return 0;
    const deportesUnicos = new Set(
      this.comentarios
        .map((c) => c.nombre_servicio || String(c.id_servicio))
        .filter(Boolean),
    );
    return deportesUnicos.size;
  }

  get deporteFavorito(): string {
    if (!this.comentarios.length) return 'Sin reseñas';
    const conteo = new Map<string, number>();
    for (const c of this.comentarios) {
      const nombre = c.nombre_servicio?.trim();
      if (!nombre) continue;
      conteo.set(nombre, (conteo.get(nombre) ?? 0) + 1);
    }
    let mejorDeporte = '';
    let max = 0;
    for (const [deporte, cantidad] of conteo.entries()) {
      if (cantidad > max) {
        max = cantidad;
        mejorDeporte = deporte;
      }
    }
    return mejorDeporte || 'General';
  }

  estrellas(calificacion: number): boolean[] {
    return Array(5)
      .fill(false)
      .map((_, i) => i < calificacion);
  }

  formatearFecha(fecha: string): string {
    return new Date(fecha).toLocaleDateString('es-CL', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  getStarStyle(llena: boolean): string {
    return llena ? "'FILL' 1" : "'FILL' 0";
  }
}
