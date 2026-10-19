import { type DateRange, fromLocalIso, monthName, monthRange, monthTitle, toLocalIso, weekRange } from './dates';

export type PeriodKind = 'week' | 'month' | 'year';

export interface Period {
  kind: PeriodKind;
  range: DateRange;
  /** Título largo: "13–19 oct", "Octubre 2026", "2026". */
  label: string;
  /** Etiqueta corta para el eje del gráfico. */
  short: string;
}

const SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

function weekLabel(start: Date): string {
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
  return start.getMonth() === end.getMonth()
    ? `${start.getDate()}–${end.getDate()} ${SHORT[end.getMonth()]}`
    : `${start.getDate()} ${SHORT[start.getMonth()]} – ${end.getDate()} ${SHORT[end.getMonth()]}`;
}

/** Periodo de tipo `kind` que contiene `anchor`. */
export function periodAt(kind: PeriodKind, anchor: Date, startDay = 1): Period {
  if (kind === 'week') {
    const range = weekRange(anchor);
    const start = fromLocalIso(range.start);
    return { kind, range, label: weekLabel(start), short: `${start.getDate()}/${start.getMonth() + 1}` };
  }
  if (kind === 'month') {
    const range = monthRange(anchor, startDay);
    const start = fromLocalIso(range.start);
    return { kind, range, label: monthTitle(anchor, startDay), short: cap(SHORT[start.getMonth()]) };
  }
  const y = anchor.getFullYear();
  return {
    kind,
    range: { start: toLocalIso(new Date(y, 0, 1)), end: toLocalIso(new Date(y + 1, 0, 1)) },
    label: String(y),
    short: String(y),
  };
}

/** Una fecha dentro del periodo `n` posiciones antes (n < 0) o después (n > 0). */
export function shiftPeriod(kind: PeriodKind, anchor: Date, n: number, startDay = 1): Date {
  const start = fromLocalIso(periodAt(kind, anchor, startDay).range.start);
  if (kind === 'week') return new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7 * n);
  if (kind === 'month') return new Date(start.getFullYear(), start.getMonth() + n, start.getDate());
  return new Date(start.getFullYear() + n, 0, 1);
}

/** Texto para "vs. …": "la semana anterior", "septiembre", "2025". */
export function previousLabel(kind: PeriodKind, anchor: Date, startDay = 1): string {
  const prev = shiftPeriod(kind, anchor, -1, startDay);
  if (kind === 'week') return 'la semana anterior';
  if (kind === 'month') return monthName(fromLocalIso(periodAt('month', prev, startDay).range.start));
  return String(prev.getFullYear());
}

/**
 * Barras del gráfico de evolución: 8 semanas o 6 meses terminando en el periodo elegido,
 * o los 12 meses naturales del año elegido.
 */
export function evolutionPeriods(kind: PeriodKind, anchor: Date, startDay = 1): Period[] {
  if (kind === 'year') {
    const y = anchor.getFullYear();
    return SHORT.map((m, i) => ({
      kind: 'month' as const,
      range: { start: toLocalIso(new Date(y, i, 1)), end: toLocalIso(new Date(y, i + 1, 1)) },
      label: `${cap(m)} ${y}`,
      short: cap(m)[0],
    }));
  }
  const count = kind === 'week' ? 8 : 6;
  return Array.from({ length: count }, (_, i) => periodAt(kind, shiftPeriod(kind, anchor, i - count + 1, startDay), startDay));
}
