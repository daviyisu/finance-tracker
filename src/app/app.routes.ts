import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'anadir',
    loadComponent: () => import('./pages/anadir/anadir.page').then((m) => m.AnadirPage),
  },
  {
    path: '',
    loadChildren: () => import('./tabs/tabs.routes').then((m) => m.routes),
  },
];
