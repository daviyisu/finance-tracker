import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { IonButton, IonContent, IonIcon, IonLabel, IonSegment, IonSegmentButton } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { chevronBack, chevronForward } from 'ionicons/icons';

import { CATEGORY_COLORS } from '../../core/categories';
import { CategoryTotal, FinanceService } from '../../core/finance.service';
import { formatMoney } from '../../core/money';
import { PeriodKind, evolutionPeriods, periodAt, previousLabel, shiftPeriod } from '../../core/periods';

const RADIUS = 70;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const REST_COLOR = '#b8bbb2';
const TOP_IN_RING = 4;

interface Bar {
  label: string;
  value: string;
  height: number;
  current: boolean;
}

@Component({
  selector: 'app-estadisticas',
  templateUrl: 'estadisticas.page.html',
  styleUrls: ['estadisticas.page.scss'],
  imports: [IonContent, IonSegment, IonSegmentButton, IonLabel, IonButton, IonIcon],
})
export class EstadisticasPage {
  private readonly finance = inject(FinanceService);

  readonly kind = signal<PeriodKind>('month');
  readonly anchor = signal(new Date());
  readonly totals = signal<CategoryTotal[]>([]);
  readonly series = signal<number[]>([]);
  readonly previousTotal = signal(0);
  readonly budgetCents = signal<number | null>(null);
  readonly loaded = signal(false);

  private readonly startDay = computed(() => this.finance.settings().monthStartDay);
  readonly period = computed(() => periodAt(this.kind(), this.anchor(), this.startDay()));
  readonly evolution = computed(() => evolutionPeriods(this.kind(), this.anchor(), this.startDay()));
  readonly isCurrent = computed(() => this.period().range.start === periodAt(this.kind(), new Date(), this.startDay()).range.start);
  readonly total = computed(() => this.totals().reduce((sum, t) => sum + t.totalCents, 0));

  readonly rows = computed(() => {
    const total = this.total();
    const max = this.totals()[0]?.totalCents ?? 1;
    return this.totals().map((t) => {
      const category = this.finance.categoriesById().get(t.categoryId);
      const colors = CATEGORY_COLORS[category?.color ?? 'slate'];
      return {
        id: t.categoryId,
        name: category?.name ?? 'Sin categoría',
        icon: category?.icon ?? 'ellipsis-horizontal',
        fg: colors.fg,
        bg: colors.bg,
        amount: this.money(t.totalCents),
        percent: total ? Math.round((t.totalCents / total) * 100) : 0,
        bar: (t.totalCents / max) * 100,
      };
    });
  });

  /** Segmentos del anillo: las 4 categorías mayores y "resto". */
  readonly segments = computed(() => {
    const total = this.total();
    if (!total) return [];
    const rows = this.rows();
    const top = rows.slice(0, TOP_IN_RING).map((r, i) => ({ color: r.fg, cents: this.totals()[i].totalCents }));
    const rest = this.totals().slice(TOP_IN_RING).reduce((s, t) => s + t.totalCents, 0);
    if (rest > 0) top.push({ color: REST_COLOR, cents: rest });
    let offset = 0;
    return top.map((s) => {
      const length = (s.cents / total) * CIRCUMFERENCE;
      const segment = {
        color: s.color,
        dash: `${Math.max(length - (top.length > 1 ? 3 : 0), 0.1)} ${CIRCUMFERENCE}`,
        offset: -offset,
      };
      offset += length;
      return segment;
    });
  });

  readonly ringLabel = computed(() =>
    this.rows()
      .map((r) => `${r.name} ${r.percent}%`)
      .join(', '),
  );

  readonly bars = computed<Bar[]>(() => {
    const values = this.series();
    const budget = this.kind() === 'month' ? this.budgetCents() : null;
    const max = Math.max(...values, budget ?? 0, 1);
    const periods = this.evolution();
    const currentStart = this.period().range.start;
    return periods.map((p, i) => ({
      label: p.short,
      value: this.compact(values[i] ?? 0),
      height: ((values[i] ?? 0) / max) * 100,
      current: p.range.start === currentStart || (this.kind() === 'year' && i === new Date().getMonth() && this.isCurrent()),
    }));
  });

  /** Altura (%) de la línea de presupuesto, solo en la vista mensual. */
  readonly budgetLine = computed(() => {
    const budget = this.kind() === 'month' ? this.budgetCents() : null;
    if (!budget) return null;
    const max = Math.max(...this.series(), budget, 1);
    return { bottom: (budget / max) * 100, label: `Presupuesto ${this.money(budget)}` };
  });

  readonly comparison = computed(() => {
    const prev = this.previousTotal();
    const label = previousLabel(this.kind(), this.anchor(), this.startDay());
    if (!prev) return null;
    const change = Math.round(((this.total() - prev) / prev) * 100);
    const sign = change > 0 ? '+' : change < 0 ? '−' : '';
    return { text: `${sign}${Math.abs(change)}% vs. ${label}`, up: change > 0 };
  });

  constructor() {
    addIcons({ chevronBack, chevronForward });
    effect(() => {
      this.finance.revision();
      this.kind();
      this.anchor();
      untracked(() => void this.reload());
    });
  }

  ionViewWillEnter(): void {
    void this.reload();
  }

  setKind(value: unknown): void {
    if (value === 'week' || value === 'month' || value === 'year') {
      this.kind.set(value);
      this.anchor.set(new Date());
    }
  }

  move(step: number): void {
    this.anchor.set(shiftPeriod(this.kind(), this.anchor(), step, this.startDay()));
  }

  money(cents: number): string {
    return formatMoney(cents, this.finance.settings().currency);
  }

  /** Importe redondeado a la unidad, sin decimales: "1.010". */
  private compact(cents: number): string {
    return String(Math.round(cents / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }

  private async reload(): Promise<void> {
    try {
      await this.finance.ready();
      const kind = this.kind();
      const anchor = this.anchor();
      const startDay = this.startDay();
      const previous = periodAt(kind, shiftPeriod(kind, anchor, -1, startDay), startDay);
      const [totals, series, prev, budgets] = await Promise.all([
        this.finance.categoryTotals(this.period().range),
        Promise.all(this.evolution().map((p) => this.finance.totalsByType(p.range).then((t) => t.expense))),
        this.finance.totalsByType(previous.range),
        this.finance.budgets(),
      ]);
      // Si el usuario ha cambiado de periodo mientras cargaba, se descarta.
      if (kind !== this.kind() || anchor !== this.anchor()) return;
      this.totals.set(totals);
      this.series.set(series);
      this.previousTotal.set(prev.expense);
      this.budgetCents.set(budgets.find((b) => b.categoryId === null)?.limitCents ?? null);
      this.loaded.set(true);
    } catch (error) {
      console.error('No se pudieron cargar las estadísticas', error);
    }
  }
}
