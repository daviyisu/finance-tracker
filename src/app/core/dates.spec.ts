import { dayHeading, dayLabel, fromLocalIso, monthRange, monthTitle, timeLabel, toLocalIso, weekRange } from './dates';

describe('dates', () => {
  const now = new Date(2026, 9, 19, 10, 12, 0); // lunes 19 oct 2026

  it('ida y vuelta de fechas locales', () => {
    expect(toLocalIso(now)).toBe('2026-10-19T10:12:00');
    expect(fromLocalIso('2026-10-19T10:12:00').getTime()).toBe(now.getTime());
  });

  it('mes natural', () => {
    expect(monthRange(now)).toEqual({ start: '2026-10-01T00:00:00', end: '2026-11-01T00:00:00' });
  });

  it('mes que empieza a mitad de mes', () => {
    expect(monthRange(now, 25)).toEqual({ start: '2026-09-25T00:00:00', end: '2026-10-25T00:00:00' });
    expect(monthRange(new Date(2026, 11, 28), 25)).toEqual({ start: '2026-12-25T00:00:00', end: '2027-01-25T00:00:00' });
    expect(monthTitle(now, 25)).toBe('Septiembre 2026');
    expect(monthTitle(now)).toBe('Octubre 2026');
  });

  it('semana de lunes a domingo', () => {
    expect(weekRange(now)).toEqual({ start: '2026-10-19T00:00:00', end: '2026-10-26T00:00:00' });
    expect(weekRange(new Date(2026, 9, 18, 23))).toEqual({ start: '2026-10-12T00:00:00', end: '2026-10-19T00:00:00' });
  });

  it('etiquetas de día y hora', () => {
    expect(dayLabel('2026-10-19T08:00:00', now)).toBe('Hoy');
    expect(dayLabel('2026-10-18T23:59:00', now)).toBe('Ayer');
    expect(dayLabel('2026-10-15T08:00:00', now)).toBe('15 oct');
    expect(dayLabel('2025-12-31T08:00:00', now)).toBe('31 dic 2025');
    expect(timeLabel('2026-10-19T09:05:00')).toBe('09:05');
  });

  it('cabeceras del historial', () => {
    expect(dayHeading('2026-10-19T08:00:00', now)).toBe('Hoy');
    expect(dayHeading('2026-10-17T08:00:00', now)).toBe('Sábado, 17 oct');
    expect(dayHeading('2025-12-31T08:00:00', now)).toBe('Miércoles, 31 dic 2025');
  });
});
