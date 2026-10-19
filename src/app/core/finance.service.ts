import { Injectable, computed, inject, signal } from '@angular/core';

import { DatabaseService } from './database.service';
import { DateRange, dayRange, monthRange, toLocalIso, weekRange } from './dates';
import { Category, CategoryColor, CurrencyCode, DEFAULT_SETTINGS, Movement, MovementType, NewMovement, Settings } from './models';

interface CategoryRow {
  id: string;
  name: string;
  type: MovementType;
  icon: string;
  color: Category['color'];
  sort_order: number;
  archived: number;
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
  id: string;
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

export interface CategoryTotal {
  categoryId: string;
  totalCents: number;
}

export interface CategoryInput {
  id?: string;
  name: string;
  type: MovementType;
  icon: string;
  color: CategoryColor;
}

const toBudgetStatus = (id: string, categoryId: string | null, limitCents: number, spentCents: number): BudgetStatus => ({
  id,
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
      .filter((c) => c.type === type && !c.archived)
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
      globalBudget: global ? toBudgetStatus(global.id, null, global.limitCents, monthTotals.expense) : null,
      budgetAlert: alert,
      recent: recent.map(toMovement),
    };
  }

  // ---------- Estadísticas ----------

  /** Total por categoría en el intervalo, de mayor a menor. */
  async categoryTotals(range: DateRange, type: MovementType = 'expense'): Promise<CategoryTotal[]> {
    await this.ready();
    const rows = await this.db.query<{ category_id: string; total: number }>(
      `SELECT category_id, SUM(amount_cents) AS total FROM movements
       WHERE type = ? AND occurred_at >= ? AND occurred_at < ?
       GROUP BY category_id ORDER BY total DESC`,
      [type, range.start, range.end],
    );
    return rows.map((r) => ({ categoryId: r.category_id, totalCents: Number(r.total) }));
  }

  // ---------- Presupuestos ----------

  /** Presupuestos con lo gastado en el mes actual. El global va primero. */
  async budgets(now = new Date()): Promise<BudgetStatus[]> {
    await this.ready();
    const month = monthRange(now, this.settings().monthStartDay);
    const [statuses, totals] = await Promise.all([this.budgetStatuses(month), this.totalsByType(month)]);
    const order = (b: BudgetStatus) => (b.categoryId === null ? -1 : (this.categoriesById().get(b.categoryId)?.sortOrder ?? 99));
    return statuses
      .map((b) => (b.categoryId === null ? toBudgetStatus(b.id, null, b.limitCents, totals.expense) : b))
      .sort((a, b) => order(a) - order(b));
  }

  async saveBudget(input: { id?: string; categoryId: string | null; amountCents: number }): Promise<void> {
    if (input.id) {
      await this.db.run('UPDATE budgets SET category_id = ?, amount_cents = ? WHERE id = ?', [
        input.categoryId,
        input.amountCents,
        input.id,
      ]);
    } else {
      await this.db.run('INSERT INTO budgets (id, category_id, amount_cents) VALUES (?, ?, ?)', [
        crypto.randomUUID(),
        input.categoryId,
        input.amountCents,
      ]);
    }
    this.bump();
  }

  async deleteBudget(id: string): Promise<void> {
    await this.db.run('DELETE FROM budgets WHERE id = ?', [id]);
    this.bump();
  }

  // ---------- Ajustes ----------

  async updateSettings(changes: Partial<Settings>): Promise<void> {
    for (const [key, value] of Object.entries(changes)) {
      await this.db.run(
        'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value',
        [key, String(value)],
      );
    }
    this.settings.update((s) => ({ ...s, ...changes }));
    this.bump();
  }

  // ---------- Categorías ----------

  async saveCategory(input: CategoryInput): Promise<void> {
    const name = input.name.trim();
    if (input.id) {
      await this.db.run('UPDATE categories SET name = ?, icon = ?, color = ? WHERE id = ?', [
        name,
        input.icon,
        input.color,
        input.id,
      ]);
    } else {
      const last = this.categoriesOf(input.type).at(-1)?.sortOrder ?? 0;
      await this.db.run(
        'INSERT INTO categories (id, name, type, icon, color, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
        [crypto.randomUUID(), name, input.type, input.icon, input.color, last + 1],
      );
    }
    await this.reloadCategories();
  }

  /** Guarda el nuevo orden de las categorías de un tipo. */
  async reorderCategories(ids: string[]): Promise<void> {
    for (const [index, id] of ids.entries()) {
      await this.db.run('UPDATE categories SET sort_order = ? WHERE id = ?', [index + 1, id]);
    }
    await this.reloadCategories();
  }

  /**
   * Oculta una categoría: deja de salir al añadir, pero sus movimientos se conservan.
   * También se borra su presupuesto, si tenía.
   */
  async archiveCategory(id: string): Promise<void> {
    await this.db.run('DELETE FROM budgets WHERE category_id = ?', [id]);
    await this.db.run('UPDATE categories SET archived = 1 WHERE id = ?', [id]);
    await this.reloadCategories();
  }

  // ---------- Exportar ----------

  /** Todos los movimientos en CSV (separador ";" para que Excel en español lo abra bien). */
  async exportCsv(): Promise<string> {
    await this.ready();
    const rows = await this.db.query<MovementRow & { category_name: string | null }>(
      `SELECT m.*, c.name AS category_name FROM movements m
       LEFT JOIN categories c ON c.id = m.category_id
       ORDER BY m.occurred_at`,
    );
    const quote = (v: string) => (/[";\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    const lines = rows.map((r) =>
      [
        r.occurred_at.replace('T', ' '),
        r.type === 'expense' ? 'Gasto' : 'Ingreso',
        quote(r.category_name ?? ''),
        (Number(r.amount_cents) / 100).toFixed(2).replace('.', ','),
        this.settings().currency,
        quote(r.note ?? ''),
      ].join(';'),
    );
    return ['Fecha;Tipo;Categoría;Importe;Moneda;Nota', ...lines].join('\n');
  }

  async totalsByType(range: DateRange): Promise<Record<MovementType, number>> {
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
    const rows = await this.db.query<{ id: string; category_id: string | null; amount_cents: number; spent: number }>(
      `SELECT b.id, b.category_id, b.amount_cents, COALESCE(SUM(m.amount_cents), 0) AS spent
       FROM budgets b
       LEFT JOIN movements m
         ON m.category_id = b.category_id AND m.type = 'expense'
        AND m.occurred_at >= ? AND m.occurred_at < ?
       GROUP BY b.id`,
      [range.start, range.end],
    );
    return rows.map((r) => toBudgetStatus(r.id, r.category_id, Number(r.amount_cents), Number(r.spent)));
  }

  private async reloadCategories(): Promise<void> {
    // Se cargan también las ocultas para poder mostrar movimientos antiguos.
    const rows = await this.db.query<CategoryRow>('SELECT * FROM categories ORDER BY type, sort_order');
    this.categories.set(
      rows.map((r) => ({
        id: r.id,
        name: r.name,
        type: r.type,
        icon: r.icon,
        color: r.color,
        sortOrder: Number(r.sort_order),
        archived: Number(r.archived) === 1,
      })),
    );
    this.bump();
  }

  private async load(): Promise<void> {
    const [, settings] = await Promise.all([
      this.reloadCategories(),
      this.db.query<{ key: string; value: string }>('SELECT key, value FROM settings'),
    ]);
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
