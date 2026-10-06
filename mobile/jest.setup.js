/* ASSIZE mobile — jest environment setup.
 *
 * Native modules that have no JS-only implementation are replaced with the
 * smallest honest double: the code under test must never crash because a native
 * side is absent, and must never silently "succeed" in a way that hides a bug.
 */

// expo-secure-store: an in-memory keychain. Mirrors the real API surface used.
jest.mock('expo-secure-store', () => {
  const store = new Map();
  return {
    __store: store,
    getItemAsync: jest.fn(async (k) => (store.has(k) ? store.get(k) : null)),
    setItemAsync: jest.fn(async (k, v) => { store.set(k, v); }),
    deleteItemAsync: jest.fn(async (k) => { store.delete(k); }),
    isAvailableAsync: jest.fn(async () => true),
  };
});

// expo-haptics: record calls, never throw (hardware may be absent).
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(async () => {}),
  notificationAsync: jest.fn(async () => {}),
  selectionAsync: jest.fn(async () => {}),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy', Rigid: 'rigid', Soft: 'soft' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
  NotificationFeedbackStyle: { Success: 'success', Warning: 'warning', Error: 'error' },
}));

// expo-audio: no real audio in tests; the adapter must degrade, not crash.
jest.mock('expo-audio', () => ({
  createAudioPlayer: jest.fn(() => ({
    play: jest.fn(), pause: jest.fn(), remove: jest.fn(), seekTo: jest.fn(),
    volume: 1, loop: false, muted: false, currentTime: 0, duration: 0,
  })),
  setAudioModeAsync: jest.fn(async () => {}),
  AudioModule: {},
}));

// expo-clipboard
jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn(async () => true),
  getStringAsync: jest.fn(async () => ''),
}));

// expo-sharing / expo-file-system
jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(async () => false),
  shareAsync: jest.fn(async () => {}),
}));
jest.mock('expo-file-system', () => ({
  Paths: { cache: { uri: 'file:///cache/' }, document: { uri: 'file:///document/' } },
  File: class { constructor() {} write() {} text() { return ''; } delete() {} exists() { return false; } },
}));

// expo-crypto: real SHA-256 is required by the recovery-code law, so only the
// random helpers are doubled (Node's webcrypto already provides subtle.digest).
jest.mock('expo-crypto', () => {
  const nodeCrypto = require('crypto');
  const bytes = (n) => {
    const b = new Uint8Array(n);
    nodeCrypto.randomFillSync(b);
    return b;
  };
  return {
    __esModule: true,
    randomUUID: () => {
      const b = bytes(16);
      b[6] = (b[6] & 0x0f) | 0x40;
      b[8] = (b[8] & 0x3f) | 0x80;
      const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
      return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
    },
    getRandomBytes: (n) => bytes(n),
    getRandomBytesAsync: async (n) => bytes(n),
    digestStringAsync: async (algo, data) => {
      const h = nodeCrypto.createHash(algo.replace('-', '').toLowerCase()).update(data).digest('hex');
      return h;
    },
  };
});

// MMKV v4 / Nitro are native-only. The storage adapter must be written so this
// double is a faithful stand-in (set/get/remove/clearAll/contains/getAllKeys).
jest.mock('react-native-mmkv', () => {
  const store = new Map();
  const inst = (id) => ({
    id,
    set: (k, v) => store.set(`${id}:${k}`, v),
    getString: (k) => { const v = store.get(`${id}:${k}`); return typeof v === 'string' ? v : undefined; },
    getNumber: (k) => { const v = store.get(`${id}:${k}`); return typeof v === 'number' ? v : undefined; },
    getBoolean: (k) => { const v = store.get(`${id}:${k}`); return typeof v === 'boolean' ? v : undefined; },
    contains: (k) => store.has(`${id}:${k}`),
    remove: (k) => store.delete(`${id}:${k}`),
    clearAll: () => { for (const key of [...store.keys()]) if (key.startsWith(`${id}:`)) store.delete(key); },
    getAllKeys: () => [...store.keys()].filter((k) => k.startsWith(`${id}:`)).map((k) => k.slice(id.length + 1)),
    trim: () => {},
  });
  return {
    __esModule: true,
    __store: store,
    createMMKV: jest.fn((config) => inst(config?.id ?? 'mmkv.default')),
    existsMMKV: jest.fn(() => true),
    deleteMMKV: jest.fn(),
  };
});

// expo-sqlite: an in-memory table good enough for the echo ring's contract.
jest.mock('expo-sqlite', () => {
  const tables = new Map();
  const run = (db, sql, params = []) => {
    const t = String(sql).match(/(?:FROM|INTO|UPDATE)\s+(\w+)/i)?.[1];
    if (!t) return { changes: 0, lastInsertRowId: 0 };
    if (!tables.has(t)) tables.set(t, []);
    const rows = tables.get(t);
    if (/^\s*DELETE/i.test(sql)) { tables.set(t, []); return { changes: rows.length }; }
    if (/^\s*INSERT/i.test(sql)) { rows.push(params); return { changes: 1, lastInsertRowId: rows.length }; }
    return { changes: 0, lastInsertRowId: 0 };
  };
  return {
    __tables: tables,
    openDatabaseSync: jest.fn(() => ({
      execAsync: jest.fn(async () => {}),
      runAsync: jest.fn(async (sql, ...p) => run(null, sql, p.flat())),
      getAllAsync: jest.fn(async () => []),
      getFirstAsync: jest.fn(async () => null),
      withTransactionAsync: jest.fn(async (fn) => fn()),
      closeSync: jest.fn(),
    })),
  };
});

// Keep the animation clock deterministic-ish and silence the Reanimated
// "useNativeDriver" warnings that jest-expo surfaces as noise.
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
