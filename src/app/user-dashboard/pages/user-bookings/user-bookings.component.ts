import { ChangeDetectorRef, Component, inject, NgZone, OnInit } from '@angular/core';
import { DatePipe, NgClass, SlicePipe } from '@angular/common';

import {
  TableComponent,
  TableColumn,
} from '../../../components/table/table.component';
import { NewCommentsComponent } from '../../components/new-commets/new-comments.component';

import { UserService } from '../../services/user.service';
import { AuthService } from '@auth/services/auth.service';
import { ToastrService } from 'ngx-toastr';
import { SportImagePipe } from '../../../pipes/sport-image.pipe';
import { CloudinaryImagePipe } from '../../../pipes/cloudinary-image.pipe';
import { SportIconPipe } from '../../../pipes/sport-icon.pipe';
import { DiasRestantesPipe } from '../../../pipes/dias-restantes.pipe';
import { CachedImgDirective } from '@shared/directives/cached-img.directive';
import {
  isBusinessDateTimePast,
  normalizeBusinessDate,
  normalizeWallTime,
} from '@shared/utils/business-time.util';

@Component({
  selector: 'app-bookings',
  imports: [
    NgClass,
    DatePipe,
    SlicePipe,
    TableComponent,
    NewCommentsComponent,
    SportImagePipe,
    CloudinaryImagePipe,
    SportIconPipe,
    DiasRestantesPipe,
    CachedImgDirective,
  ],
  templateUrl: './user-bookings.component.html',
})
export class UserBookingsComponent implements OnInit {
  private userService = inject(UserService);
  private authService = inject(AuthService);
  private toastr = inject(ToastrService);
  private cdr = inject(ChangeDetectorRef);
  private ngZone = inject(NgZone);

  modalResenaAbierto = false;
  reservaSeleccionadaId: number = 0;
  servicioSeleccionadoId: number = 0;
  datosResenaActual: any = null;

  tableColumns: TableColumn[] = [
    { key: 'servicio', label: 'Deporte' },
    { key: 'pista', label: 'Cancha' },
    { key: 'fecha', label: 'Fecha', isCustom: true },
    { key: 'horaInicio', label: 'Horario', isCustom: true },
    { key: 'estado', label: 'Estado', isCustom: true },
    { key: 'reseña', label: 'Reseña', isCustom: true },
  ];

  datosReservas: any[] = [];
  proximosPartidos: any[] = [];
  cargando = true;
  errorCarga = false;

  // Paginación para <app-table>
  paginatedReservas: any[] = [];
  currentPage: number = 1;
  pageSize: number = 5;

  ngOnInit(): void {
    this.cargarHistorial();
  }

  cargarHistorial(): void {
    this.cargando = true;
    this.errorCarga = false;
    this.cdr.markForCheck();

    const idUsuario = this.authService.user()?.id_usuario;
    if (idUsuario) {
      this.ejecutarCargaHistorial(idUsuario);
      return;
    }

    this.authService.checkStatus().subscribe({
      next: () => {
        const resolvedId = this.authService.user()?.id_usuario;
        if (!resolvedId) {
          this.ngZone.run(() => {
            this.errorCarga = true;
            this.cargando = false;
            this.cdr.markForCheck();
          });
          return;
        }
        this.ejecutarCargaHistorial(resolvedId);
      },
      error: () => {
        this.ngZone.run(() => {
          this.errorCarga = true;
          this.cargando = false;
          this.cdr.markForCheck();
        });
      },
    });
  }

  private ejecutarCargaHistorial(idUsuario: string): void {
    this.userService.obtenerHistorialReservas(idUsuario).subscribe({
      next: (resp) => {
        this.ngZone.run(() => {
          this.datosReservas = Array.isArray(resp?.data) ? resp.data : [];
          this.proximosPartidos = this.extraerProximosPartidos(
            this.datosReservas,
          );
          this.updatePagination();

          this.cargando = false;
          this.cdr.markForCheck();
        });
      },
      error: (err) => {
        this.ngZone.run(() => {
          this.errorCarga = true;
          this.cargando = false;
          this.cdr.markForCheck();
          this.toastr.error(err);
        });
      },
    });
  }

  // lógica de paginación para <app-table>
  handlePageChange(page: number): void {
    this.currentPage = page;
    this.updatePagination();
  }

  updatePagination(): void {
    const startIndex = (this.currentPage - 1) * this.pageSize;
    this.paginatedReservas = this.datosReservas.slice(
      startIndex,
      startIndex + this.pageSize,
    );
    this.cdr.markForCheck();
  }

  // lógica de Horario
  calcularHoraTermino(horaInicio?: string): string {
    if (!horaInicio) return '';
    const partes = horaInicio.split(':');
    let horas = parseInt(partes[0], 10);
    horas = (horas + 1) % 24;
    const horaFormateada = horas.toString().padStart(2, '0');
    return `${horaFormateada}:${partes[1]}`;
  }

  puedeGestionarResena(row: any): boolean {
    const estado = String(row.estado ?? '').trim().toLowerCase();
    if (estado !== 'pagada' && estado !== 'confirmada') {
      return false;
    }

    if (!row.fecha || !row.horaInicio) return false;

    return isBusinessDateTimePast(row.fecha, row.horaInicio);
  }

  gestionarPopupResena(row: any) {
    this.reservaSeleccionadaId = row.id_reserva;
    this.servicioSeleccionadoId = row.id_servicio;

    if (row.tieneResena) {
      this.userService.obtenerResenaById(row.id_reserva.toString()).subscribe({
        next: (resp) => this.abrirModal(resp.data),
        error: (err) => this.toastr.error(err),
      });
    } else {
      this.abrirModal(null);
    }
  }

  abrirModal(datos: any) {
    this.datosResenaActual = datos;
    this.modalResenaAbierto = true;
  }

  cerrarModalResena() {
    this.modalResenaAbierto = false;
    this.datosResenaActual = null;
  }

  alGuardarResena(respuesta: any) {
    this.cerrarModalResena();
    this.cargarHistorial();
  }

  private extraerProximosPartidos(reservas: any[]): any[] {
    if (!reservas || reservas.length === 0) return [];
    const ahora = new Date();
    const reservasFuturas = reservas.filter((res) => {
      const estado = String(res.estado ?? '').trim().toLowerCase();
      if (estado === 'cancelada' || estado === 'cancelado') return false;
      if (!res.fecha || !res.horaInicio) return false;
      return !isBusinessDateTimePast(res.fecha, res.horaInicio, ahora);
    });

    reservasFuturas.sort((a, b) => {
      const dateCompare = normalizeBusinessDate(a.fecha).localeCompare(
        normalizeBusinessDate(b.fecha),
      );
      if (dateCompare !== 0) return dateCompare;
      return normalizeWallTime(a.horaInicio).localeCompare(
        normalizeWallTime(b.horaInicio),
      );
    });

    return reservasFuturas.slice(0, 2);
  }
}
