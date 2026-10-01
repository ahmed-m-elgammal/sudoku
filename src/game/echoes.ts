// Echo storage (T7) — thin IndexedDB layer over the 'duels' store. All logic that
// can be tested lives in @shared/replay; this file only moves bytes in and out and
// keeps the ring buffer trimmed. SSR-safe: every call no-ops without indexedDB.
'use client';
import { idbGet, idbSet, idbDel, openDb } from '@/state/idb';
import { validateReplay, nextEchoKey, echoesToEvict, ECHO_CAP, type DuelReplay } from '@shared/replay';

export const isEchoAvailable = (): boolean =>
  typeof window !== 'undefined' && 'indexedDB' in window;

/** validates on the way IN as well — nothing unvalidated ever reaches the store */
export async function saveEcho(replay: DuelReplay): Promise<string | null> {
  if (!isEchoAvailable()) return null;
  const clean = validateReplay(replay);
  if (!clean) return null;
  const key = nextEchoKey(Date.now(), Math.floor(Math.random() * 1e9));
  try {
    await idbSet('duels', key, { ...clean, savedAt: Date.now() });
    await trimEchoes();
    return key;
  } catch {
    return null; // storage full/blocked: the duel itself never depends on echoes
  }
}

export interface EchoEntry {
  key: string;
  replay: DuelReplay;
  savedAt: number;
}

export async function listEchoes(): Promise<EchoEntry[]> {
  if (!isEchoAvailable()) return [];
  try {
    const db = await openDb();
    const keys = await new Promise<IDBValidKey[]>((resolve, reject) => {
      const tx = db.transaction('duels', 'readonly');
      const req = tx.objectStore('duels').getAllKeys();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    const out: EchoEntry[] = [];
    for (const k of keys) {
      if (typeof k !== 'string' || !k.startsWith('echo-')) continue;
      const raw = await idbGet<Record<string, unknown>>('duels', k);
      if (!raw) continue;
      const clean = validateReplay(raw);
      if (!clean) continue; // a corrupted row is skipped, not shown, not crashing
      out.push({ key: k, replay: clean, savedAt: typeof raw.savedAt === 'number' ? raw.savedAt : 0 });
    }
    return out.sort((a, b) => b.savedAt - a.savedAt);
  } catch {
    return [];
  }
}

export async function trimEchoes(cap: number = ECHO_CAP): Promise<void> {
  if (!isEchoAvailable()) return;
  try {
    const echoes = await listEchoes();
    const evict = echoesToEvict(echoes.map((e) => ({ key: e.key, t: e.savedAt })), cap);
    for (const key of evict) await idbDel('duels', key);
  } catch {
    /* trimming is best-effort */
  }
}
