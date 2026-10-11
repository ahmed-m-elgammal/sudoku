// Pins the DAY3 corrupt-save quarantine (report A9).
//
// The regression this locks out: storage.get swallowed JSON parse errors and
// resolved `undefined` — indistinguishable from "never written" — so save.load()
// minted a fresh profile and OVERWROTE the key. A player's entire ledger (standing,
// campaign, the pending Ink queue) vanished with zero signal, zero backup.
//
// The law now:
//   QUAR-1  unreadable bytes are quarantined first — the raw blob survives at
//           `<store>/<key>.quarantine` with its timestamp, THEN the read degrades
//           to the absent-key contract every caller already handles.
//   QUAR-2  booting past a corrupt save replaces the ledger but stamps the store:
//           `quarantinedAt` is set, so the wipe is not silent (the Ledger's
//           recovery section reads it) and the quarantined bytes still exist.
//   QUAR-3  a clean first run stamps nothing.
import { beforeEach, describe, expect, it } from 'vitest';
import { useSave } from '@/state/save';
import { storage } from '@/platform/storage';

// The mmkv tier is the live backend under vitest (the native probe resolves against
// the module double in vitest.setup.ts). Its Map is exported precisely so tests can
// plant bytes that never went through storage.set — the corruption being tested.
const mmkvModule = (await import('react-native-mmkv')) as unknown as {
  __store: Map<string, string>;
};

const KEY = 'assize:save/me';
const QKEY = 'assize:save/me.quarantine';

beforeEach(async () => {
  await storage.clearAll();
  useSave.setState({ save: null, loaded: false, quarantinedAt: null });
});

describe('storage.get — the quarantine (A9)', () => {
  it('QUAR-1 a corrupt blob is preserved, then the read degrades to undefined', async () => {
    mmkvModule.__store.set(KEY, '{"v":2,"tutor'); // a kill mid-write, truncated
    const read = await storage.get<{ v: number }>('save', 'me');
    expect(read).toBeUndefined(); // the contract every caller already handles

    const q = await storage.get<{ raw: string; at: number }>('save', 'me.quarantine');
    expect(q).toBeDefined();
    expect(q!.raw).toBe('{"v":2,"tutor'); // the exact bytes, not a re-serialization
    expect(typeof q!.at).toBe('number');
    expect(Number.isFinite(q!.at)).toBe(true);
  });

  it('QUAR-2 booting past a corrupt save replaces the ledger and stamps the store', async () => {
    mmkvModule.__store.set(KEY, 'not-json-at-all');
    await useSave.getState().load();
    const s = useSave.getState();
    expect(s.loaded).toBe(true);
    expect(s.save).not.toBeNull(); // a fresh, working profile
    expect(s.save?.v).toBe(2);
    expect(s.quarantinedAt).not.toBeNull(); // the wipe is not silent
    // and the corrupt bytes outlived the replacement
    const q = await storage.get<{ raw: string }>('save', 'me.quarantine');
    expect(q?.raw).toBe('not-json-at-all');
  });

  it('QUAR-3 a clean first run stamps nothing', async () => {
    await useSave.getState().load();
    const s = useSave.getState();
    expect(s.loaded).toBe(true);
    expect(s.save).not.toBeNull();
    expect(s.quarantinedAt).toBeNull();
    expect(await storage.get('save', 'me.quarantine')).toBeUndefined();
  });
});
