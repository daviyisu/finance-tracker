import { Injectable, computed, inject, signal } from '@angular/core';

import { DatabaseService } from './database.service';
import { DateRange, dayRange, monthRange, toLocalIso, weekRange } from './dates';
import { Category, CurrencyCode, DEFAULT_SETTINGS, Movement, MovementType, NewMovement, Settings } from './models';

interface CategoryRow {
  id: string;
  name: string;
  type: MovementType;
  icon: string;
  color: Category['color'];
  sort_order: number;
}

interface MovementRow {
  id: string;
  type: MovementType;
  amount_cents: number;
  category_id: string;
  occurred_at: string;
  note: string | null;
  created_at: string;
}

export interface BudgetStatus {
  categoryId: string | null;
  limitCents: number;
  spentCents: number;
  /** Porcentaje gastado, sin límite superior (puede pasar de 100). */
  percent: number;
}

export interface HomeSummary {
  monthExpenseCents: number;
  monthIncomeCents: number;
  todayExpenseCents: number;
  weekExpenseCents: number;
  /** Presupuesto global del mes, si existe. */
  globalBudget: BudgetStatus | null;
  /** El presupuesto de categoría más apurado a partir del 80 %, si lo hay. */
  budgetAlert: BudgetStatus | null;
  recent: Movement[];
}

const ALERT_PERCENT = 80;

const toMovement = (r: MovementRow): Movement => ({
  id: r.id,
  type: r.type,
  amountCents: Number(r.amount_cents),
  categoryId: r.category_id,
  occurredAt: r.occurred_at,
  note: r.note,
  createdAt: r.created_at,
});

const toBudgetStatus = (categoryId: string | null, limitCents: number, spentCents: number): BudgetStatus => ({
  categoryId,
  limitCents,
  spentCents,
  percent: limitCents > 0 ? Math.round((spentCents / limitCents) * 100) : 0,
});

/** Estado y operaciones de datos de la app. */
@Injectable({ providedIn: 'root' })
export class FinanceService {
  private readonly db = inject(DatabaseService);

  readonly categories = signal<Category[]>([]);
  readonly settings = signal<Settings>(DEFAULT_SETTINGS);
  /** Cambia en cada escritura; las pantallas lo usan para recargar. */
  readonly revision = signal(0);

  readonly categoriesById = computed(() => new Map(this.categories().map((c) => [c.id, c])));

  private loaded?: Promise<void>;

  /** Carga categorías y ajustes una sola vez. */
  ready(): Promise<void> {
    this.loaded ??= this.load().catch((error) => {
      this.loaded = undefined;
      throw error;
    });
    return this.loaded;
  }

  categoriesOf(type: MovementType): Category[] {
    return this.categories()
      .filter((c) => c.type === type)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }

  async addMovement(input: NewMovement): Promise<Movement> {
    const movement: Movement = {
      ...input,
      id: crypto.randomUUID(),
      note: input.note?.trim() || null,
      createdAt: toLocalIso(new Date()),
    };
    await this.db.run(
      `INSERT INTO movements (id, type, amount_cents, category_id, occurred_at, note, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [movement.id, movement.type, movement.amountCents, movement.categoryId, movement.occurredAt, movement.note, movement.createdAt],
    );
    this.bump();
    return movement;
  }

  async deleteMovement(id: string): Promise<void> {
    await this.db.run('DELETE FROM movements WHERE id = ?', [id]);
    this.bump();
  }

  async homeSummary(now = new Date()): Promise<HomeSummary> {
    await this.ready();
    const month = monthRange(now, this.settings().monthStartDay);

    const [monthTotals, today, week, budgets, recent] = await Promise.all([
      this.totalsByType(month),
      this.totalsByType(dayRange(now)),
      this.totalsByType(weekRange(now)),
      this.budgetStatuses(month),
      this.db.query<MovementRow>('SELECT * FROM movements ORDER BY occurred_at DESC, created_at DESC LIMIT 5'),
    ]);

    const global = budgets.find((b) => b.categoryId === null) ?? null;
    const alert =
      budgets
        .filter((b) => b.categoryId !== null && b.percent >= ALERT_PERCENT)
        .sort((a, b) => b.percent - a.percent)[0] ?? null;

    return {
      monthExpenseCents: monthTotals.expense,
      monthIncomeCents: monthTotals.income,
      todayExpenseCents: today.expense,
      weekExpenseCents: week.expense,
      globalBudget: global ? toBudgetStatus(null, global.limitCents, monthTotals.expense) : null,
      budgetAlert: alert,
      recent: recent.map(toMovement),
    };
  }

  private async totalsByType(range: DateRange): Promise<Record<MovementType, number>> {
    const rows = await this.db.query<{ type: MovementType; total: number }>(
      `SELECT type, SUM(amount_cents) AS total FROM movements
       WHERE occurred_at >= ? AND occurred_at < ? GROUP BY type`,
      [range.start, range.end],
    );
    const totals: Record<MovementType, number> = { expense: 0, income: 0 };
    for (const row of rows) totals[row.type] = Number(row.total ?? 0);
    return totals;
  }

  private async budgetStatuses(range: DateRange): Promise<BudgetStatus[]> {
    const rows = await this.db.query<{ category_id: string | null; amount_cents: number; spent: number }>(
      `SELECT b.category_id, b.amount_cents, COALESCE(SUM(m.amount_cents), 0) AS spent
       FROM budgets b
       LEFT JOIN movements m
         ON m.category_id = b.category_id AND m.type = 'expense'
        AND m.occurred_at >= ? AND m.occurred_at < ?
       GROUP BY b.id`,
      [range.start, range.end],
    );
    return rows.map((r) => toBudgetStatus(r.category_id, Number(r.amount_cents), Number(r.spent)));
  }

  private async load(): Promise<void> {
    const [categories, settings] = await Promise.all([
      this.db.query<CategoryRow>('SELECT * FROM categories WHERE archived = 0 ORDER BY type, sort_order'),
      this.db.query<{ key: string; value: string }>('SELECT key, value FROM settings'),
    ]);
    this.categories.set(
      categories.map((r) => ({ id: r.id, name: r.name, type: r.type, icon: r.icon, color: r.color, sortOrder: Number(r.sort_order) })),
    );
    const map = new Map(settings.map((s) => [s.key, s.value]));
    this.settings.set({
      currency: (map.get('currency') as CurrencyCode) ?? DEFAULT_SETTINGS.currency,
      monthStartDay: Number(map.get('monthStartDay') ?? DEFAULT_SETTINGS.monthStartDay),
    });
  }

  private bump(): void {
    this.revision.update((n) => n + 1);
  }
}
