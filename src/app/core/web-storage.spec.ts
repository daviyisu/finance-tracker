import { IDBFactory } from 'fake-indexeddb';

import { openDatabaseStorage } from './web-storage';

describe('web-storage', () => {
  beforeEach(() => {
    globalThis.indexedDB = new IDBFactory();
    localStorage.clear();
  });

  it('devuelve null si aún no hay base guardada', async () => {
    const storage = await openDatabaseStorage('test');
    expect(await storage.load()).toBeNull();
  });

  it('guarda y recupera los bytes, también tras reabrir', async () => {
    await (await openDatabaseStorage('test')).save(new Uint8Array([1, 2, 3]));
    await (await openDatabaseStorage('test')).save(new Uint8Array([4, 5]));

    const reopened = await openDatabaseStorage('test');
    expect(Array.from((await reopened.load())!)).toEqual([4, 5]);
  });

  it('separa las bases por nombre', async () => {
    await (await openDatabaseStorage('a')).save(new Uint8Array([1]));
    expect(await (await openDatabaseStorage('b')).load()).toBeNull();
  });

  it('migra la copia antigua de localStorage y la borra', async () => {
    localStorage.setItem('sqlite:test', btoa(String.fromCharCode(7, 8, 9)));

    const storage = await openDatabaseStorage('test');

    expect(Array.from((await storage.load())!)).toEqual([7, 8, 9]);
    expect(localStorage.getItem('sqlite:test')).toBeNull();
  });

  it('no pisa lo que ya hay en IndexedDB con la copia de localStorage', async () => {
    await (await openDatabaseStorage('test')).save(new Uint8Array([1]));
    localStorage.setItem('sqlite:test', btoa(String.fromCharCode(9)));

    const storage = await openDatabaseStorage('test');

    expect(Array.from((await storage.load())!)).toEqual([1]);
    expect(localStorage.getItem('sqlite:test')).toBeNull();
  });
});
