import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'anadir',
    loadComponent: () => import('./pages/anadir/anadir.page').then((m) => m.AnadirPage),
  },
  {
    path: 'historial',
    loadComponent: () => import('./pages/historial/historial.page').then((m) => m.HistorialPage),
  },
  {
    path: 'movimiento/:id',
    loadComponent: () => import('./pages/movimiento/movimiento.page').then((m) => m.MovimientoPage),
  },
  {
    path: 'presupuesto/:id',
    loadComponent: () => import('./pages/presupuesto/presupuesto.page').then((m) => m.PresupuestoPage),
  },
  {
    path: 'categorias',
    loadComponent: () => import('./pages/categorias/categorias.page').then((m) => m.CategoriasPage),
  },
  {
    path: 'categoria/:id',
    loadComponent: () => import('./pages/categoria/categoria.page').then((m) => m.CategoriaPage),
  },
  {
    path: '',
    loadChildren: () => import('./tabs/tabs.routes').then((m) => m.routes),
  },
];
