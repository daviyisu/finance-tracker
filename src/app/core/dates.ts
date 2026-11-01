/** Intervalo [start, end) en fechas locales `YYYY-MM-DDTHH:mm:ss`. */
export interface DateRange {
  start: string;
  end: string;
}

const MONTHS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];
const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

const pad = (n: number) => String(n).padStart(2, '0');

/** Fecha local sin zona horaria, ordenable como texto. */
export function toLocalIso(date: Date): string {
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  );
}

export function fromLocalIso(value: string): Date {
  const [d, t = '00:00:00'] = value.split('T');
  const [y, m, day] = d.split('-').map(Number);
  const [h, min, s] = t.split(':').map(Number);
  return new Date(y, m - 1, day, h || 0, min || 0, s || 0);
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function range(start: Date, end: Date): DateRange {
  return { start: toLocalIso(start), end: toLocalIso(end) };
}

export function dayRange(now: Date): DateRange {
  const start = startOfDay(now);
  return range(start, addDays(start, 1));
}

/** Semana de lunes a domingo. */
export function weekRange(now: Date): DateRange {
  const start = addDays(startOfDay(now), -((now.getDay() + 6) % 7));
  return range(start, addDays(start, 7));
}

/** Periodo mensual que contiene `now`, empezando el día `startDay` (1-28). */
export function monthRange(now: Date, startDay = 1): DateRange {
  const day = Math.min(Math.max(Math.trunc(startDay), 1), 28);
  const monthOffset = now.getDate() >= day ? 0 : -1;
  const start = new Date(now.getFullYear(), now.getMonth() + monthOffset, day);
  const end = new Date(start.getFullYear(), start.getMonth() + 1, day);
  return range(start, end);
}

/** "Octubre 2026" (el mes en que empieza el periodo). */
export function monthTitle(now: Date, startDay = 1): string {
  const start = fromLocalIso(monthRange(now, startDay).start);
  const name = MONTHS[start.getMonth()];
  return `${name[0].toUpperCase()}${name.slice(1)} ${start.getFullYear()}`;
}

/** Nombre del mes en minúscula: "septiembre". */
export function monthName(date: Date): string {
  return MONTHS[date.getMonth()];
}

/** "Hoy", "Ayer" o "15 oct" (con año si no es el actual). */
export function dayLabel(value: string | Date, now: Date): string {
  const date = typeof value === 'string' ? fromLocalIso(value) : value;
  const diff = Math.round((startOfDay(now).getTime() - startOfDay(date).getTime()) / 86_400_000);
  if (diff === 0) return 'Hoy';
  if (diff === 1) return 'Ayer';
  const base = `${date.getDate()} ${MONTHS_SHORT[date.getMonth()]}`;
  return date.getFullYear() === now.getFullYear() ? base : `${base} ${date.getFullYear()}`;
}

/** "10:12" */
export function timeLabel(value: string): string {
  const date = fromLocalIso(value);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

/** Cabecera de un día en el historial: "Hoy", "Ayer", "Sábado, 17 oct" (+ año si no es el actual). */
export function dayHeading(value: string, now: Date): string {
  const label = dayLabel(value, now);
  if (label === 'Hoy' || label === 'Ayer') return label;
  const weekday = WEEKDAYS[fromLocalIso(value).getDay()];
  return `${weekday[0].toUpperCase()}${weekday.slice(1)}, ${label}`;
}
