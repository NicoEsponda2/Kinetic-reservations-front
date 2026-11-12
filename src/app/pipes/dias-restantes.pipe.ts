import { Pipe, PipeTransform } from '@angular/core';
import { getBusinessCalendarDayDiff } from '@shared/utils/business-time.util';

@Pipe({
  name: 'diasRestantes',
  standalone: true,
})
export class DiasRestantesPipe implements PipeTransform {
  transform(fechaStr?: string | Date | null): string {
    if (!fechaStr) return '';

    const dias = getBusinessCalendarDayDiff(fechaStr);
    if (dias === null) return '';

    // Retornamos el texto formateado
    if (dias === 0) return 'Hoy';
    if (dias === 1) return 'Mañana';
    if (dias > 1) return `En ${dias} Días`;

    // Por si acaso la fecha ya pasó
    if (dias === -1) return 'Ayer';
    return `Hace ${Math.abs(dias)} Días`;
  }
}