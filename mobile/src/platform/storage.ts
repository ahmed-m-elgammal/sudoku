// ASSIZE mobile — storage.
//
// Replaces the web build's IndexedDB (src/state/idb.ts) and localStorage.
//
// Design: MMKV for the hot key/value path (save blob, identity, the secret pointer,
// the pending Ink queue) because it is synchronous and survives app kills; the
// secrets themselves go to the Keychain/Keystore; the echo ring — the only
// list-shaped data — goes to SQLite because it is queried and trimmed by count.
//
// Tiered fallback hierarchy:
//   1. MMKV (fastest, Nitro module)
//   2. AsyncStorage (Nitro module)
//   3. FileSystem-backed memory tier (works in Expo Go where Nitro is absent,
//      persisting saves across reloads via expo-file-system).

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { MMKV } from 'react-native-mmkv';
import * as ExpoSecureStore from 'expo-secure-store';
import type { PlatformStorage, SecureStore, StoreName } from './types';

export type StorageBackend = 'mmkv' | 'asyncstorage' | 'fs';

let backend: StorageBackend | null = null;
let mmkv: MMKV | null = null;
let mmkvFailed = false;
let asyncStorageFailed = false;

const mmkvKey = (store: StoreName, key: string) => `${store}/${key}`;

let probe: Promise<StorageBackend> | null = null;

// ---- Tier 3: In-memory store with FileSystem persistence for Expo Go
const memStore = new Map<string, string>();
let fsInitialized = false;

async function initFsStorage(): Promise<void> {
  if (fsInitialized) return;
  fsInitialized = true;
  try {
    const FileSystem = await import('expo-file-system/legacy');
    const dir = FileSystem.documentDirectory;
    if (!dir) return;
    const fileUri = `${dir}assize_storage.json`;
    const info = await FileSystem.getInfoAsync(fileUri);
    if (info.exists) {
      const raw = await FileSystem.readAsStringAsync(fileUri);
      const data = JSON.parse(raw) as Record<string, string>;
      for (const [k, v] of Object.entries(data)) {
        memStore.set(k, v);
      }
    }
  } catch {
    // Pure in-memory fallback
  }
}

async function persistFsStorage(): Promise<void> {
  try {
    const FileSystem = await import('expo-file-system/legacy');
    const dir = FileSystem.documentDirectory;
    if (!dir) return;
    const fileUri = `${dir}assize_storage.json`;
    const obj: Record<string, string> = {};
    for (const [k, v] of memStore.entries()) {
      obj[k] = v;
    }
    await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(obj));
  } catch {
    // Silently continue
  }
}

/**
 * Resolve the fastest available backend ONCE, and remember the verdict.
 * Probes MMKV -> AsyncStorage -> FileSystem. In Expo Go where Nitro modules
 * throw, safely falls back to FileSystem-backed memory tier.
 */
function resolveBackend(): Promise<StorageBackend> {
  if (probe) return probe;
  probe = (async () => {
    // 1. Probe MMKV
    if (!mmkvFailed) {
      try {
        const { createMMKV } = (await import('react-native-mmkv')) as {
          createMMKV: (c?: { id?: string }) => MMKV;
        };
        const inst = createMMKV({ id: 'assize' });
        inst.set('__probe', '1');
        const ok = inst.getString('__probe') === '1';
        inst.remove('__probe');
        if (ok) {
          mmkv = inst;
          backend = 'mmkv';
          return backend;
        }
      } catch {
        mmkvFailed = true;
        mmkv = null;
      }
    }

    // 2. Probe AsyncStorage
    if (!asyncStorageFailed) {
      try {
        if (AsyncStorage && typeof AsyncStorage.setItem === 'function') {
          await AsyncStorage.setItem('__probe', '1');
          const ok = (await AsyncStorage.getItem('__probe')) === '1';
          await AsyncStorage.removeItem('__probe');
          if (ok) {
            backend = 'asyncstorage';
            return backend;
          }
        }
      } catch {
        asyncStorageFailed = true;
      }
    }

    // 3. Fallback to FileSystem-backed memory tier
    await initFsStorage();
    backend = 'fs';
    return backend;
  })();
  return probe;
}

/** Which backend is live — surfaced in Settings > About, useful in bug reports. */
export async function storageBackend(): Promise<StorageBackend> {
  return resolveBackend();
}

export const storage: PlatformStorage = {
  async get<T>(store: StoreName, key: string): Promise<T | undefined> {
    try {
      const b = await resolveBackend();
      let raw: string | null | undefined;
      if (b === 'mmkv') {
        raw = mmkv!.getString(mmkvKey(store, key));
      } else if (b === 'asyncstorage') {
        raw = await AsyncStorage.getItem(mmkvKey(store, key));
      } else {
        await initFsStorage();
        raw = memStore.get(mmkvKey(store, key));
      }
      if (raw === undefined || raw === null) return undefined;
      return JSON.parse(raw) as T;
    } catch {
      return undefined;
    }
  },

  async set(store: StoreName, key: string, value: unknown): Promise<void> {
    const raw = JSON.stringify(value);
    const b = await resolveBackend();
    if (b === 'mmkv') {
      mmkv!.set(mmkvKey(store, key), raw);
    } else if (b === 'asyncstorage') {
      await AsyncStorage.setItem(mmkvKey(store, key), raw);
    } else {
      await initFsStorage();
      memStore.set(mmkvKey(store, key), raw);
      void persistFsStorage();
    }
  },

  async del(store: StoreName, key: string): Promise<void> {
    const b = await resolveBackend();
    if (b === 'mmkv') {
      mmkv!.remove(mmkvKey(store, key));
    } else if (b === 'asyncstorage') {
      await AsyncStorage.removeItem(mmkvKey(store, key));
    } else {
      await initFsStorage();
      memStore.delete(mmkvKey(store, key));
      void persistFsStorage();
    }
  },

  async clearAll(): Promise<void> {
    const b = await resolveBackend();
    if (b === 'mmkv') {
      mmkv!.clearAll();
      return;
    }
    if (b === 'asyncstorage') {
      const all = await AsyncStorage.getAllKeys();
      await AsyncStorage.removeMany(all.filter((k) => k.startsWith('assize')));
      return;
    }
    await initFsStorage();
    for (const k of Array.from(memStore.keys())) {
      if (k.startsWith('assize')) memStore.delete(k);
    }
    void persistFsStorage();
  },

  async keys(store: StoreName): Promise<string[]> {
    const prefix = `${store}/`;
    const b = await resolveBackend();
    if (b === 'mmkv') {
      return mmkv!
        .getAllKeys()
        .filter((k) => k.startsWith(prefix))
        .map((k) => k.slice(prefix.length))
        .sort();
    }
    if (b === 'asyncstorage') {
      const all = await AsyncStorage.getAllKeys();
      return all.filter((k) => k.startsWith(prefix)).map((k) => k.slice(prefix.length)).sort();
    }
    await initFsStorage();
    return Array.from(memStore.keys())
      .filter((k) => k.startsWith(prefix))
      .map((k) => k.slice(prefix.length))
      .sort();
  },
};

// ------------------------------------------------------------------ secrets
const SECRET_KEY = 'assize.secret';
const RECOVERY_HASH_KEY = 'assize.recoveryHash';

/**
 * The guest secret and the recovery hash. In the web build these sat in IndexedDB
 * in the clear; on a phone that is a real credential, so they go to the Keychain.
 */
export const secrets: SecureStore & {
  getSecret(): Promise<string>;
  setSecret(v: string): Promise<void>;
  getRecoveryHash(): Promise<string | null>;
  setRecoveryHash(v: string | null): Promise<void>;
} = {
  async get(key: string) {
    try {
      return await ExpoSecureStore.getItemAsync(key);
    } catch {
      return memStore.get(`secret:${key}`) ?? null;
    }
  },
  async set(key: string, value: string) {
    try {
      await ExpoSecureStore.setItemAsync(key, value);
    } catch {
      memStore.set(`secret:${key}`, value);
      void persistFsStorage();
    }
  },
  async del(key: string) {
    try {
      await ExpoSecureStore.deleteItemAsync(key);
    } catch {
      memStore.delete(`secret:${key}`);
      void persistFsStorage();
    }
  },
  async getSecret() {
    return (await this.get(SECRET_KEY)) ?? '';
  },
  async setSecret(v: string) {
    await this.set(SECRET_KEY, v);
  },
  async getRecoveryHash() {
    return this.get(RECOVERY_HASH_KEY);
  },
  async setRecoveryHash(v: string | null) {
    if (v === null) await this.del(RECOVERY_HASH_KEY);
    else await this.set(RECOVERY_HASH_KEY, v);
  },
};

// ------------------------------------------------------------------ SQLite
// A tiny promise wrapper so the echo ring speaks the same shape as the web build's
// IndexedDB calls, and so the jest double (a Map) satisfies the same contract.
export interface SqlRow {
  key: string;
  payload: string;
  savedAt: number;
  imported: number;
}

export interface SqlPort {
  put(row: SqlRow): Promise<void>;
  all(): Promise<SqlRow[]>;
  remove(key: string): Promise<void>;
  clear(): Promise<void>;
}

let sqlDb: import('expo-sqlite').SQLiteDatabase | null = null;
let sqlReady: Promise<import('expo-sqlite').SQLiteDatabase | null> | null = null;
const sqlMemStore = new Map<string, SqlRow>();
let sqlFailed = false;

async function openSql(): Promise<import('expo-sqlite').SQLiteDatabase | null> {
  if (sqlFailed) return null;
  if (sqlDb) return sqlDb;
  if (!sqlReady) {
    sqlReady = (async () => {
      try {
        const { openDatabaseAsync } = await import('expo-sqlite');
        const db = await openDatabaseAsync('assize.db');
        await db.execAsync(
          `CREATE TABLE IF NOT EXISTS duels (
             key TEXT PRIMARY KEY NOT NULL,
             payload TEXT NOT NULL,
             savedAt INTEGER NOT NULL,
             imported INTEGER NOT NULL DEFAULT 0
           );`,
        );
        return db;
      } catch {
        sqlFailed = true;
        return null;
      }
    })();
  }
  sqlDb = await sqlReady;
  return sqlDb;
}

export const sql: SqlPort = {
  async put(row) {
    const db = await openSql();
    if (!db) {
      sqlMemStore.set(row.key, { ...row });
      return;
    }
    await db.runAsync(
      `INSERT INTO duels (key, payload, savedAt, imported) VALUES (?, ?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET payload = excluded.payload,
         savedAt = excluded.savedAt, imported = excluded.imported`,
      row.key,
      row.payload,
      row.savedAt,
      row.imported,
    );
  },
  async all() {
    const db = await openSql();
    if (!db) {
      return Array.from(sqlMemStore.values()).sort((a, b) => b.savedAt - a.savedAt);
    }
    const rows = await db.getAllAsync<SqlRow>(
      'SELECT key, payload, savedAt, imported FROM duels ORDER BY savedAt DESC',
    );
    return rows ?? [];
  },
  async remove(key: string) {
    const db = await openSql();
    if (!db) {
      sqlMemStore.delete(key);
      return;
    }
    await db.runAsync('DELETE FROM duels WHERE key = ?', key);
  },
  async clear() {
    const db = await openSql();
    if (!db) {
      sqlMemStore.clear();
      return;
    }
    await db.runAsync('DELETE FROM duels');
  },
};

/** Test seam: forget the resolved backends so a suite can re-probe. */
export function __resetStorageBackends(): void {
  backend = null;
  mmkv = null;
  mmkvFailed = false;
  asyncStorageFailed = false;
  probe = null;
  sqlDb = null;
  sqlReady = null;
  sqlFailed = false;
  memStore.clear();
  fsInitialized = false;
  sqlMemStore.clear();
}

/**
 * Force a backend (tests, and a Settings > About row reporting which one is live).
 * 'auto' restores the probe.
 */
export function __forceStorageBackend(which: StorageBackend | 'auto'): void {
  __resetStorageBackends();
  if (which === 'auto') return;
  backend = which;
  mmkvFailed = which !== 'mmkv';
  asyncStorageFailed = which !== 'asyncstorage';
  probe = Promise.resolve(which);
}
