import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from 'src/environments/environment';
import { catchError, map, Observable, of } from 'rxjs';

import {
  ReservaServicio,
  HorarioBloque,
  Comentarios,
} from '@user-front/interfaces/services';

const baseUrl = environment.baseUrl;

@Injectable({ providedIn: 'root' })
export class GlobalService {
  private http = inject(HttpClient);

  buscarNombreServicios(): Observable<ReservaServicio[]> {
    return this.http
      .get<{ servicios: ReservaServicio[] }>(`${baseUrl}/sport/get-sports-names`)
      .pipe(
        map((resp) => resp.servicios ?? []),
        catchError(() => of([])),
      );
  }

  obtenerHorariosDisponibles(
    id_servicio: string,
    fecha: string,
    id_pista: number,
  ): Observable<HorarioBloque[]> {
    return this.http
      .get<{
        ok: boolean;
        horarios: HorarioBloque[];
      }>(`${baseUrl}/sports-schedules/get-available-times`, {
        params: {
          id_servicio,
          fecha,
          id_pista,
        },
      })
      .pipe(
        map((resp) => resp.horarios ?? []),
        catchError(() => of([])),
      );
  }

  obtenerComentariosInicio(): Observable<Comentarios[]> {
    return this.http
      .get<{
        comentarios: Comentarios[];
      }>(`${baseUrl}/comments/home-page`)
      .pipe(
        map((resp) => resp.comentarios ?? []),
        catchError(() => of([])),
      );
  }
}
