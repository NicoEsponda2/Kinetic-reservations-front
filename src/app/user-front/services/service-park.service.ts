import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from 'src/environments/environment';
import { catchError, map, Observable, of } from 'rxjs';

import { Servicio } from '@user-front/interfaces/services';

const baseUrl = environment.baseUrl;

@Injectable({ providedIn: 'root' })
export class ServicesParkService {
  private http = inject(HttpClient);

  obtenerServicios(): Observable<Servicio[]> {
    return this.http
      .get<{ data: { servicios: Servicio[] } }>(`${baseUrl}/sport/home`)
      .pipe(
        map((resp) => resp.data?.servicios ?? []),
        catchError(() => of([])),
      );
  }
}
