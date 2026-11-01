import { Routes } from '@angular/router';
import { TabsPage } from './tabs.page';

export const routes: Routes = [
  {
    path: 'tabs',
    component: TabsPage,
    children: [
      {
        path: 'inicio',
        loadComponent: () => import('../pages/inicio/inicio.page').then((m) => m.InicioPage),
      },
      {
        path: 'estadisticas',
        loadComponent: () =>
          import('../pages/estadisticas/estadisticas.page').then((m) => m.EstadisticasPage),
      },
      {
        path: 'ajustes',
        loadComponent: () => import('../pages/ajustes/ajustes.page').then((m) => m.AjustesPage),
      },
      {
        path: '',
        redirectTo: '/tabs/inicio',
        pathMatch: 'full',
      },
    ],
  },
  {
    path: '',
    redirectTo: '/tabs/inicio',
    pathMatch: 'full',
  },
];
