/**
 * Guarda el binario de la base SQLite del navegador en IndexedDB.
 * Una entrada por base, en el almacén `databases` de la base IndexedDB `finance-tracker`.
 */

const IDB_NAME = 'finance-tracker';
const IDB_VERSION = 1;
const STORE = 'databases';

/** Prefijo con el que se guardaba en localStorage antes de usar IndexedDB. */
const LEGACY_PREFIX = 'sqlite:';

export interface DatabaseStorage {
  load(): Promise<Uint8Array | null>;
  save(bytes: Uint8Array): Promise<void>;
}

/**
 * Abre el almacenamiento de la base `name`. Si aún no hay nada en IndexedDB
 * pero sí una copia antigua en localStorage, la mueve a IndexedDB.
 */
export async function openDatabaseStorage(name: string): Promise<DatabaseStorage> {
  const idb = await openIdb();
  const storage: DatabaseStorage = {
    load: () => request<Uint8Array | undefined>(idb, 'readonly', (store) => store.get(name)).then(toBytes),
    save: (bytes) => request(idb, 'readwrite', (store) => store.put(bytes, name)).then(() => undefined),
  };
  await migrateFromLocalStorage(name, storage);
  return storage;
}

async function migrateFromLocalStorage(name: string, storage: DatabaseStorage): Promise<void> {
  const key = LEGACY_PREFIX + name;
  const legacy = readLegacy(key);
  if (!legacy) return;
  if (!(await storage.load())) await storage.save(legacy);
  try {
    localStorage.removeItem(key);
  } catch {
    // Si no se puede borrar no pasa nada: IndexedDB ya tiene prioridad.
  }
}

function readLegacy(key: string): Uint8Array | null {
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

function openIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('IndexedDB bloqueado por otra pestaña'));
  });
}

/** Ejecuta una operación y espera a que su transacción termine (datos ya en disco). */
function request<T>(
  idb: IDBDatabase,
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(STORE, mode);
    const req = operation(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(req.result as T);
    tx.onerror = () => reject(tx.error ?? req.error);
    tx.onabort = () => reject(tx.error ?? new Error('Transacción de IndexedDB cancelada'));
  });
}

function toBytes(value: unknown): Uint8Array | null {
  if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  if (Object.prototype.toString.call(value) === '[object ArrayBuffer]') return new Uint8Array(value as ArrayBuffer);
  return null;
}
