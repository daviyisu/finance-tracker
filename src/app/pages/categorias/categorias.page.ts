import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonReorder,
  IonReorderGroup,
  IonSegment,
  IonSegmentButton,
  IonTitle,
  IonToolbar,
  ReorderEndCustomEvent,
} from '@ionic/angular';

import { CATEGORY_COLORS } from '../../core/categories';
import { FinanceService } from '../../core/finance.service';
import { MovementType } from '../../core/models';

@Component({
  selector: 'app-categorias',
  templateUrl: 'categorias.page.html',
  styleUrls: ['categorias.page.scss'],
  imports: [
    IonHeader,
    IonToolbar,
    IonButtons,
    IonBackButton,
    IonButton,
    IonTitle,
    IonContent,
    IonSegment,
    IonSegmentButton,
    IonLabel,
    IonList,
    IonItem,
    IonIcon,
    IonReorderGroup,
    IonReorder,
    RouterLink,
  ],
})
export class CategoriasPage {
  private readonly finance = inject(FinanceService);

  readonly type = signal<MovementType>('expense');
  readonly expenseCount = computed(() => this.finance.categoriesOf('expense').length);
  readonly incomeCount = computed(() => this.finance.categoriesOf('income').length);
  readonly items = computed(() =>
    this.finance.categoriesOf(this.type()).map((c) => ({ ...c, ...CATEGORY_COLORS[c.color] })),
  );

  constructor() {
    void this.finance.ready();
  }

  setType(value: unknown): void {
    if (value === 'expense' || value === 'income') this.type.set(value);
  }

  async reorder(event: ReorderEndCustomEvent): Promise<void> {
    const ids = event.detail.complete(this.items().map((c) => c.id)) as string[];
    await this.finance.reorderCategories(ids);
  }
}
