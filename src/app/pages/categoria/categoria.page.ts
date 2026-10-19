import { Component, computed, inject, input, signal } from '@angular/core';
import {
  AlertController,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonTitle,
  IonToolbar,
  NavController,
} from '@ionic/angular';

import { CATEGORY_COLORS } from '../../core/categories';
import { FinanceService } from '../../core/finance.service';
import { CATEGORY_ICONS } from '../../core/icons';
import { CategoryColor, MovementType } from '../../core/models';

const COLOR_NAMES: Record<CategoryColor, string> = {
  green: 'Verde',
  orange: 'Naranja',
  blue: 'Azul',
  purple: 'Morado',
  teal: 'Turquesa',
  amber: 'Mostaza',
  indigo: 'Índigo',
  rose: 'Rosa',
  slate: 'Gris',
  accent: 'Verde oscuro',
};

@Component({
  selector: 'app-categoria',
  templateUrl: 'categoria.page.html',
  styleUrls: ['categoria.page.scss'],
  imports: [IonHeader, IonToolbar, IonButtons, IonButton, IonTitle, IonContent, IonInput, IonIcon],
})
export class CategoriaPage {
  private readonly finance = inject(FinanceService);
  private readonly nav = inject(NavController);
  private readonly alerts = inject(AlertController);

  /** Parámetro de ruta: id de la categoría o "nueva". */
  readonly id = input<string>('nueva');
  /** Query param para categorías nuevas: "expense" | "income". */
  readonly tipo = input<string>();

  readonly name = signal('');
  readonly icon = signal(CATEGORY_ICONS[0]);
  readonly color = signal<CategoryColor>('green');
  readonly saving = signal(false);
  readonly triedSave = signal(false);

  readonly icons = CATEGORY_ICONS;
  readonly colors = (Object.keys(CATEGORY_COLORS) as CategoryColor[]).map((key) => ({
    key,
    label: COLOR_NAMES[key],
    ...CATEGORY_COLORS[key],
  }));

  readonly existing = computed(() => this.finance.categoriesById().get(this.id()) ?? null);
  readonly type = computed<MovementType>(() => this.existing()?.type ?? (this.tipo() === 'income' ? 'income' : 'expense'));
  readonly preview = computed(() => CATEGORY_COLORS[this.color()]);
  /** No se puede ocultar la última categoría de un tipo. */
  readonly canArchive = computed(() => !!this.existing() && this.finance.categoriesOf(this.type()).length > 1);

  async ionViewWillEnter(): Promise<void> {
    await this.finance.ready();
    const c = this.existing();
    if (c) {
      this.name.set(c.name);
      this.icon.set(c.icon);
      this.color.set(c.color);
    } else if (this.type() === 'income') {
      this.icon.set('wallet-outline');
      this.color.set('accent');
    }
  }

  async save(): Promise<void> {
    this.triedSave.set(true);
    if (!this.name().trim() || this.saving()) return;
    this.saving.set(true);
    try {
      await this.finance.saveCategory({
        id: this.existing()?.id,
        name: this.name(),
        type: this.type(),
        icon: this.icon(),
        color: this.color(),
      });
      await this.nav.navigateBack('/categorias');
    } catch (error) {
      console.error('No se pudo guardar la categoría', error);
      this.saving.set(false);
    }
  }

  async archive(): Promise<void> {
    const c = this.existing();
    if (!c) return;
    const alert = await this.alerts.create({
      header: `¿Ocultar ${c.name}?`,
      message: 'Dejará de aparecer al añadir. Sus movimientos se conservan y su presupuesto se elimina.',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Ocultar',
          role: 'destructive',
          handler: async () => {
            await this.finance.archiveCategory(c.id);
            await this.nav.navigateBack('/categorias');
          },
        },
      ],
    });
    await alert.present();
  }

  cancel(): void {
    void this.nav.navigateBack('/categorias');
  }
}
