import { Component, ElementRef, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  AlertController,
  IonContent,
  IonIcon,
  IonLabel,
  IonSegment,
  IonSegmentButton,
  IonSelect,
  IonSelectOption,
  ToastController,
} from '@ionic/angular';

import { Backup, BackupError, BackupService } from '../../core/backup';
import { toLocalIso } from '../../core/dates';
import { isAbort, saveFile } from '../../core/files';
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
  private readonly backups = inject(BackupService);
  private readonly toasts = inject(ToastController);
  private readonly alerts = inject(AlertController);
  private readonly backupInput = viewChild.required<ElementRef<HTMLInputElement>>('backupInput');

  readonly days = Array.from({ length: 28 }, (_, i) => i + 1);
  readonly settings = this.finance.settings;
  readonly budgets = signal<BudgetStatus[]>([]);
  /** Hay una exportación o restauración en curso. */
  readonly busy = signal(false);

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
    await this.exclusive(async () => {
      const csv = await this.finance.exportCsv();
      // El BOM hace que Excel reconozca los acentos.
      await saveFile(new File(['\ufeff' + csv], `finance-tracker-${this.today()}.csv`, { type: 'text/csv' }), 'Movimientos');
    }, 'No se ha podido exportar.');
  }

  async exportBackup(): Promise<void> {
    await this.exclusive(async () => {
      const json = JSON.stringify(await this.backups.create());
      const name = `finance-tracker-copia-${this.today()}.json`;
      await saveFile(new File([json], name, { type: 'application/json' }), 'Copia de seguridad');
    }, 'No se ha podido crear la copia.');
  }

  pickBackup(): void {
    if (this.busy()) return;
    const input = this.backupInput().nativeElement;
    input.value = '';
    input.click();
  }

  async onBackupFile(event: Event): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    await this.exclusive(async () => {
      const backup = await this.backups.read(await file.text());
      if (await this.confirmRestore(backup)) {
        await this.backups.restore(backup);
        await this.finance.reload();
        await this.toast('Copia restaurada');
      }
    }, 'No se ha podido restaurar la copia. Tus datos no se han tocado.');
  }

  money(cents: number): string {
    return formatMoney(cents, this.settings().currency);
  }

  /** Importe sin decimales para las filas de presupuesto: "842". */
  private whole(cents: number): string {
    return String(Math.round(cents / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }

  private async confirmRestore(backup: Backup): Promise<boolean> {
    const movements = backup.tables.movements.length;
    const date = backup.exportedAt ? new Date(backup.exportedAt).toLocaleDateString('es-ES') : null;
    const alert = await this.alerts.create({
      header: '¿Restaurar esta copia?',
      message:
        `${movements === 1 ? '1 movimiento' : `${movements} movimientos`}${date ? `, copia del ${date}` : ''}. ` +
        'Se borrarán todos tus datos actuales y se sustituirán por los de la copia.',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Restaurar', role: 'destructive' },
      ],
    });
    await alert.present();
    return (await alert.onDidDismiss()).role === 'destructive';
  }

  /** Ejecuta una acción de datos sin solaparse con otra y avisa si falla. */
  private async exclusive(action: () => Promise<void>, failure: string): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    try {
      await action();
    } catch (error) {
      if (!isAbort(error)) {
        console.error(failure, error);
        await this.toast(error instanceof BackupError ? error.message : failure, 'danger');
      }
    } finally {
      this.busy.set(false);
    }
  }

  private async toast(message: string, color?: string): Promise<void> {
    const toast = await this.toasts.create({ message, duration: 3000, color });
    await toast.present();
  }

  private today(): string {
    return toLocalIso(new Date()).slice(0, 10);
  }

  private async reload(): Promise<void> {
    try {
      this.budgets.set(await this.finance.budgets());
    } catch (error) {
      console.error('No se pudieron cargar los presupuestos', error);
    }
  }
}
