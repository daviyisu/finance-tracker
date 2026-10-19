import { Component, computed, inject, signal } from '@angular/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import {
  AlertController,
  IonButton,
  IonButtons,
  IonContent,
  IonDatetime,
  IonFooter,
  IonHeader,
  IonIcon,
  IonLabel,
  IonModal,
  IonSegment,
  IonSegmentButton,
  IonToolbar,
  NavController,
  ToastController,
} from '@ionic/angular';

import { CATEGORY_COLORS } from '../../core/categories';
import { dayLabel, timeLabel, toLocalIso } from '../../core/dates';
import { FinanceService } from '../../core/finance.service';
import { KeypadKey, applyKey, currencySymbol, displayInput, formatMoney, inputToCents } from '../../core/money';
import { Category, MovementType } from '../../core/models';

const KEYS: KeypadKey[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9', ',', '0', 'del'];

async function haptic(run: () => Promise<void>): Promise<void> {
  try {
    await run();
  } catch {
    // Sin vibración en el navegador: no pasa nada.
  }
}

@Component({
  selector: 'app-anadir',
  templateUrl: 'anadir.page.html',
  styleUrls: ['anadir.page.scss'],
  imports: [
    IonHeader,
    IonToolbar,
    IonButtons,
    IonButton,
    IonIcon,
    IonSegment,
    IonSegmentButton,
    IonLabel,
    IonContent,
    IonFooter,
    IonModal,
    IonDatetime,
  ],
})
export class AnadirPage {
  private readonly finance = inject(FinanceService);
  private readonly nav = inject(NavController);
  private readonly toasts = inject(ToastController);
  private readonly alerts = inject(AlertController);

  readonly keys = KEYS;
  readonly type = signal<MovementType>('expense');
  readonly input = signal('');
  readonly note = signal('');
  /** `null` = ahora mismo (se toma la hora al guardar). */
  readonly date = signal<Date | null>(null);
  readonly dateOpen = signal(false);
  readonly saving = signal(false);
  readonly nudge = signal(false);

  readonly amountCents = computed(() => inputToCents(this.input()));
  readonly display = computed(() => displayInput(this.input()));
  readonly symbol = computed(() => currencySymbol(this.finance.settings().currency));
  readonly categories = computed(() =>
    this.finance.categoriesOf(this.type()).map((c) => ({ ...c, ...CATEGORY_COLORS[c.color] })),
  );
  readonly dateText = computed(() => {
    const d = this.date();
    return d ? `${dayLabel(d, new Date())}, ${timeLabel(toLocalIso(d))}` : 'Hoy';
  });
  readonly datetimeValue = computed(() => toLocalIso(this.date() ?? new Date()));
  readonly maxDate = toLocalIso(new Date(new Date().getFullYear() + 1, 11, 31));

  constructor() {
    void this.finance.ready();
  }

  setType(value: unknown): void {
    if (value === 'expense' || value === 'income') this.type.set(value);
  }

  press(key: KeypadKey): void {
    this.input.update((v) => applyKey(v, key));
    void haptic(() => Haptics.impact({ style: ImpactStyle.Light }));
  }

  setDate(value: string | string[] | null | undefined): void {
    if (typeof value === 'string') this.date.set(new Date(value));
    this.dateOpen.set(false);
  }

  async editNote(): Promise<void> {
    const alert = await this.alerts.create({
      header: 'Nota',
      inputs: [{ name: 'note', type: 'text', value: this.note(), placeholder: 'Ej.: Menú del día', attributes: { maxlength: 80 } }],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Aceptar', handler: (data: { note: string }) => this.note.set((data.note ?? '').trim()) },
      ],
    });
    await alert.present();
  }

  async pick(category: Category): Promise<void> {
    if (this.saving()) return;
    const amountCents = this.amountCents();
    if (amountCents <= 0) {
      this.nudge.set(false);
      requestAnimationFrame(() => this.nudge.set(true));
      void haptic(() => Haptics.notification({ type: NotificationType.Warning }));
      return;
    }

    this.saving.set(true);
    try {
      const movement = await this.finance.addMovement({
        type: this.type(),
        amountCents,
        categoryId: category.id,
        occurredAt: toLocalIso(this.date() ?? new Date()),
        note: this.note() || null,
      });
      void haptic(() => Haptics.notification({ type: NotificationType.Success }));
      await this.nav.navigateBack('/tabs/inicio');

      const what = movement.type === 'expense' ? 'Gasto' : 'Ingreso';
      const amount = formatMoney(movement.amountCents, this.finance.settings().currency);
      const toast = await this.toasts.create({
        message: `${what} de ${amount} en ${category.name} guardado`,
        duration: 4000,
        position: 'top',
        buttons: [{ text: 'Deshacer', role: 'cancel', handler: () => void this.undo(movement.id) }],
      });
      await toast.present();
    } catch (error) {
      console.error('No se pudo guardar el movimiento', error);
      this.saving.set(false);
      const toast = await this.toasts.create({ message: 'No se ha podido guardar. Inténtalo de nuevo.', duration: 3000, color: 'danger' });
      await toast.present();
    }
  }

  close(): void {
    void this.nav.navigateBack('/tabs/inicio');
  }

  private async undo(id: string): Promise<void> {
    try {
      await this.finance.deleteMovement(id);
    } catch (error) {
      console.error('No se pudo deshacer', error);
    }
  }
}
