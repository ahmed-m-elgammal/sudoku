// IndexedDB persistence with a versioned schema + migrations (spec §6).
'use client';

const DB_NAME = 'assize';
const DB_VERSION = 2;

export const STORES = ['identity', 'save', 'duels', 'notes'] as const;
export type StoreName = (typeof STORES)[number];

let dbPromise: Promise<IDBDatabase> | null = null;

function migrate(db: IDBDatabase, oldVersion: number) {
  // v1: identity, save. v2: + duels (replays), notes (marginalia journal).
  if (oldVersion < 1) {
    db.createObjectStore('identity');
    db.createObjectStore('save');
  }
  if (oldVersion < 2) {
    db.createObjectStore('duels');
    db.createObjectStore('notes');
  }
}

export function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => migrate(req.result, req.result.version === 1 ? 1 : req.transaction?.oldVersion ?? 0);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

export async function idbGet<T>(store: StoreName, key: string): Promise<T | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}

export async function idbSet(store: StoreName, key: string, value: unknown): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function idbDel(store: StoreName, key: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function idbClearAll(): Promise<void> {
  const db = await openDb();
  await Promise.all(STORES.map((s) => new Promise<void>((resolve, reject) => {
    const tx = db.transaction(s, 'readwrite');
    tx.objectStore(s).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  })));
}
