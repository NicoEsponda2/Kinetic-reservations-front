/**
 * Utilidades para trabajar con fecha y hora comercial de Kinetic en America/Santiago.
 *
 * Evita desplazamientos de día producidos por `new Date('YYYY-MM-DD')` (que JS
 * interpreta como medianoche UTC y se convierte en el día anterior en UTC-3/UTC-4).
 */

export const BUSINESS_TIME_ZONE = 'America/Santiago';

const businessDateTimeFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: BUSINESS_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

const getPart = (
  parts: Intl.DateTimeFormatPart[],
  type: Intl.DateTimeFormatPartTypes,
): string => parts.find((part) => part.type === type)?.value ?? '';

/**
 * Obtiene la fecha (`YYYY-MM-DD`) y hora (`HH:mm:ss`) en la zona horaria comercial de Chile.
 */
export function getBusinessDateTime(now: Date = new Date()): {
  date: string;
  time: string;
} {
  const parts = businessDateTimeFormatter.formatToParts(now);
  const year = getPart(parts, 'year');
  const month = getPart(parts, 'month');
  const day = getPart(parts, 'day');
  const hour = getPart(parts, 'hour');
  const minute = getPart(parts, 'minute');
  const second = getPart(parts, 'second');

  return {
    date: `${year}-${month}-${day}`,
    time: `${hour}:${minute}:${second}`,
  };
}

/**
 * Normaliza una fecha de calendario a `YYYY-MM-DD` sin aplicar conversión UTC sobre cadenas ISO de solo fecha.
 */
export function normalizeBusinessDate(date: string | Date): string {
  if (date instanceof Date) {
    return getBusinessDateTime(date).date;
  }
  return String(date ?? '').trim().split('T')[0];
}

/**
 * Normaliza una hora de pared (`HH:mm` o `HH:mm:ss`) al formato `HH:mm:ss`.
 */
export function normalizeWallTime(time: string): string {
  const [hour = '00', minute = '00', second = '00'] = String(time ?? '')
    .trim()
    .split(':');
  return `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}:${second.padStart(2, '0')}`;
}

/**
 * Indica si la fecha y hora de una reserva ya pasaron respecto al reloj de America/Santiago.
 */
export function isBusinessDateTimePast(
  date: string | Date,
  time: string,
  now: Date = new Date(),
): boolean {
  const current = getBusinessDateTime(now);
  const candidateDate = normalizeBusinessDate(date);
  if (!candidateDate) return false;

  if (candidateDate !== current.date) {
    return candidateDate < current.date;
  }

  return normalizeWallTime(time) < current.time;
}

/**
 * Calcula la diferencia entera en días calendario entre una fecha objetivo y hoy en America/Santiago.
 */
export function getBusinessCalendarDayDiff(
  targetDate: string | Date,
  now: Date = new Date(),
): number | null {
  const normalizedTarget = normalizeBusinessDate(targetDate);
  const targetMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalizedTarget);
  if (!targetMatch) return null;

  const currentDate = getBusinessDateTime(now).date;
  const currentMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(currentDate);
  if (!currentMatch) return null;

  const targetUtc = Date.UTC(
    Number(targetMatch[1]),
    Number(targetMatch[2]) - 1,
    Number(targetMatch[3]),
  );
  const currentUtc = Date.UTC(
    Number(currentMatch[1]),
    Number(currentMatch[2]) - 1,
    Number(currentMatch[3]),
  );

  return Math.round((targetUtc - currentUtc) / 86_400_000);
}
