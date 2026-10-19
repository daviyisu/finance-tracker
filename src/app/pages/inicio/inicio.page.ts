import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonButton, IonContent, IonIcon, IonRefresher, IonRefresherContent, RefresherCustomEvent } from '@ionic/angular';

import { monthTitle } from '../../core/dates';
import { FinanceService, HomeSummary } from '../../core/finance.service';
import { formatMoney } from '../../core/money';
import { movementRow } from '../../core/movement-view';

const WARN_PERCENT = 80;

@Component({
  selector: 'app-inicio',
  templateUrl: 'inicio.page.html',
  styleUrls: ['inicio.page.scss'],
  imports: [IonContent, IonButton, IonIcon, IonRefresher, IonRefresherContent, RouterLink],
})
export class InicioPage {
  private readonly finance = inject(FinanceService);

  readonly summary = signal<HomeSummary | null>(null);
  readonly failed = signal(false);
  private readonly now = signal(new Date());

  readonly title = computed(() => monthTitle(this.now(), this.finance.settings().monthStartDay));

  readonly remainingCents = computed(() => {
    const s = this.summary();
    return s ? s.monthIncomeCents - s.monthExpenseCents : 0;
  });

  readonly budget = computed(() => {
    const b = this.summary()?.globalBudget;
    if (!b) return null;
    const left = b.limitCents - b.spentCents;
    return {
      percent: b.percent,
      width: Math.min(b.percent, 100),
      state: b.percent >= 100 ? 'over' : b.percent >= WARN_PERCENT ? 'warn' : 'ok',
      limit: this.money(b.limitCents),
      left: left >= 0 ? `Quedan ${this.money(left)}` : `Te has pasado ${this.money(-left)}`,
    };
  });

  readonly alert = computed(() => {
    const a = this.summary()?.budgetAlert;
    const category = a?.categoryId ? this.finance.categoriesById().get(a.categoryId) : undefined;
    if (!a || !category) return null;
    const amounts = `(${this.money(a.spentCents)} de ${this.money(a.limitCents)})`;
    return a.percent >= 100
      ? `${category.name} ha superado su presupuesto ${amounts}`
      : `${category.name} va al ${a.percent}% de su presupuesto ${amounts}`;
  });

  readonly recent = computed(() =>
    (this.summary()?.recent ?? []).map((m) =>
      movementRow(m, this.finance.categoriesById(), this.finance.settings().currency, this.now()),
    ),
  );

  constructor() {
    // Recarga al guardar o borrar un movimiento.
    effect(() => {
      this.finance.revision();
      untracked(() => void this.reload());
    });
  }

  ionViewWillEnter(): void {
    this.now.set(new Date());
    void this.reload();
  }

  async refresh(event: RefresherCustomEvent): Promise<void> {
    this.now.set(new Date());
    await this.reload();
    await event.target.complete();
  }

  money(cents: number): string {
    return formatMoney(cents, this.finance.settings().currency);
  }

  private async reload(): Promise<void> {
    try {
      this.summary.set(await this.finance.homeSummary(this.now()));
      this.failed.set(false);
    } catch (error) {
      console.error('No se pudo cargar el resumen', error);
      this.failed.set(true);
    }
  }
}
