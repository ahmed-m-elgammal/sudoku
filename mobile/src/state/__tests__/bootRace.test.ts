// Pins the DAY1 boot-race fix in save.load().
//
// The regression this locks out: `loaded: true` used to commit BEFORE the first-run
// identity/fresh-save writes resolved. The BootScreen's 1.2 s auto-advance could then
// beat the Keychain write on a slow first launch: GameShell mounted, specFromUi()
// dereferenced a null save, and — with no error boundary below it — the app died on
// the store-review "first run" path.
//
// The law now: `loaded` flips ONLY in the same zustand commit that materializes the
// save (no observable window of `loaded && !save`), and every await that can reject
// is caught — a hostile Keychain must degrade to a fresh in-memory save, never wedge
// the boot gate on a permanent black screen.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSave } from '@/state/save';
import { storage as platformStorage } from '@/platform/storage';

// The identity seam is hooked through a hoisted state flag (NOT a vi.fn spy —
// restoreAllMocks must not be able to touch the real implementation): the default
// is the REAL mint (RACE-1/RACE-3 exercise it), and RACE-2 flips the flag to make
// exactly one identity load reject, then it clears itself.
const identityFault = vi.hoisted(() => ({ rejectOnce: null as Error | null }));

vi.mock('@/state/identity', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/state/identity')>();
  return {
    ...actual,
    loadIdentity: async (
      ...args: Parameters<typeof actual.loadIdentity>
    ) => {
      if (identityFault.rejectOnce) {
        const fault = identityFault.rejectOnce;
        identityFault.rejectOnce = null;
        throw fault;
      }
      return actual.loadIdentity(...args);
    },
  };
});

beforeEach(async () => {
  // per-test isolation: the storage doubles share a module-level Map, so RACE-1's
  // minted save/identity must not leak into RACE-2/RACE-3 (both assert the
  // FIRST-RUN path — an existing save would take the migrated branch instead).
  await platformStorage.clearAll();
  useSave.setState({ save: null, loaded: false });
});

afterEach(() => {
  identityFault.rejectOnce = null;
  vi.restoreAllMocks();
});

describe('save.load — the boot gate ordering (DAY1)', () => {
  it('RACE-1 `loaded` never observes `save: null` — no window between the two commits', async () => {
    const seen: { loaded: boolean; hasSave: boolean }[] = [];
    const unsub = useSave.subscribe((s) => seen.push({ loaded: s.loaded, hasSave: s.save !== null }));
    try {
      await useSave.getState().load();
    } finally {
      unsub();
    }
    const final = useSave.getState();
    expect(final.loaded).toBe(true);
    expect(final.save).not.toBeNull();
    // every observed intermediate state is coherent: loaded === hasSave at all times
    for (const snap of seen) {
      expect(snap.loaded).toBe(snap.hasSave);
    }
  });

  it('RACE-2 a rejecting Keychain still opens the gate with a fresh in-memory save', async () => {
    identityFault.rejectOnce = new Error('keychain wedged');
    await useSave.getState().load();
    const s = useSave.getState();
    expect(s.loaded).toBe(true);
    expect(s.save).not.toBeNull();
    expect(s.save?.name).toBe('the Clerk'); // the documented last-resort name
    expect(s.save?.v).toBe(2);
  });

  it('RACE-3 a rejecting persist still opens the gate — the session runs in memory', async () => {
    const setSpy = vi.spyOn(platformStorage, 'set').mockRejectedValue(new Error('disk full'));
    await useSave.getState().load();
    const s = useSave.getState();
    // the persist was genuinely attempted (the mock really intercepted)...
    expect(setSpy).toHaveBeenCalledWith('save', 'me', expect.objectContaining({ v: 2 }));
    // ...and the boot gate opened anyway: the in-memory save runs the session
    expect(s.loaded).toBe(true);
    expect(s.save).not.toBeNull();
    expect(s.save?.tutorialDone).toBe(false);
  });
});
