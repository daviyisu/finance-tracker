import type { Category, CategoryColor } from './models';

/** Tinta del icono y fondo tintado de cada color de categoría. */
export const CATEGORY_COLORS: Record<CategoryColor, { fg: string; bg: string }> = {
  green: { fg: '#15803d', bg: '#dcfce7' },
  orange: { fg: '#c2410c', bg: '#ffedd5' },
  blue: { fg: '#1d4ed8', bg: '#dbeafe' },
  purple: { fg: '#7e22ce', bg: '#f3e8ff' },
  teal: { fg: '#0f766e', bg: '#ccfbf1' },
  amber: { fg: '#a16207', bg: '#fef9c3' },
  indigo: { fg: '#4338ca', bg: '#e0e7ff' },
  rose: { fg: '#be123c', bg: '#ffe4e6' },
  slate: { fg: '#475569', bg: '#e2e8f0' },
  accent: { fg: '#1f6f54', bg: '#dcefe6' },
};

/** Categorías que se crean la primera vez que se abre la app. */
export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'supermercado', name: 'Supermercado', type: 'expense', icon: 'cart-outline', color: 'green', sortOrder: 1 },
  { id: 'comida', name: 'Comida', type: 'expense', icon: 'restaurant-outline', color: 'orange', sortOrder: 2 },
  { id: 'transporte', name: 'Transporte', type: 'expense', icon: 'bus-outline', color: 'blue', sortOrder: 3 },
  { id: 'ocio', name: 'Ocio', type: 'expense', icon: 'musical-notes-outline', color: 'purple', sortOrder: 4 },
  { id: 'casa', name: 'Casa', type: 'expense', icon: 'home-outline', color: 'teal', sortOrder: 5 },
  { id: 'compras', name: 'Compras', type: 'expense', icon: 'bag-handle-outline', color: 'amber', sortOrder: 6 },
  { id: 'suscripciones', name: 'Suscripciones', type: 'expense', icon: 'repeat-outline', color: 'indigo', sortOrder: 7 },
  { id: 'salud', name: 'Salud', type: 'expense', icon: 'heart-outline', color: 'rose', sortOrder: 8 },
  { id: 'otros', name: 'Otros', type: 'expense', icon: 'ellipsis-horizontal', color: 'slate', sortOrder: 9 },
  { id: 'nomina', name: 'Nómina', type: 'income', icon: 'wallet-outline', color: 'accent', sortOrder: 1 },
  { id: 'otros-ingresos', name: 'Otros ingresos', type: 'income', icon: 'cash-outline', color: 'accent', sortOrder: 2 },
];
