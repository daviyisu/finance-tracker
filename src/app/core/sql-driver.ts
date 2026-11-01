export type SqlValue = string | number | null;

/** Lo mínimo que la app necesita de una base SQLite. */
export interface SqlDriver {
  query<T>(statement: string, values?: SqlValue[]): Promise<T[]>;
  run(statement: string, values?: SqlValue[]): Promise<void>;
  /** Ejecuta varias sentencias seguidas dentro de una transacción. */
  executeScript(script: string): Promise<void>;
}
