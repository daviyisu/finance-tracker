import { CapacitorSQLite, SQLiteConnection } from '@capacitor-community/sqlite';

import { SqlDriver, SqlValue } from './sql-driver';

/** SQLite nativo de iOS/Android a través de @capacitor-community/sqlite. */
export async function openNativeDriver(name: string): Promise<SqlDriver> {
  const sqlite = new SQLiteConnection(CapacitorSQLite);
  const consistent = (await sqlite.checkConnectionsConsistency()).result;
  const exists = (await sqlite.isConnection(name, false)).result;
  const db =
    consistent && exists
      ? await sqlite.retrieveConnection(name, false)
      : await sqlite.createConnection(name, false, 'no-encryption', 1, false);
  await db.open();
  await db.execute('PRAGMA foreign_keys = ON;', false);

  return {
    async query<T>(statement: string, values: SqlValue[] = []) {
      return ((await db.query(statement, values)).values ?? []) as T[];
    },
    async run(statement: string, values: SqlValue[] = []) {
      await db.run(statement, values, true);
    },
    async executeScript(script: string) {
      await db.execute(script, true);
    },
  };
}
