import { Injectable, inject } from '@angular/core';

import { DatabaseService } from './database.service';
import { MIGRATIONS } from './schema';
import { SqlStatement, SqlValue } from './sql-driver';

/**
 * Copia de seguridad completa en JSON: todas las filas de todas las tablas.
 * Se lee y escribe con SQL normal, así que el mismo archivo vale para la PWA y para la app nativa.
 */

export const BACKUP_APP = 'finance-tracker';
export const BACKUP_FORMAT = 1;

/** Tablas en orden de inserción (primero las que otras referencian). */
export const BACKUP_TABLES = ['categories', 'settings', 'movements', 'budgets'] as const;
export type BackupTable = (typeof BACKUP_TABLES)[number];

export type BackupRow = Record<string, SqlValue>;

export interface Backup {
  app: typeof BACKUP_APP;
  format: number;
  schemaVersion: number;
  exportedAt: string;
  tables: Record<BackupTable, BackupRow[]>;
}

export class BackupError extends Error {}

/** Comprueba que un texto es una copia válida y la devuelve tipada. */
export function parseBackup(text: string, currentSchemaVersion: number): Backup {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new BackupError('El archivo no es una copia de seguridad válida.');
  }
  if (!isObject(data) || data['app'] !== BACKUP_APP || !isObject(data['tables'])) {
    throw new BackupError('El archivo no es una copia de seguridad de Finance Tracker.');
  }
  if (data['format'] !== BACKUP_FORMAT) {
    throw new BackupError('Esta copia tiene un formato que esta versión de la app no entiende.');
  }
  const schemaVersion = data['schemaVersion'];
  if (typeof schemaVersion !== 'number' || !Number.isInteger(schemaVersion) || schemaVersion < 1) {
    throw new BackupError('La copia no indica su versión.');
  }
  if (schemaVersion > currentSchemaVersion) {
    throw new BackupError('Esta copia es de una versión más nueva de la app. Actualiza la app e inténtalo de nuevo.');
  }

  const tables = data['tables'];
  for (const table of BACKUP_TABLES) {
    const rows = tables[table];
    if (!Array.isArray(rows) || !rows.every(isRow)) {
      throw new BackupError(`La copia está dañada (tabla ${table}).`);
    }
  }
  return {
    app: BACKUP_APP,
    format: BACKUP_FORMAT,
    schemaVersion,
    exportedAt: typeof data['exportedAt'] === 'string' ? data['exportedAt'] : '',
    tables: tables as Record<BackupTable, BackupRow[]>,
  };
}

/**
 * Sentencias para sustituir todos los datos por los de la copia.
 * Solo se aceptan columnas que existen en la tabla (`columns`); los valores van siempre como parámetros.
 */
export function restoreStatements(backup: Backup, columns: Record<BackupTable, string[]>): SqlStatement[] {
  const statements: SqlStatement[] = [...BACKUP_TABLES]
    .reverse()
    .map((table) => ({ statement: `DELETE FROM ${table}`, values: [] }));

  for (const table of BACKUP_TABLES) {
    const known = new Set(columns[table]);
    for (const row of backup.tables[table]) {
      const keys = Object.keys(row);
      const unknown = keys.find((k) => !known.has(k));
      if (unknown) throw new BackupError(`La copia tiene una columna desconocida (${table}.${unknown}).`);
      if (keys.length === 0) continue;
      statements.push({
        statement: `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`,
        values: keys.map((k) => row[k]),
      });
    }
  }
  return statements;
}

@Injectable({ providedIn: 'root' })
export class BackupService {
  private readonly db = inject(DatabaseService);

  async create(): Promise<Backup> {
    const tables = {} as Record<BackupTable, BackupRow[]>;
    for (const table of BACKUP_TABLES) {
      tables[table] = await this.db.query<BackupRow>(`SELECT * FROM ${table}`);
    }
    return {
      app: BACKUP_APP,
      format: BACKUP_FORMAT,
      schemaVersion: await this.db.schemaVersion(),
      exportedAt: new Date().toISOString(),
      tables,
    };
  }

  /** Lee y valida un archivo de copia, sin tocar todavía los datos. */
  async read(text: string): Promise<Backup> {
    return parseBackup(text, Math.max(await this.db.schemaVersion(), MIGRATIONS.length));
  }

  /** Sustituye todos los datos por los de la copia, en una sola transacción. */
  async restore(backup: Backup): Promise<void> {
    const columns = {} as Record<BackupTable, string[]>;
    for (const table of BACKUP_TABLES) {
      const info = await this.db.query<{ name: string }>(`PRAGMA table_info(${table})`);
      columns[table] = info.map((c) => c.name);
    }
    await this.db.runBatch(restoreStatements(backup, columns));
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isRow(value: unknown): value is BackupRow {
  return (
    isObject(value) &&
    Object.values(value).every((v) => v === null || typeof v === 'string' || (typeof v === 'number' && Number.isFinite(v)))
  );
}
