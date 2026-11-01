import { Component, computed, inject, input, signal } from '@angular/core';
import {
  AlertController,
  IonButton,
  IonButtons,
  IonContent,
  IonDatetime,
  IonHeader,
  IonIcon,
  IonInput,
  IonLabel,
  IonModal,
  IonSegment,
  IonSegmentButton,
  IonSelect,
  IonSelectOption,
  IonTitle,
  IonToolbar,
  NavController,
  ToastController,
} from '@ionic/angular';

import { dayHeading, timeLabel, toLocalIso } from '../../core/dates';
import { FinanceService } from '../../core/finance.service';
import { centsToInput, currencySymbol, parseAmount } from '../../core/money';
import { Movement, MovementType } from '../../core/models';

@Component({
  selector: 'app-movimiento',
  templateUrl: 'movimiento.page.html',
  styleUrls: ['movimiento.page.scss'],
  imports: [
    IonHeader,
    IonToolbar,
    IonButtons,
    IonButton,
    IonTitle,
    IonContent,
    IonSegment,
    IonSegmentButton,
    IonLabel,
    IonInput,
    IonSelect,
    IonSelectOption,
    IonModal,
    IonDatetime,
    IonIcon,
  ],
})
export class MovimientoPage {
  private readonly finance = inject(FinanceService);
  private readonly nav = inject(NavController);
  private readonly alerts = inject(AlertController);
  private readonly toasts = inject(ToastController);

  /** Parámetro de ruta. */
  readonly id = input<string>('');

  readonly original = signal<Movement | null>(null);
  readonly notFound = signal(false);
  readonly type = signal<MovementType>('expense');
  readonly amount = signal('');
  readonly categoryId = signal('');
  readonly date = signal(new Date());
  readonly note = signal('');
  readonly dateOpen = signal(false);
  readonly saving = signal(false);
  readonly triedSave = signal(false);

  readonly symbol = computed(() => currencySymbol(this.finance.settings().currency));
  readonly amountCents = computed(() => parseAmount(this.amount()));
  readonly dateIso = computed(() => toLocalIso(this.date()));
  readonly dateText = computed(() => `${dayHeading(this.dateIso(), new Date())}, ${timeLabel(this.dateIso())}`);

  /** Categorías del tipo elegido; incluye la original aunque esté oculta. */
  readonly categories = computed(() => {
    const list = this.finance.categoriesOf(this.type());
    const original = this.finance.categoriesById().get(this.original()?.categoryId ?? '');
    return original?.archived && original.type === this.type() ? [...list, original] : list;
  });

  async ionViewWillEnter(): Promise<void> {
    await this.finance.ready();
    const m = await this.finance.getMovement(this.id());
    if (!m) {
      this.notFound.set(true);
      return;
    }
    this.original.set(m);
    this.type.set(m.type);
    this.amount.set(centsToInput(m.amountCents));
    this.categoryId.set(m.categoryId);
    this.date.set(new Date(m.occurredAt));
    this.note.set(m.note ?? '');
  }

  setType(value: unknown): void {
    if (value !== 'expense' && value !== 'income') return;
    this.type.set(value);
    if (!this.categories().some((c) => c.id === this.categoryId())) {
      this.categoryId.set(this.categories()[0]?.id ?? '');
    }
  }

  setDate(value: string | string[] | null | undefined): void {
    if (typeof value === 'string') this.date.set(new Date(value));
    this.dateOpen.set(false);
  }

  async save(): Promise<void> {
    this.triedSave.set(true);
    const cents = this.amountCents();
    const original = this.original();
    if (!original || !cents || !this.categoryId() || this.saving()) return;
    this.saving.set(true);
    try {
      await this.finance.updateMovement(original.id, {
        type: this.type(),
        amountCents: cents,
        categoryId: this.categoryId(),
        occurredAt: this.dateIso(),
        note: this.note() || null,
      });
      this.close();
    } catch (error) {
      console.error('No se pudo guardar el movimiento', error);
      this.saving.set(false);
    }
  }

  async remove(): Promise<void> {
    const original = this.original();
    if (!original) return;
    const alert = await this.alerts.create({
      header: '¿Borrar este movimiento?',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Borrar',
          role: 'destructive',
          handler: async () => {
            await this.finance.deleteMovement(original.id);
            this.close();
            const toast = await this.toasts.create({
              message: 'Movimiento borrado',
              duration: 4000,
              position: 'top',
              buttons: [{ text: 'Deshacer', role: 'cancel', handler: () => void this.finance.restoreMovement(original) }],
            });
            await toast.present();
          },
        },
      ],
    });
    await alert.present();
  }

  close(): void {
    this.nav.back();
  }
}
