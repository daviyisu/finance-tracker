import { Component } from '@angular/core';
import { IonContent } from '@ionic/angular';

/** Pantalla pendiente de la siguiente tanda. */
@Component({
  selector: 'app-estadisticas',
  template: `
    <ion-content class="app-page safe-top ion-padding">
      <h1 class="app-title">Estadísticas</h1>
      <p class="app-muted">Próximamente: gasto por categoría y evolución en el tiempo.</p>
    </ion-content>
  `,
  imports: [IonContent],
})
export class EstadisticasPage {}
