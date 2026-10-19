import { Component } from '@angular/core';
import { IonContent } from '@ionic/angular';

/** Pantalla pendiente de la siguiente tanda. */
@Component({
  selector: 'app-ajustes',
  template: `
    <ion-content class="app-page safe-top ion-padding">
      <h1 class="app-title">Ajustes</h1>
      <p class="app-muted">Próximamente: presupuestos, categorías, moneda y exportación a CSV.</p>
    </ion-content>
  `,
  imports: [IonContent],
})
export class AjustesPage {}
