import { SqlDriver, SqlValue } from './sql-driver';

/**
 * SQLite en el navegador (solo para desarrollo con `npm start`), con sql.js.
 * La base vive en memoria y se guarda en localStorage tras cada escritura.
 */
export async function openWebDriver(name: string): Promise<SqlDriver> {
  const { default: initSqlJs } = await import('sql.js');
  // sql-wasm.wasm y sql-wasm-browser.wasm son el mismo binario; se copia el primero a assets/.
  const SQL = await initSqlJs({ locateFile: () => '/assets/sql-wasm.wasm' });
  const key = `sqlite:${name}`;

  const saved = readStorage(key);
  const db = saved ? new SQL.Database(saved) : new SQL.Database();
  db.run('PRAGMA foreign_keys = ON;');

  const persist = () => writeStorage(key, db.export());

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
      persist();
    },
    async executeScript(script: string) {
      try {
        db.exec(`BEGIN;\n${script}\nCOMMIT;`);
      } catch (error) {
        db.exec('ROLLBACK;');
        throw error;
      }
      persist();
    },
  };
}

function readStorage(key: string): Uint8Array | null {
  try {
    const base64 = localStorage.getItem(key);
    if (!base64) return null;
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

function writeStorage(key: string, bytes: Uint8Array): void {
  try {
    let binary = '';
    for (let i = 0; i < bytes.length; i += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    }
    localStorage.setItem(key, btoa(binary));
  } catch (error) {
    console.warn('No se pudo guardar la base en el navegador', error);
  }
}
