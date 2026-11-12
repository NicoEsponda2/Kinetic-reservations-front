import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'sportIcon',
  standalone: true,
})
export class SportIconPipe implements PipeTransform {
  transform(servicio?: string | null): string {
    if (!servicio) return 'sports';

    const s = servicio.toLowerCase();

    if (s.includes('tenis') || s.includes('padel') || s.includes('pádel'))
      return 'sports_tennis';
    if (s.includes('futbol') || s.includes('fútbol')) return 'sports_soccer';
    if (s.includes('hockey')) return 'sports_hockey';
    if (s.includes('basquet') || s.includes('básquet') || s.includes('basket'))
      return 'sports_basketball';
    if (s.includes('quincho')) return 'outdoor_grill';
    if (s.includes('estacionamiento')) return 'local_parking';
    if (s.includes('juego') || s.includes('infantil')) return 'attractions';

    return 'sports';
  }
}
