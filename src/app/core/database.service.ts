import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';

import { MIGRATIONS } from './schema';
import { SqlDriver, SqlValue } from './sql-driver';

const DB_NAME = 'finance_tracker';

/**
 * Conexión única a la base SQLite local: nativa en iOS/Android
 * y sql.js en el navegador mientras se desarrolla.
 */
@Injectable({ providedIn: 'root' })
export class DatabaseService {
  private driver?: Promise<SqlDriver>;

  async query<T>(statement: string, values: SqlValue[] = []): Promise<T[]> {
    return (await this.db()).query<T>(statement, values);
  }

  async run(statement: string, values: SqlValue[] = []): Promise<void> {
    await (await this.db()).run(statement, values);
  }

  private db(): Promise<SqlDriver> {
    this.driver ??= this.open().catch((error) => {
      this.driver = undefined;
      throw error;
    });
    return this.driver;
  }

  private async open(): Promise<SqlDriver> {
    const driver =
      Capacitor.getPlatform() === 'web'
        ? await (await import('./web-driver')).openWebDriver(DB_NAME)
        : await (await import('./native-driver')).openNativeDriver(DB_NAME);
    await this.migrate(driver);
    return driver;
  }

  private async migrate(driver: SqlDriver): Promise<void> {
    const rows = await driver.query<{ user_version: number }>('PRAGMA user_version;');
    const current = Number(rows[0]?.user_version ?? 0);
    for (let version = current; version < MIGRATIONS.length; version++) {
      await driver.executeScript(`${MIGRATIONS[version]}\nPRAGMA user_version = ${version + 1};`);
    }
  }
}
