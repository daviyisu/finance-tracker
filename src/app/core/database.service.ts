import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { CapacitorSQLite, SQLiteConnection, SQLiteDBConnection } from '@capacitor-community/sqlite';

import { MIGRATIONS } from './schema';

const DB_NAME = 'finance_tracker';

type SqlValue = string | number | null;

/**
 * Conexión única a la base SQLite local.
 * En iOS/Android usa el SQLite nativo; en el navegador (ionic serve) usa jeep-sqlite,
 * que guarda la base en IndexedDB.
 */
@Injectable({ providedIn: 'root' })
export class DatabaseService {
  private readonly sqlite = new SQLiteConnection(CapacitorSQLite);
  private readonly isWeb = Capacitor.getPlatform() === 'web';
  private connection?: Promise<SQLiteDBConnection>;

  async query<T>(statement: string, values: SqlValue[] = []): Promise<T[]> {
    const db = await this.db();
    const result = await db.query(statement, values);
    return (result.values ?? []) as T[];
  }

  async run(statement: string, values: SqlValue[] = []): Promise<void> {
    const db = await this.db();
    await db.run(statement, values, true);
    await this.persist();
  }

  private db(): Promise<SQLiteDBConnection> {
    this.connection ??= this.open().catch((error) => {
      this.connection = undefined;
      throw error;
    });
    return this.connection;
  }

  private async open(): Promise<SQLiteDBConnection> {
    if (this.isWeb) {
      await this.prepareWebStore();
    }
    const consistent = (await this.sqlite.checkConnectionsConsistency()).result;
    const exists = (await this.sqlite.isConnection(DB_NAME, false)).result;
    const db =
      consistent && exists
        ? await this.sqlite.retrieveConnection(DB_NAME, false)
        : await this.sqlite.createConnection(DB_NAME, false, 'no-encryption', 1, false);
    await db.open();
    await db.execute('PRAGMA foreign_keys = ON;', false);
    await this.migrate(db);
    return db;
  }

  private async migrate(db: SQLiteDBConnection): Promise<void> {
    const rows = (await db.query('PRAGMA user_version;')).values ?? [];
    const current = Number(rows[0]?.user_version ?? 0);
    for (let version = current; version < MIGRATIONS.length; version++) {
      await db.execute(`${MIGRATIONS[version]}\nPRAGMA user_version = ${version + 1};`, true);
    }
    if (current < MIGRATIONS.length) {
      await this.persist();
    }
  }

  private async prepareWebStore(): Promise<void> {
    if (!document.querySelector('jeep-sqlite')) {
      document.body.appendChild(document.createElement('jeep-sqlite'));
    }
    await customElements.whenDefined('jeep-sqlite');
    await this.sqlite.initWebStore();
  }

  /** En el navegador hay que volcar la base a IndexedDB tras cada escritura. */
  private async persist(): Promise<void> {
    if (this.isWeb) {
      await this.sqlite.saveToStore(DB_NAME);
    }
  }
}
