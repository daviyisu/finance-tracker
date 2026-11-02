import { Backup, BackupError, parseBackup, restoreStatements } from './backup';

const columns = {
  categories: ['id', 'name', 'type', 'icon', 'color', 'sort_order', 'archived'],
  settings: ['key', 'value'],
  movements: ['id', 'type', 'amount_cents', 'category_id', 'occurred_at', 'note', 'created_at'],
  budgets: ['id', 'category_id', 'amount_cents'],
};

const backup = (overrides: Record<string, unknown> = {}) =>
  JSON.stringify({
    app: 'finance-tracker',
    format: 1,
    schemaVersion: 1,
    exportedAt: '2026-11-02T10:00:00.000Z',
    tables: {
      categories: [{ id: 'food', name: 'Comida', type: 'expense', icon: 'cart-outline', color: '#000', sort_order: 1, archived: 0 }],
      settings: [{ key: 'currency', value: 'EUR' }],
      movements: [
        { id: 'm1', type: 'expense', amount_cents: 1240, category_id: 'food', occurred_at: '2026-11-01T12:00', note: null, created_at: '2026-11-01T12:00' },
      ],
      budgets: [],
    },
    ...overrides,
  });

describe('backup', () => {
  it('acepta una copia válida', () => {
    const parsed = parseBackup(backup(), 1);
    expect(parsed.tables.movements.length).toBe(1);
    expect(parsed.exportedAt).toBe('2026-11-02T10:00:00.000Z');
  });

  it('rechaza archivos que no son copias', () => {
    expect(() => parseBackup('no es json', 1)).toThrow(BackupError);
    expect(() => parseBackup('{"hola":1}', 1)).toThrow(BackupError);
    expect(() => parseBackup(backup({ app: 'otra-app' }), 1)).toThrow(BackupError);
    expect(() => parseBackup(backup({ format: 2 }), 1)).toThrow(BackupError);
  });

  it('rechaza copias de una versión más nueva de la app', () => {
    expect(() => parseBackup(backup({ schemaVersion: 2 }), 1)).toThrow(/más nueva/);
  });

  it('rechaza tablas que faltan o valores raros', () => {
    expect(() => parseBackup(backup({ tables: { categories: [], settings: [], movements: [] } }), 1)).toThrow(/budgets/);
    expect(() =>
      parseBackup(backup({ tables: { categories: [], settings: [], movements: [{ id: { x: 1 } }], budgets: [] } }), 1),
    ).toThrow(/movements/);
  });

  it('borra todo y luego inserta en orden, con parámetros', () => {
    const statements = restoreStatements(parseBackup(backup(), 1), columns);

    expect(statements.slice(0, 4).map((s) => s.statement)).toEqual([
      'DELETE FROM budgets',
      'DELETE FROM movements',
      'DELETE FROM settings',
      'DELETE FROM categories',
    ]);
    expect(statements.slice(4).map((s) => s.statement.split(' (')[0])).toEqual([
      'INSERT INTO categories',
      'INSERT INTO settings',
      'INSERT INTO movements',
    ]);
    expect(statements[6]).toEqual({
      statement:
        'INSERT INTO movements (id, type, amount_cents, category_id, occurred_at, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      values: ['m1', 'expense', 1240, 'food', '2026-11-01T12:00', null, '2026-11-01T12:00'],
    });
  });

  it('no deja meter columnas que no existen (ni SQL en los nombres)', () => {
    const evil: Backup = parseBackup(backup(), 1);
    evil.tables.settings = [{ key: 'a', 'value) VALUES (1); DROP TABLE movements; --': 'x' }];
    expect(() => restoreStatements(evil, columns)).toThrow(BackupError);
  });
});
