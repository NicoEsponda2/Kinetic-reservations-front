import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from 'src/environments/environment';
import { catchError, map, Observable, of, tap, throwError } from 'rxjs';

const baseUrl = environment.baseUrl;

@Injectable({ providedIn: 'root' })
export class UserService {
  private http = inject(HttpClient);

  datosDashboardUsuario(id_usuario: string): Observable<any> {
    return this.http
      .get<any>(`${baseUrl}/user/get-dashboard-data/${id_usuario}`)
      .pipe(
        map((resp) => resp),
        catchError((error) => {
          return this.handleError(error.error.msg || 'Error al obtener datos');
        }),
      );
  }

  editarPerfilUsuario(
    id_usuario: string,
    datosFormulario: any,
  ): Observable<any> {
    return this.http
      .put<any>(
        `${baseUrl}/user/update-user/${id_usuario}`,
        datosFormulario,
      )
      .pipe(
        map((resp) => resp),
        catchError((error) => {
          return this.handleError(error.error.msg || 'Error al editar perfil');
        }),
      );
  }

  obtenerHistorialReservas(id_user: string): Observable<any> {
    return this.http
      .get<any>(`${baseUrl}/user/booking-history/${id_user}`)
      .pipe(
        map((resp) => resp),
        catchError((error) => {
          return this.handleError(
            error.error.msg || 'Error al obtener las reservas',
          );
        }),
      );
  }

  obtenerResenaById(id_resena: string): Observable<any> {
    return this.http
      .get<any>(`${baseUrl}/user/get-comment/${id_resena}`)
      .pipe(
        map((resp) => resp),
        catchError((error) => {
          return this.handleError(
            error.error?.msg || 'Error al obtener la reseña',
          );
        }),
      );
  }

  crearResena(payload: any): Observable<any> {
    return this.http
      .post<any>(`${baseUrl}/comments/create-review`, payload)
      .pipe(
        map((resp) => resp),
        catchError((error) => {
          return this.handleError(
            error?.error?.msg ||
              error?.error?.message ||
              'Error al ingresar el comentario',
          );
        }),
      );
  }

  actualizarResena(payload: any): Observable<any> {
    return this.http
      .put<any>(
        `${baseUrl}/comments/update-review/${payload.id_reserva}`,
        payload,
      )
      .pipe(
        map((resp) => resp),
        catchError((error) => {
          return this.handleError(
            error?.error?.msg ||
              error?.error?.message ||
              'Error al actualizar el comentario',
          );
        }),
      );
  }

  handleError(error: string) {
    return throwError(() => error);
  }
}
