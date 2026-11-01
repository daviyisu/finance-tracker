import { Component, computed, inject, input, signal } from '@angular/core';
import {
  AlertController,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonInput,
  IonSelect,
  IonSelectOption,
  IonTitle,
  IonToolbar,
  NavController,
} from '@ionic/angular';

import { BudgetStatus, FinanceService } from '../../core/finance.service';
import { centsToInput, currencySymbol, formatMoney, parseAmount } from '../../core/money';

const GLOBAL = 'global';
const WARN_PERCENT = 80;

@Component({
  selector: 'app-presupuesto',
  templateUrl: 'presupuesto.page.html',
  styleUrls: ['presupuesto.page.scss'],
  imports: [IonHeader, IonToolbar, IonButtons, IonButton, IonTitle, IonContent, IonInput, IonSelect, IonSelectOption],
})
export class PresupuestoPage {
  private readonly finance = inject(FinanceService);
  private readonly nav = inject(NavController);
  private readonly alerts = inject(AlertController);

  /** Parámetro de ruta: id del presupuesto o "nuevo". */
  readonly id = input<string>('nuevo');

  readonly budgets = signal<BudgetStatus[]>([]);
  readonly target = signal<string>(GLOBAL);
  readonly amount = signal('');
  readonly saving = signal(false);
  readonly triedSave = signal(false);

  readonly symbol = computed(() => currencySymbol(this.finance.settings().currency));
  readonly existing = computed(() => this.budgets().find((b) => b.id === this.id()) ?? null);
  readonly amountCents = computed(() => parseAmount(this.amount()));

  /** Global y categorías de gasto que aún no tienen presupuesto (o la de este). */
  readonly options = computed(() => {
    const taken = new Set(this.budgets().filter((b) => b.id !== this.id()).map((b) => b.categoryId ?? GLOBAL));
    const all = [
      { value: GLOBAL, label: 'Global (todo el mes)' },
      ...this.finance.categoriesOf('expense').map((c) => ({ value: c.id, label: c.name })),
    ];
    return all.filter((o) => !taken.has(o.value));
  });

  readonly status = computed(() => {
    const b = this.existing();
    if (!b) return null;
    const money = (c: number) => formatMoney(c, this.finance.settings().currency);
    const left = b.limitCents - b.spentCents;
    return {
      percent: b.percent,
      width: Math.min(b.percent, 100),
      state: b.percent >= 100 ? 'over' : b.percent >= WARN_PERCENT ? 'warn' : '',
      spent: `Llevas ${money(b.spentCents)}`,
      left: left >= 0 ? `Quedan ${money(left)}` : `Te has pasado ${money(-left)}`,
    };
  });

  async ionViewWillEnter(): Promise<void> {
    await this.finance.ready();
    this.budgets.set(await this.finance.budgets());
    const b = this.existing();
    if (b) {
      this.target.set(b.categoryId ?? GLOBAL);
      this.amount.set(centsToInput(b.limitCents));
    } else {
      this.target.set(this.options()[0]?.value ?? GLOBAL);
    }
  }

  async save(): Promise<void> {
    this.triedSave.set(true);
    const cents = this.amountCents();
    if (!cents || this.saving() || !this.options().length) return;
    this.saving.set(true);
    try {
      await this.finance.saveBudget({
        id: this.existing()?.id,
        categoryId: this.target() === GLOBAL ? null : this.target(),
        amountCents: cents,
      });
      await this.nav.navigateBack('/tabs/ajustes');
    } catch (error) {
      console.error('No se pudo guardar el presupuesto', error);
      this.saving.set(false);
    }
  }

  async remove(): Promise<void> {
    const b = this.existing();
    if (!b) return;
    const alert = await this.alerts.create({
      header: '¿Eliminar este presupuesto?',
      message: 'Tus movimientos no se borran.',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Eliminar',
          role: 'destructive',
          handler: async () => {
            await this.finance.deleteBudget(b.id);
            await this.nav.navigateBack('/tabs/ajustes');
          },
        },
      ],
    });
    await alert.present();
  }

  cancel(): void {
    void this.nav.navigateBack('/tabs/ajustes');
  }
}
