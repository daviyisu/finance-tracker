import { CATEGORY_COLORS } from './categories';
import { dayLabel, timeLabel } from './dates';
import { formatSignedMoney } from './money';
import { Category, CurrencyCode, Movement } from './models';

export interface MovementRowView {
  id: string;
  name: string;
  icon: string;
  fg: string;
  bg: string;
  subtitle: string;
  amount: string;
  income: boolean;
}

/**
 * Datos de una fila de movimiento. Con `withDay` el subtítulo incluye el día
 * ("Hoy, 10:12"); sin él, solo la hora (para listas ya agrupadas por día).
 */
export function movementRow(
  m: Movement,
  categories: Map<string, Category>,
  currency: CurrencyCode,
  now: Date,
  withDay = true,
): MovementRowView {
  const category = categories.get(m.categoryId);
  const colors = CATEGORY_COLORS[category?.color ?? 'slate'];
  let when = timeLabel(m.occurredAt);
  if (withDay) {
    const day = dayLabel(m.occurredAt, now);
    when = day === 'Hoy' || day === 'Ayer' ? `${day}, ${when}` : day;
  }
  const income = m.type === 'income';
  return {
    id: m.id,
    name: category?.name ?? 'Sin categoría',
    icon: category?.icon ?? 'ellipsis-horizontal',
    fg: colors.fg,
    bg: colors.bg,
    subtitle: m.note ? `${when} · ${m.note}` : when,
    amount: formatSignedMoney(income ? m.amountCents : -m.amountCents, currency),
    income,
  };
}
