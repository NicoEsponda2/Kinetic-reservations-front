import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from 'src/environments/environment';
import {
  catchError,
  forkJoin,
  map,
  Observable,
  of,
  throwError,
} from 'rxjs';

import { Servicio } from '@user-front/interfaces/services';

const baseUrl = environment.baseUrl;
const DIAS_CORTOS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

export interface AdminUser {
  id_usuario?: string;
  nombre: string;
  apellido?: string;
  telefono?: string;
  email: string;
  roles: string[];
  is_active: boolean;
  imagen?: string;
  created_at?: string;
  cantidad_reservas?: number;
  total_gastado?: number;
}

export interface AdminUsersResponse {
  usuarios: AdminUser[];
}

export interface AdminKpiMetrics {
  ingresosTotales: number;
  ingresosMesActual: number;
  crecimientoIngresos: number;
  tasaOcupacion: number;
  crecimientoOcupacion: number;
  reservasActivas: number;
  crecimientoReservas: number;
  pagosPendientes: number;
}

export interface DailyTrendPoint {
  fecha: string;
  etiqueta: string;
  completadas: number;
  canceladas: number;
  ingresos: number;
}

export interface AdminCourtStatus {
  id_pista: number;
  nombre: string;
  deporte: string;
  precioHora: number;
  reservasHoy: number;
  reservasTotales: number;
  estado: 'OCUPADA' | 'LIBRE';
}

export interface AdminBookingItem {
  id: number;
  fecha: string;
  hora: string;
  instalacion: string;
  servicio: string;
  pista: string;
  usuario: string;
  emailUsuario: string;
  avatarUsuario: string;
  monto: number;
  estadoReserva: string;
  estadoPago: 'Pagado' | 'Pendiente' | 'Cancelado';
}

export interface AdminDashboardData {
  kpis: AdminKpiMetrics;
  tendencia: {
    ultimos7Dias: DailyTrendPoint[];
    ultimos30Dias: DailyTrendPoint[];
  };
  estadoPistas: AdminCourtStatus[];
  proximoCierre: string;
  proximasReservas: AdminBookingItem[];
}

@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly http = inject(HttpClient);

  obtenerDatosDashboard(): Observable<AdminDashboardData> {
    return forkJoin({
      dashboardResp: this.http.get<{ ok: boolean; data: AdminDashboardData }>(
        `${baseUrl}/admin/dashboard`,
        { headers: { 'x-skip-cache': 'true' } },
      ),
      reservasResp: this.http
        .get<any>(`${baseUrl}/bookings/admin/bookings-history`, {
          headers: { 'x-skip-cache': 'true' },
        })
        .pipe(catchError(() => of(null))),
    }).pipe(
      map(({ dashboardResp, reservasResp }) => {
        const data = dashboardResp.data;
        if (Array.isArray(reservasResp?.data)) {
          return this.syncRealCourtStatus(data, reservasResp.data);
        }
        return data;
      }),
      catchError(() => this.buildDashboardFromExistingEndpoints()),
    );
  }

  buscarUsuarios(): Observable<AdminUsersResponse> {
    return this.withErrorHandling(
      this.http.get<AdminUsersResponse>(`${baseUrl}/auth/admin/find-users`),
      'Error al obtener los usuarios',
    );
  }

  actualizarUsuario(
    id_usuario: string,
    data: { roles?: string[]; is_active?: boolean },
  ): Observable<{ ok: boolean; msg: string; usuario: AdminUser }> {
    return this.withErrorHandling(
      this.http.put<{ ok: boolean; msg: string; usuario: AdminUser }>(
        `${baseUrl}/admin/usuarios/${id_usuario}`,
        data,
      ),
      'Error al actualizar el usuario',
    );
  }

  obtenerServicios(): Observable<Servicio[]> {
    return this.withErrorHandling(
      this.http
        .get<{ data: { servicios: Servicio[] } }>(
          `${baseUrl}/sport/admin/find-sports`,
        )
        .pipe(map((resp) => resp.data.servicios)),
      'Error al obtener los servicios',
    );
  }

  obtenerServicioById(id: string): Observable<Servicio | null> {
    return this.http.get<Servicio>(`${baseUrl}/sport/${id}`).pipe(
      catchError(() => of(null)),
    );
  }

  actualizarServicio(
    id: string,
    servicio: FormData | Partial<Servicio>,
  ): Observable<string> {
    return this.withErrorHandling(
      this.http
        .put<{ msg: string }>(
          `${baseUrl}/sport/admin/update-sport/${id}`,
          servicio,
        )
        .pipe(map((resp) => resp.msg)),
      'Error al actualizar el servicio',
    );
  }

  crearServicio(servicio: FormData | Partial<Servicio>): Observable<string> {
    return this.withErrorHandling(
      this.http
        .post<{ msg: string }>(`${baseUrl}/sport/admin/create-sport`, servicio)
        .pipe(map((resp) => resp.msg)),
      'Error al crear el servicio',
    );
  }

  obtenerTodasLasReservas(): Observable<any> {
    return this.withErrorHandling(
      this.http.get<any>(`${baseUrl}/bookings/admin/bookings-history`),
      'Error al obtener reservas',
    );
  }

  editarPista(
    idPista: number,
    data: { nombre: string; precio_hora: number },
  ): Observable<string> {
    return this.withErrorHandling(
      this.http
        .put<{ msg: string }>(`${baseUrl}/admin/update-court/${idPista}`, data)
        .pipe(map((resp) => resp.msg)),
      'Error al editar la pista seleccionada',
    );
  }

  obtenerTodosLosComentarios(): Observable<any> {
    return this.withErrorHandling(
      this.http.get<any>(`${baseUrl}/comments/admin/find-comments`),
      'Error al obtener comentarios',
    );
  }

  cambiarEstadoComentario(
    id_comentario: number,
    is_active: number,
  ): Observable<any> {
    return this.withErrorHandling(
      this.http.put<any>(
        `${baseUrl}/admin/comentarios/${id_comentario}/estado`,
        { is_active },
      ),
      'Error al cambiar estado del comentario',
    );
  }

  /**
   * Sincroniza el estado real de las canchas (OCUPADA / LIBRE y turnos de hoy)
   * cruzando las pistas con las reservas reales del día actual en horario de Chile (America/Santiago).
   */
  private syncRealCourtStatus(
    dashboard: AdminDashboardData,
    reservasRaw: any[],
  ): AdminDashboardData {
    if (!dashboard?.estadoPistas?.length) {
      return dashboard;
    }

    const { date: hoyIso, minutes: ahoraMinutos } =
      this.getChileBusinessDateTime();
    const statsById = new Map<
      number,
      {
        hoy: number;
        totales: number;
        ocupadaAhora: boolean;
        turnosVigentesHoy: number;
      }
    >();
    const statsByNombre = new Map<
      string,
      {
        hoy: number;
        totales: number;
        ocupadaAhora: boolean;
        turnosVigentesHoy: number;
      }
    >();

    for (const r of reservasRaw) {
      const estadoLower = String(r.estado || '')
        .toLowerCase()
        .trim();
      const esCancelada =
        estadoLower === 'cancelada' || estadoLower === 'cancelado';
      if (esCancelada) continue;

      const fechaStr = String(r.fecha || '').split('T')[0];
      const inicioMin = this.timeToMinutes(r.hora_inicio);
      const terminoMin = r.hora_termino
        ? this.timeToMinutes(r.hora_termino)
        : inicioMin + 60;
      const esHoy = fechaStr === hoyIso;
      const enCurso =
        esHoy && inicioMin <= ahoraMinutos && ahoraMinutos < terminoMin;
      const vigenteHoy = esHoy && terminoMin > ahoraMinutos;

      const idPista = Number(r.id_pista);
      if (idPista) {
        const prev = statsById.get(idPista) ?? {
          hoy: 0,
          totales: 0,
          ocupadaAhora: false,
          turnosVigentesHoy: 0,
        };
        prev.totales += 1;
        if (esHoy) prev.hoy += 1;
        if (enCurso) prev.ocupadaAhora = true;
        if (vigenteHoy) prev.turnosVigentesHoy += 1;
        statsById.set(idPista, prev);
      }

      const nombreCompuesto = `${r.servicio || ''} (${r.pista || ''})`
        .toLowerCase()
        .trim();
      const prevNombre = statsByNombre.get(nombreCompuesto) ?? {
        hoy: 0,
        totales: 0,
        ocupadaAhora: false,
        turnosVigentesHoy: 0,
      };
      prevNombre.totales += 1;
      if (esHoy) prevNombre.hoy += 1;
      if (enCurso) prevNombre.ocupadaAhora = true;
      if (vigenteHoy) prevNombre.turnosVigentesHoy += 1;
      statsByNombre.set(nombreCompuesto, prevNombre);
    }

    const estadoPistas: AdminCourtStatus[] = dashboard.estadoPistas.map(
      (pista) => {
        const keyNombre = String(pista.nombre || '')
          .toLowerCase()
          .trim();
        const stats = statsById.get(Number(pista.id_pista)) ??
          statsByNombre.get(keyNombre) ?? {
            hoy: 0,
            totales: 0,
            ocupadaAhora: false,
            turnosVigentesHoy: 0,
          };
        const isOcupada = stats.ocupadaAhora || stats.turnosVigentesHoy > 0;

        return {
          ...pista,
          reservasHoy: stats.hoy,
          reservasTotales: stats.totales,
          estado: isOcupada ? 'OCUPADA' : 'LIBRE',
        };
      },
    );

    const totalPistas = estadoPistas.length;
    const ocupadas = estadoPistas.filter((p) => p.estado === 'OCUPADA').length;
    const tasaOcupacion =
      totalPistas > 0
        ? Math.min(100, Math.round((ocupadas / totalPistas) * 100))
        : 0;

    return {
      ...dashboard,
      kpis: {
        ...dashboard.kpis,
        tasaOcupacion,
      },
      estadoPistas,
    };
  }

  /**
   * Respaldo reactivo que construye el modelo del Dashboard usando los endpoints de reservas y deportes
   * en caso de que el contenedor backend aún no haya recargado la ruta /api/admin/dashboard.
   */
  private buildDashboardFromExistingEndpoints(): Observable<AdminDashboardData> {
    return forkJoin({
      reservasResp: this.obtenerTodasLasReservas().pipe(
        catchError(() => of({ data: [] })),
      ),
      servicios: this.obtenerServicios().pipe(catchError(() => of([]))),
    }).pipe(
      map(({ reservasResp, servicios }) => {
        const reservasRaw: any[] = reservasResp?.data || [];
        const { date: hoyIso, minutes: ahoraMinutos } =
          this.getChileBusinessDateTime();
        const hayReservasHoy = reservasRaw.some(
          (r) => String(r.fecha || '').split('T')[0] === hoyIso,
        );
        const fechaRefIso =
          hayReservasHoy || reservasRaw.length === 0
            ? hoyIso
            : String(reservasRaw[0].fecha || '').split('T')[0];

        const [refYear, refMonth, refDay] = String(fechaRefIso)
          .split('-')
          .map(Number);
        const refDate = new Date(
          refYear || new Date().getFullYear(),
          (refMonth || 1) - 1,
          refDay || 1,
          12,
          0,
          0,
        );

        const inicioMesActual = this.formatIsoDate(
          new Date(refDate.getFullYear(), refDate.getMonth(), 1),
        );
        const finMesActual = this.formatIsoDate(
          new Date(refDate.getFullYear(), refDate.getMonth() + 1, 0),
        );
        const inicioMesAnterior = this.formatIsoDate(
          new Date(refDate.getFullYear(), refDate.getMonth() - 1, 1),
        );
        const finMesAnterior = this.formatIsoDate(
          new Date(refDate.getFullYear(), refDate.getMonth(), 0),
        );

        let ingresosTotales = 0;
        let ingresosMesActual = 0;
        let ingresosMesAnterior = 0;
        let reservasActivas = 0;
        let reservasMesActual = 0;
        let reservasMesAnterior = 0;
        let pagosPendientes = 0;

        const conteoPorFecha = new Map<
          string,
          { completadas: number; canceladas: number; ingresos: number }
        >();
        const actividadPorPistaClave = new Map<
          string,
          {
            hoy: number;
            totales: number;
            ocupadaAhora: boolean;
            turnosVigentesHoy: number;
          }
        >();

        for (const r of reservasRaw) {
          const fechaStr = String(r.fecha || '').split('T')[0];
          const estadoLower = String(r.estado || '')
            .toLowerCase()
            .trim();
          const monto = Number(r.precio_cobrado) || 0;

          const esPagada =
            estadoLower === 'pagada' ||
            estadoLower === 'pagado' ||
            estadoLower === 'completada';
          const esCancelada =
            estadoLower === 'cancelada' || estadoLower === 'cancelado';
          const esPendiente = estadoLower === 'pendiente';

          if (esPagada) {
            ingresosTotales += monto;
            reservasActivas += 1;

            if (fechaStr >= inicioMesActual && fechaStr <= finMesActual) {
              ingresosMesActual += monto;
              reservasMesActual += 1;
            } else if (
              fechaStr >= inicioMesAnterior &&
              fechaStr <= finMesAnterior
            ) {
              ingresosMesAnterior += monto;
              reservasMesAnterior += 1;
            }
          } else if (esPendiente) {
            pagosPendientes += 1;
          }

          if (!esCancelada) {
            const clavePista = `${r.servicio || ''}|${r.pista || ''}`;
            const statPista = actividadPorPistaClave.get(clavePista) ?? {
              hoy: 0,
              totales: 0,
              ocupadaAhora: false,
              turnosVigentesHoy: 0,
            };
            statPista.totales += 1;
            if (fechaStr === hoyIso) {
              statPista.hoy += 1;
              const inicioMin = this.timeToMinutes(r.hora_inicio);
              const terminoMin = r.hora_termino
                ? this.timeToMinutes(r.hora_termino)
                : inicioMin + 60;
              if (inicioMin <= ahoraMinutos && ahoraMinutos < terminoMin) {
                statPista.ocupadaAhora = true;
              }
              if (terminoMin > ahoraMinutos) {
                statPista.turnosVigentesHoy += 1;
              }
            }
            actividadPorPistaClave.set(clavePista, statPista);
          }

          const statDia = conteoPorFecha.get(fechaStr) ?? {
            completadas: 0,
            canceladas: 0,
            ingresos: 0,
          };
          if (esPagada) {
            statDia.completadas += 1;
            statDia.ingresos += monto;
          } else if (esCancelada) {
            statDia.canceladas += 1;
          }
          conteoPorFecha.set(fechaStr, statDia);
        }

        const estadoPistas: AdminCourtStatus[] = [];
        let fallbackId = 1;
        for (const srv of servicios) {
          for (const p of srv.pistas || []) {
            if (p.is_active === false) continue;
            const clave = `${srv.nombre}|${p.nombre}`;
            const stats = actividadPorPistaClave.get(clave) ?? {
              hoy: 0,
              totales: 0,
              ocupadaAhora: false,
              turnosVigentesHoy: 0,
            };
            const isOcupada = stats.ocupadaAhora || stats.turnosVigentesHoy > 0;

            estadoPistas.push({
              id_pista: p.id_pista || fallbackId++,
              nombre: `${srv.nombre} (${p.nombre})`,
              deporte: srv.nombre,
              precioHora: Number(p.precio_hora) || 0,
              reservasHoy: stats.hoy,
              reservasTotales: stats.totales,
              estado: isOcupada ? 'OCUPADA' : 'LIBRE',
            });
          }
        }

        const totalPistas = estadoPistas.length;
        const ocupadas = estadoPistas.filter(
          (p) => p.estado === 'OCUPADA',
        ).length;
        const tasaOcupacion =
          totalPistas > 0
            ? Math.min(100, Math.round((ocupadas / totalPistas) * 100))
            : 0;

        const crecimientoIngresos = this.calcGrowth(
          ingresosMesActual,
          ingresosMesAnterior,
        );
        const crecimientoReservas = this.calcGrowth(
          reservasMesActual,
          reservasMesAnterior,
        );

        const start30 = new Date(refDate);
        start30.setDate(refDate.getDate() - 29);
        const start7 = new Date(refDate);
        start7.setDate(refDate.getDate() - 6);

        const proximasReservas: AdminBookingItem[] = reservasRaw
          .slice(0, 6)
          .map((r) => {
            const estadoLower = String(r.estado || '')
              .toLowerCase()
              .trim();
            let estadoPago: 'Pagado' | 'Pendiente' | 'Cancelado' = 'Pendiente';
            if (
              estadoLower === 'pagada' ||
              estadoLower === 'pagado' ||
              estadoLower === 'completada'
            ) {
              estadoPago = 'Pagado';
            } else if (
              estadoLower === 'cancelada' ||
              estadoLower === 'cancelado'
            ) {
              estadoPago = 'Cancelado';
            }

            return {
              id: r.id_reserva,
              fecha: String(r.fecha || '').split('T')[0],
              hora: String(r.hora_inicio || '').slice(0, 5) + ' hrs',
              instalacion: `${r.servicio ?? 'Servicio'} - ${r.pista ?? 'Pista'}`,
              servicio: r.servicio ?? 'Deporte',
              pista: r.pista ?? '',
              usuario: r.usuario_nombre ?? 'Usuario',
              emailUsuario: r.email ?? '',
              avatarUsuario:
                r.avatar ||
                'https://cdn-icons-png.flaticon.com/512/149/149071.png',
              monto: Number(r.precio_cobrado) || 0,
              estadoReserva: r.estado,
              estadoPago,
            };
          });

        return {
          kpis: {
            ingresosTotales,
            ingresosMesActual,
            crecimientoIngresos,
            tasaOcupacion,
            crecimientoOcupacion: crecimientoReservas,
            reservasActivas,
            crecimientoReservas,
            pagosPendientes,
          },
          tendencia: {
            ultimos7Dias: this.buildSeries(start7, 7, conteoPorFecha, true),
            ultimos30Dias: this.buildSeries(
              start30,
              30,
              conteoPorFecha,
              false,
            ),
          },
          estadoPistas,
          proximoCierre: '20:00 - Cierre y Mantenimiento',
          proximasReservas,
        };
      }),
    );
  }

  private calcGrowth(current: number, previous: number): number {
    if (previous > 0) {
      return Math.round(((current - previous) / previous) * 1000) / 10;
    }
    return current > 0 ? 100 : 0;
  }

  private buildSeries(
    startDate: Date,
    daysCount: number,
    byDate: Map<
      string,
      { completadas: number; canceladas: number; ingresos: number }
    >,
    useDayName: boolean,
  ): DailyTrendPoint[] {
    const series: DailyTrendPoint[] = [];
    for (let i = 0; i < daysCount; i++) {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + i);
      const iso = this.formatIsoDate(d);
      const dayName = DIAS_CORTOS[d.getDay()];
      const dayNum = String(d.getDate()).padStart(2, '0');
      const monthNum = String(d.getMonth() + 1).padStart(2, '0');
      const found = byDate.get(iso);

      series.push({
        fecha: iso,
        etiqueta: useDayName ? `${dayName} ${dayNum}` : `${dayNum}/${monthNum}`,
        completadas: found?.completadas ?? 0,
        canceladas: found?.canceladas ?? 0,
        ingresos: found?.ingresos ?? 0,
      });
    }
    return series;
  }

  private getChileBusinessDateTime(now: Date = new Date()): {
    date: string;
    minutes: number;
  } {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Santiago',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(now);

    const get = (t: Intl.DateTimeFormatPartTypes) =>
      parts.find((p) => p.type === t)?.value ?? '00';

    const date = `${get('year')}-${get('month')}-${get('day')}`;
    const minutes = Number(get('hour')) * 60 + Number(get('minute'));
    return { date, minutes };
  }

  private timeToMinutes(timeVal: string | undefined | null): number {
    if (!timeVal) return 0;
    const [h, m] = String(timeVal).trim().split(':');
    return (Number(h) || 0) * 60 + (Number(m) || 0);
  }

  private formatIsoDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  /**
   * Centraliza el manejo de errores HTTP evitando duplicar bloques catchError en cada método.
   */
  private withErrorHandling<T>(
    source$: Observable<T>,
    fallbackMessage: string,
  ): Observable<T> {
    return source$.pipe(
      catchError((error) => {
        const msg =
          error?.error?.msg || error?.error?.message || fallbackMessage;
        return throwError(() => (Array.isArray(msg) ? msg.join('. ') : msg));
      }),
    );
  }
}
