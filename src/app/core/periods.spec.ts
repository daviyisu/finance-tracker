import { evolutionPeriods, periodAt, previousLabel, shiftPeriod } from './periods';

describe('periods', () => {
  const now = new Date(2026, 9, 19, 10); // lunes 19 oct 2026

  it('semana', () => {
    const p = periodAt('week', now);
    expect(p.label).toBe('19–25 oct');
    expect(p.range).toEqual({ start: '2026-10-19T00:00:00', end: '2026-10-26T00:00:00' });
    expect(periodAt('week', new Date(2026, 8, 30)).label).toBe('28 sep – 4 oct');
    expect(previousLabel('week', now)).toBe('la semana anterior');
  });

  it('mes', () => {
    expect(periodAt('month', now).label).toBe('Octubre 2026');
    expect(periodAt('month', shiftPeriod('month', now, -1)).label).toBe('Septiembre 2026');
    expect(periodAt('month', shiftPeriod('month', now, 3)).label).toBe('Enero 2027');
    expect(previousLabel('month', now)).toBe('septiembre');
    expect(periodAt('month', now, 25).label).toBe('Septiembre 2026');
  });

  it('año', () => {
    expect(periodAt('year', now).range).toEqual({ start: '2026-01-01T00:00:00', end: '2027-01-01T00:00:00' });
    expect(previousLabel('year', now)).toBe('2025');
  });

  it('evolución', () => {
    const months = evolutionPeriods('month', now);
    expect(months.length).toBe(6);
    expect(months.map((m) => m.short).join(',')).toBe('May,Jun,Jul,Ago,Sep,Oct');
    expect(evolutionPeriods('week', now).length).toBe(8);
    expect(evolutionPeriods('week', now)[7].short).toBe('19/10');
    const year = evolutionPeriods('year', now);
    expect(year.length).toBe(12);
    expect(year[11].range).toEqual({ start: '2026-12-01T00:00:00', end: '2027-01-01T00:00:00' });
  });
});
