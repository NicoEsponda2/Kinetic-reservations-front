import { Pipe, PipeTransform } from '@angular/core';
import { formatCloudinaryImageUrl } from './cloudinary-image.pipe';

@Pipe({
  name: 'sportImage',
})
export class SportImagePipe implements PipeTransform {
  private readonly defaultImg =
    'https://res.cloudinary.com/dhwoq5fdq/image/upload/f_auto,q_auto,w_800/v1792671371/KINETIC-RESERVATIONS/servicios/zjfxkopmsbfbvxda7xmj.jpg';

  transform(servicio?: string | null): string {
    if (!servicio) return this.defaultImg;

    if (servicio.startsWith('http://') || servicio.startsWith('https://')) {
      return formatCloudinaryImageUrl(servicio);
    }

    const s = servicio.toLowerCase();

    if (s.includes('tenis') || s.includes('padel') || s.includes('pádel')) {
      return 'https://res.cloudinary.com/dhwoq5fdq/image/upload/f_auto,q_auto,w_800/v1792671371/KINETIC-RESERVATIONS/servicios/zjfxkopmsbfbvxda7xmj.jpg';
    }
    if (s.includes('futbol') || s.includes('fútbol')) {
      return 'https://res.cloudinary.com/dhwoq5fdq/image/upload/f_auto,q_auto,w_800/v1792671369/KINETIC-RESERVATIONS/servicios/vy2b3irwwgcdi552ifpc.jpg';
    }
    if (s.includes('hockey')) {
      return 'https://res.cloudinary.com/dhwoq5fdq/image/upload/f_auto,q_auto,w_800/v1792671369/KINETIC-RESERVATIONS/servicios/xyql1m3n6rve6mrub9rw.jpg';
    }

    return this.defaultImg;
  }
}
