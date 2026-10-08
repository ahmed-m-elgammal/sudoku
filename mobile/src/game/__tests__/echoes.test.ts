// echoes.ts — the ring laws (specs/17 5.1).
//
// The web build's echo storage was a thin IndexedDB layer over the 'duels' store;
// the mobile port is the SQLite `duels` table through the platform seam's SqlPort.
// The gate pins the RING, not the transport:
//
//   RING-1  validate-on-write — nothing unvalidated ever reaches the store
//   RING-2  the ring is newest-12: the OLDEST echoes are evicted, newest first listed
//   RING-3  a corrupted row is skipped — not shown, not crashing the shelf
//   RING-4  an imported chit carries the badge, an honest duel does not
//   RING-5  the two-way privacy pass end to end: export strips names, import
//           force-redacts again, and the shelf entry is anonymous
//   RING-6  trimEchoes(cap) honours an explicit cap (the shared law, one call away)
//
// The expo-sqlite double is forced to hand back a null db, which latches the
// SqlPort onto its in-memory tier — the same contract SQLite serves, without
// native chrome (storage.ts's own degradation law, exercised on purpose).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { saveEcho, listEchoes, trimEchoes, describeEcho } from '@/game/echoes';
import { sql, __resetStorageBackends } from '@/platform/storage';
import { ECHO_CAP, type DuelReplay } from '@shared/replay';
import { REDACTED_CLERK, REDACTED_ECHO, encodeEchoCode, decodeEchoCode } from '@shared/echoShare';

// hoisted above the imports by vitest — the SqlPort's SQLite tier is forced onto
// its in-memory fallback: a null db latches sqlFailed, the same contract, no native
vi.mock('expo-sqlite', () => ({
  openDatabaseAsync: vi.fn(async () => null),
}));

const echo = (over: Partial<DuelReplay> = {}): DuelReplay => ({
  v: 1,
  seed: 'echo-ring-seed-001',
  tier: 'Medium',
  orders: ['scholar', 'executioner'],
  names: ['Ahmed', 'the Shade'],
  durationMs: 120_000,
  actions: [
    { t: 5_000, kind: 'place', cell: 0, digit: 5 },
    { t: 9_000, kind: 'place', cell: 1, digit: 3 },
    { t: 12_000, kind: 'place', cell: 2, digit: 7 },
  ],
  outcome: { winner: 0, reason: 'seals' },
  ...over,
});

let tick = 0;
beforeEach(() => {
  __resetStorageBackends();
  // monotonic clock: every Date.now() call advances a second — keys and savedAt
  // stay ordered, which is what the ring's eviction order is pinned against
  tick = 0;
  vi.spyOn(Date, 'now').mockImplementation(() => 1_700_000_000_000 + ++tick * 1000);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('echoes ring (specs/17 5.1)', () => {
  it('RING-1 validate-on-write: a hostile replay never reaches the store', async () => {
    const bad = await saveEcho(echo({ tier: 'Impossible' as DuelReplay['tier'] }));
    expect(bad).toBeNull();
    const wrong = await saveEcho(echo({ actions: [{ t: 3_000, kind: 'place', cell: 0, digit: 0 }] as DuelReplay['actions'] }));
    expect(wrong).toBeNull();
    // the shelf is untouched by both refusals
    expect(await listEchoes()).toEqual([]);
  });

  it('RING-2 the ring holds the newest 12 and lists them newest-first', async () => {
    for (let i = 0; i < ECHO_CAP + 2; i++) {
      const key = await saveEcho(echo({ seed: `ring-seed-${i}` }));
      expect(key).toMatch(/^echo-/);
    }
    const list = await listEchoes();
    expect(list).toHaveLength(ECHO_CAP);
    // newest-first: the last two writes were evicted, the newest write leads
    expect(list[0].replay.seed).toBe(`ring-seed-${ECHO_CAP + 1}`);
    expect(list.at(-1)!.replay.seed).toBe('ring-seed-2');
    for (const e of list) expect(e.savedAt).toBeGreaterThan(0);
  });

  it('RING-3 corrupted rows are skipped, valid neighbours survive', async () => {
    const good = await saveEcho(echo());
    expect(good).toBeTruthy();
    await sql.put({ key: 'echo-junk', payload: '{not json at all', savedAt: 12_345, imported: 0 });
    await sql.put({ key: 'echo-forged', payload: JSON.stringify({ v: 9, seed: 'x' }), savedAt: 12_346, imported: 0 });
    const list = await listEchoes();
    expect(list).toHaveLength(1);
    expect(list[0].key).toBe(good);
  });

  it('RING-4 the imported badge round-trips, an honest duel has none', async () => {
    await saveEcho(echo({ seed: 'honest-1' }));
    await saveEcho(echo({ seed: 'chit-1' }), { imported: true });
    const list = await listEchoes();
    const bySeed = new Map(list.map((e) => [e.replay.seed, e.imported]));
    expect(bySeed.get('honest-1')).toBe(false);
    expect(bySeed.get('chit-1')).toBe(true);
  });

  it('RING-5 the privacy pass end to end: export redacts, import re-redacts, the shelf is anonymous', async () => {
    const named = echo({ names: ['Clerk Al-Subashi', 'Magistrate Vael'] });
    // export side: the chit never carries a name
    const code = encodeEchoCode(named)!;
    expect(code.startsWith('ASSIZE1-')).toBe(true);
    expect(code).not.toContain('Al-Subashi');
    expect(code).not.toContain('Vael');
    // import side: decode force-redacts whatever the chit carried
    const decoded = decodeEchoCode(code)!;
    expect(decoded.names).toEqual([REDACTED_CLERK, REDACTED_ECHO]);
    // the shelf entry the other Clerk sees is the redacted one, badged as a chit
    const key = await saveEcho(decoded, { imported: true });
    expect(key).toBeTruthy();
    const [entry] = await listEchoes();
    expect(entry.imported).toBe(true);
    expect(entry.replay.names).toEqual([REDACTED_CLERK, REDACTED_ECHO]);
    // and a forged chit is refused, not stored
    expect(decodeEchoCode('ASSIZE1-%%%not-base64url%%%')).toBeNull();
    expect(decodeEchoCode('nonsense')).toBeNull();
  });

  it('RING-6 trimEchoes honours an explicit cap below the shared ECHO_CAP', async () => {
    for (let i = 0; i < 5; i++) await saveEcho(echo({ seed: `trim-${i}` }));
    await trimEchoes(3);
    const list = await listEchoes();
    expect(list).toHaveLength(3);
    expect(list[0].replay.seed).toBe('trim-4');
    expect(list.map((e) => e.replay.seed)).toEqual(['trim-4', 'trim-3', 'trim-2']);
  });

  it('the shelf speaks the shared law: describeEcho labels the echo for the screen', async () => {
    await saveEcho(echo());
    const [entry] = await listEchoes();
    // "Medium · 3 ink · won" — the web shelf's one-line label, verbatim
    expect(describeEcho(entry.replay)).toBe('Medium · 3 ink · won');
    // and the round-trip through storage is byte-faithful to the shared validator
    expect(entry.replay).toEqual(JSON.parse(JSON.stringify(entry.replay)));
  });
});
