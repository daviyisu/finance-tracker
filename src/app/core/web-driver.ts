import { SqlDriver, SqlStatement, SqlValue } from './sql-driver';
import { DatabaseStorage, openDatabaseStorage } from './web-storage';

/**
 * SQLite en el navegador (PWA y `npm start`), con sql.js.
 * La base vive en memoria y se guarda en IndexedDB tras cada escritura.
 */
export async function openWebDriver(name: string): Promise<SqlDriver> {
  requestPersistentStorage();
  const { default: initSqlJs } = await import('sql.js');
  // sql-wasm.wasm y sql-wasm-browser.wasm son el mismo binario; se copia el primero a assets/.
  const SQL = await initSqlJs({ locateFile: () => '/assets/sql-wasm.wasm' });
  const storage = await openStorage(name);

  const saved = await storage?.load();
  const db = saved ? new SQL.Database(saved) : new SQL.Database();
  db.run('PRAGMA foreign_keys = ON;');

  // Se espera a que IndexedDB confirme la escritura; si falla, el error llega a quien guardaba.
  const persist = async () => {
    await storage?.save(db.export());
  };

  return {
    async query<T>(statement: string, values: SqlValue[] = []) {
      const stmt = db.prepare(statement);
      try {
        stmt.bind(values);
        const rows: T[] = [];
        while (stmt.step()) rows.push(stmt.getAsObject() as T);
        return rows;
      } finally {
        stmt.free();
      }
    },
    async run(statement: string, values: SqlValue[] = []) {
      db.run(statement, values);
      await persist();
    },
    async executeScript(script: string) {
      try {
        db.exec(`BEGIN;\n${script}\nCOMMIT;`);
      } catch (error) {
        db.exec('ROLLBACK;');
        throw error;
      }
      await persist();
    },
    async runBatch(statements: SqlStatement[]) {
      db.exec('BEGIN;');
      try {
        for (const { statement, values } of statements) db.run(statement, values);
        db.exec('COMMIT;');
      } catch (error) {
        db.exec('ROLLBACK;');
        throw error;
      }
      await persist();
    },
  };
}

/** Sin IndexedDB (p. ej. algunos modos privados) la app funciona, pero solo en memoria. */
async function openStorage(name: string): Promise<DatabaseStorage | null> {
  try {
    return await openDatabaseStorage(name);
  } catch (error) {
    console.warn('IndexedDB no disponible: los datos no se guardarán al cerrar la app', error);
    return null;
  }
}

/** Pide al navegador que no borre los datos de la PWA cuando falte espacio. */
function requestPersistentStorage(): void {
  navigator.storage?.persist?.().catch(() => undefined);
}
