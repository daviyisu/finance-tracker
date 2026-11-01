export type MovementType = 'expense' | 'income';

export type CurrencyCode = 'EUR' | 'USD';

export type CategoryColor =
  | 'green'
  | 'orange'
  | 'blue'
  | 'purple'
  | 'teal'
  | 'amber'
  | 'indigo'
  | 'rose'
  | 'slate'
  | 'accent';

export interface Category {
  id: string;
  name: string;
  type: MovementType;
  /** Nombre de un icono de ionicons, p. ej. "cart-outline". */
  icon: string;
  color: CategoryColor;
  sortOrder: number;
  /** Oculta: no se ofrece al añadir, pero conserva sus movimientos. */
  archived?: boolean;
}

export interface Movement {
  id: string;
  type: MovementType;
  /** Importe positivo en céntimos. El signo lo da `type`. */
  amountCents: number;
  categoryId: string;
  /** Fecha y hora local en formato `YYYY-MM-DDTHH:mm:ss`. */
  occurredAt: string;
  note: string | null;
  createdAt: string;
}

export interface NewMovement {
  type: MovementType;
  amountCents: number;
  categoryId: string;
  occurredAt: string;
  note: string | null;
}

export interface Budget {
  id: string;
  /** `null` = presupuesto global. */
  categoryId: string | null;
  amountCents: number;
}

export interface Settings {
  currency: CurrencyCode;
  /** Día del mes (1-28) en que empieza el periodo mensual. */
  monthStartDay: number;
}

export const DEFAULT_SETTINGS: Settings = { currency: 'EUR', monthStartDay: 1 };
