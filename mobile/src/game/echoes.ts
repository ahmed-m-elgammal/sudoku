// ASSIZE mobile — Echo storage (T7/T19).
//
// PORT of ../src/game/echoes.ts. The web build kept the ring in IndexedDB ('duels'
// store); here it is the SQLite `duels` table through the platform seam's SqlPort
// (platform/storage.ts — expo-sqlite, with an in-memory tier so Expo Go and the test
// runner degrade instead of dying). All logic that can be tested lives in
// @shared/replay (validation, the cap, eviction order) and @shared/echoShare (the
// sealed-chit privacy pass); this file only moves bytes in and out and keeps the
// ring trimmed.
//
// The ring laws (specs/17 5.1):
//   · validate-on-write — nothing unvalidated ever reaches the store: saveEcho
//     runs validateReplay and refuses the write;
//   · newest 12 — trimEchoes evicts the OLDEST rows past ECHO_CAP;
//   · a corrupted row is skipped on read — not shown, not crashing the shelf;
//   · every storage failure is swallowed — the duel itself never depends on echoes.
//
// Screen-law re-exports: a screen may not import @shared/replay|personalShade
// directly (mobile/eslint.config.js LAW 3), so the echo surface the shelf needs
// rides this module — describeEcho, minePersonalShade and their types.
import { sql } from '@/platform/storage';
import {
  describeEcho,
  nextEchoKey,
  echoesToEvict,
  ECHO_CAP,
  validateReplay,
  type DuelReplay,
} from '@shared/replay';
import { minePersonalShade, type MinedShade } from '@shared/personalShade';

export { describeEcho };
export type { DuelReplay };
export { minePersonalShade };
export type { MinedShade };

/**
 * The web build gated every call on `'indexedDB' in window`. RN has no global to
 * probe: the SqlPort always answers (expo-sqlite, degrading to an in-memory tier
 * when the native module is absent), so the shelf is always available — and every
 * storage failure below is swallowed instead of thrown.
 */
export const isEchoAvailable = (): boolean => true;

/** validates on the way IN as well — nothing unvalidated ever reaches the store */
export async function saveEcho(
  replay: DuelReplay,
  opts?: { imported?: boolean },
): Promise<string | null> {
  if (!isEchoAvailable()) return null;
  const clean = validateReplay(replay);
  if (!clean) return null;
  const key = nextEchoKey(Date.now(), Math.floor(Math.random() * 1e9));
  try {
    // T19 — imported chits carry the badge so the shelf tells the tale honestly
    await sql.put({
      key,
      payload: JSON.stringify(clean),
      savedAt: Date.now(),
      imported: opts?.imported === true ? 1 : 0,
    });
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
  imported: boolean;
}

export async function listEchoes(): Promise<EchoEntry[]> {
  if (!isEchoAvailable()) return [];
  try {
    const rows = await sql.all();
    const out: EchoEntry[] = [];
    for (const row of rows) {
      let raw: unknown;
      try {
        raw = JSON.parse(row.payload);
      } catch {
        continue; // a corrupted row is skipped, not shown, not crashing
      }
      const clean = validateReplay(raw);
      if (!clean) continue; // same law for well-formed JSON that fails validation
      out.push({
        key: row.key,
        replay: clean,
        savedAt: typeof row.savedAt === 'number' ? row.savedAt : 0,
        imported: row.imported === 1,
      });
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
    for (const key of evict) await sql.remove(key);
  } catch {
    /* trimming is best-effort */
  }
}
