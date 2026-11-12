import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { catchError, map, Observable, retry, throwError } from 'rxjs';
import { ComentarioDetalle, ComentariosResponse } from '../interfaces/comments';
import { environment } from 'src/environments/environment';

const baseUrl = environment.baseUrl;
@Injectable({
  providedIn: 'root',
})
export class ComentariosService {
  private http = inject(HttpClient);

  getComentariosByUsuario(idUsuario: string): Observable<ComentarioDetalle[]> {
    if (!idUsuario?.trim()) {
      return throwError(() => new Error('El id de usuario es requerido'));
    }

    return this.http
      .get<ComentariosResponse>(
        `${baseUrl}/user/get-user-comments/${idUsuario}`,
      )
      .pipe(
        map((resp) => resp.comentarios ?? []),
        retry({ count: 2, delay: 1000 }),
        catchError((error: HttpErrorResponse) => {
          console.error('[ComentariosService] getComentariosByUsuario:', error);
          return throwError(
            () =>
              new Error(
                error.status === 0
                  ? 'Sin conexión al servidor'
                  : (error.error?.msg ?? 'Error al obtener los comentarios'),
              ),
          );
        }),
      );
  }
}
