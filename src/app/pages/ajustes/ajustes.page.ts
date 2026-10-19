import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  IonContent,
  IonIcon,
  IonLabel,
  IonSegment,
  IonSegmentButton,
  IonSelect,
  IonSelectOption,
  ToastController,
} from '@ionic/angular';

import { toLocalIso } from '../../core/dates';
import { BudgetStatus, FinanceService } from '../../core/finance.service';
import { formatMoney } from '../../core/money';
import { CurrencyCode } from '../../core/models';

const WARN_PERCENT = 80;

@Component({
  selector: 'app-ajustes',
  templateUrl: 'ajustes.page.html',
  styleUrls: ['ajustes.page.scss'],
  imports: [IonContent, IonIcon, IonSegment, IonSegmentButton, IonLabel, IonSelect, IonSelectOption, RouterLink],
})
export class AjustesPage {
  private readonly finance = inject(FinanceService);
  private readonly toasts = inject(ToastController);

  readonly days = Array.from({ length: 28 }, (_, i) => i + 1);
  readonly settings = this.finance.settings;
  readonly budgets = signal<BudgetStatus[]>([]);
  readonly exporting = signal(false);

  readonly budgetRows = computed(() =>
    this.budgets().map((b) => {
      const name = b.categoryId ? (this.finance.categoriesById().get(b.categoryId)?.name ?? 'Categoría') : 'Global';
      return {
        id: b.id,
        name,
        detail: `${this.whole(b.spentCents)} de ${this.money(b.limitCents)}`,
        width: Math.min(b.percent, 100),
        state: b.percent >= 100 ? 'over' : b.percent >= WARN_PERCENT ? 'warn' : '',
      };
    }),
  );

  readonly categoryCount = computed(() => {
    const expense = this.finance.categoriesOf('expense').length;
    const income = this.finance.categoriesOf('income').length;
    return `${expense} gasto · ${income} ingreso`;
  });

  constructor() {
    effect(() => {
      this.finance.revision();
      untracked(() => void this.reload());
    });
  }

  ionViewWillEnter(): void {
    void this.reload();
  }

  async setCurrency(value: unknown): Promise<void> {
    if ((value === 'EUR' || value === 'USD') && value !== this.settings().currency) {
      await this.finance.updateSettings({ currency: value as CurrencyCode });
    }
  }

  async setStartDay(value: unknown): Promise<void> {
    const day = Number(value);
    if (day >= 1 && day <= 28 && day !== this.settings().monthStartDay) {
      await this.finance.updateSettings({ monthStartDay: day });
    }
  }

  async exportCsv(): Promise<void> {
    if (this.exporting()) return;
    this.exporting.set(true);
    try {
      const csv = await this.finance.exportCsv();
      const name = `finance-tracker-${toLocalIso(new Date()).slice(0, 10)}.csv`;
      // El BOM hace que Excel reconozca los acentos.
      const file = new File(['﻿' + csv], name, { type: 'text/csv' });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Movimientos' });
      } else {
        const url = URL.createObjectURL(file);
        const link = document.createElement('a');
        link.href = url;
        link.download = name;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    } catch (error) {
      if ((error as DOMException)?.name !== 'AbortError') {
        console.error('No se pudo exportar', error);
        const toast = await this.toasts.create({ message: 'No se ha podido exportar.', duration: 3000, color: 'danger' });
        await toast.present();
      }
    } finally {
      this.exporting.set(false);
    }
  }

  money(cents: number): string {
    return formatMoney(cents, this.settings().currency);
  }

  /** Importe sin decimales para las filas de presupuesto: "842". */
  private whole(cents: number): string {
    return String(Math.round(cents / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }

  private async reload(): Promise<void> {
    try {
      this.budgets.set(await this.finance.budgets());
    } catch (error) {
      console.error('No se pudieron cargar los presupuestos', error);
    }
  }
}
