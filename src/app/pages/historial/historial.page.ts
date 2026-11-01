import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  InfiniteScrollCustomEvent,
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
  IonItem,
  IonItemOption,
  IonItemOptions,
  IonItemSliding,
  IonLabel,
  IonList,
  IonSearchbar,
  IonTitle,
  IonToolbar,
  ToastController,
} from '@ionic/angular';

import { dayHeading } from '../../core/dates';
import { FinanceService } from '../../core/finance.service';
import { formatSignedMoney } from '../../core/money';
import { Movement } from '../../core/models';
import { movementRow } from '../../core/movement-view';

const PAGE_SIZE = 40;

@Component({
  selector: 'app-historial',
  templateUrl: 'historial.page.html',
  styleUrls: ['historial.page.scss'],
  imports: [
    IonHeader,
    IonToolbar,
    IonButtons,
    IonBackButton,
    IonTitle,
    IonSearchbar,
    IonContent,
    IonList,
    IonItemSliding,
    IonItem,
    IonItemOptions,
    IonItemOption,
    IonLabel,
    IonIcon,
    IonInfiniteScroll,
    IonInfiniteScrollContent,
    RouterLink,
  ],
})
export class HistorialPage {
  private readonly finance = inject(FinanceService);
  private readonly toasts = inject(ToastController);

  readonly search = signal('');
  readonly categoryId = signal<string | null>(null);
  readonly items = signal<Movement[]>([]);
  readonly done = signal(false);
  readonly loaded = signal(false);
  private request = 0;

  readonly filters = computed(() => [
    { id: null as string | null, name: 'Todas' },
    ...this.finance.categoriesOf('expense'),
    ...this.finance.categoriesOf('income'),
  ]);

  readonly groups = computed(() => {
    const now = new Date();
    const currency = this.finance.settings().currency;
    const categories = this.finance.categoriesById();
    type Row = ReturnType<typeof movementRow>;
    const byDay: { key: string; cents: number; rows: Row[] }[] = [];
    for (const m of this.items()) {
      const key = m.occurredAt.slice(0, 10);
      let day = byDay.at(-1);
      if (!day || day.key !== key) {
        day = { key, cents: 0, rows: [] };
        byDay.push(day);
      }
      day.cents += m.type === 'income' ? m.amountCents : -m.amountCents;
      day.rows.push(movementRow(m, categories, currency, now, false));
    }
    const groups = byDay.map((d) => ({
      key: d.key,
      title: dayHeading(d.key, now),
      total: formatSignedMoney(d.cents, currency),
      rows: d.rows,
    }));
    return groups;
  });

  constructor() {
    effect(() => {
      this.finance.revision();
      this.search();
      this.categoryId();
      untracked(() => void this.reset());
    });
  }

  setSearch(value: string | null | undefined): void {
    this.search.set(value ?? '');
  }

  setFilter(id: string | null): void {
    this.categoryId.set(this.categoryId() === id ? null : id);
  }

  async loadMore(event: InfiniteScrollCustomEvent): Promise<void> {
    const request = this.request;
    const more = await this.fetch(this.items().length);
    if (request === this.request) {
      this.items.update((list) => [...list, ...more]);
      this.done.set(more.length < PAGE_SIZE);
    }
    await event.target.complete();
  }

  async remove(id: string, sliding: IonItemSliding): Promise<void> {
    await sliding.close();
    const movement = this.items().find((m) => m.id === id);
    if (!movement) return;
    await this.finance.deleteMovement(id);
    const toast = await this.toasts.create({
      message: 'Movimiento borrado',
      duration: 4000,
      position: 'top',
      buttons: [{ text: 'Deshacer', role: 'cancel', handler: () => void this.finance.restoreMovement(movement) }],
    });
    await toast.present();
  }

  private async reset(): Promise<void> {
    const request = ++this.request;
    try {
      const first = await this.fetch(0);
      if (request !== this.request) return;
      this.items.set(first);
      this.done.set(first.length < PAGE_SIZE);
      this.loaded.set(true);
    } catch (error) {
      console.error('No se pudo cargar el historial', error);
    }
  }

  private fetch(offset: number): Promise<Movement[]> {
    return this.finance.listMovements({
      search: this.search(),
      categoryId: this.categoryId(),
      limit: PAGE_SIZE,
      offset,
    });
  }
}
