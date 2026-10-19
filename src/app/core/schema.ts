import { DEFAULT_CATEGORIES } from './categories';
import { DEFAULT_SETTINGS } from './models';

const sql = (value: string | number) => (typeof value === 'number' ? String(value) : `'${value.replace(/'/g, "''")}'`);

/**
 * Migraciones en orden. La posición +1 es la versión del esquema (PRAGMA user_version).
 * Nunca se edita una migración ya publicada: se añade una nueva al final.
 */
export const MIGRATIONS: string[] = [
  `
  CREATE TABLE categories (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('expense', 'income')),
    icon TEXT NOT NULL,
    color TEXT NOT NULL,
    sort_order INTEGER NOT NULL,
    archived INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE movements (
    id TEXT PRIMARY KEY NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('expense', 'income')),
    amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
    category_id TEXT NOT NULL REFERENCES categories (id),
    occurred_at TEXT NOT NULL,
    note TEXT,
    created_at TEXT NOT NULL
  );
  CREATE INDEX idx_movements_occurred_at ON movements (occurred_at);
  CREATE INDEX idx_movements_category ON movements (category_id, occurred_at);

  CREATE TABLE budgets (
    id TEXT PRIMARY KEY NOT NULL,
    category_id TEXT REFERENCES categories (id),
    amount_cents INTEGER NOT NULL CHECK (amount_cents > 0)
  );
  CREATE UNIQUE INDEX idx_budgets_category ON budgets (IFNULL(category_id, ''));

  CREATE TABLE settings (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
  );

  ${DEFAULT_CATEGORIES.map(
    (c) =>
      `INSERT INTO categories (id, name, type, icon, color, sort_order) VALUES (${[c.id, c.name, c.type, c.icon, c.color, c.sortOrder].map(sql).join(', ')});`,
  ).join('\n  ')}

  INSERT INTO settings (key, value) VALUES ('currency', ${sql(DEFAULT_SETTINGS.currency)});
  INSERT INTO settings (key, value) VALUES ('monthStartDay', ${sql(String(DEFAULT_SETTINGS.monthStartDay))});
  `,
];
