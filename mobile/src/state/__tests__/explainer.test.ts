// P3.3 — the explainer flags' memory law (save.flags.statusExplained).
//
//   FLAG-1  a pre-explainer save migrates with empty flags, hostile or not.
//   FLAG-2  fresh saves start with empty flags.
//   FLAG-3  markStatusExplained appends once and never duplicates.
import { describe, it, expect, beforeEach } from 'vitest';
import { freshSave, migrate, useSave, type SaveStateV2 } from '@/state/save';
import { __resetStorageBackends, storage } from '@/platform/storage';

beforeEach(async () => {
  __resetStorageBackends();
  await storage.clearAll();
  useSave.setState({ save: null, loaded: false, quarantinedAt: null });
});

describe('explainer flags (P3.3)', () => {
  it('FLAG-1 a pre-explainer v2 save migrates with empty flags', () => {
    const fresh = freshSave('the Clerk');
    const old = { ...fresh };
    delete (old as { flags?: unknown }).flags;
    const m = migrate(old as unknown as SaveStateV2);
    expect(m.flags.statusExplained).toEqual([]);
    expect(m.campaign.chronicleSeen).toEqual([]);
  });

  it('FLAG-1 a hostile flags blob degrades to clean strings', () => {
    const fresh = freshSave('the Clerk');
    const hostile = { ...fresh, flags: { statusExplained: ['miasma', 7, ''] } };
    expect(migrate(hostile as unknown as SaveStateV2).flags.statusExplained).toEqual(['miasma']);
  });

  it('FLAG-2 fresh saves start with empty flags', () => {
    expect(freshSave('the Clerk').flags).toEqual({ statusExplained: [] });
  });

  it('FLAG-3 markStatusExplained appends once and never duplicates', () => {
    useSave.setState({ save: freshSave('the Clerk'), loaded: true, quarantinedAt: null });
    const store = useSave.getState();
    store.markStatusExplained('miasma');
    store.markStatusExplained('miasma');
    store.markStatusExplained('chain');
    store.markStatusExplained('');
    expect(useSave.getState().save?.flags.statusExplained).toEqual(['miasma', 'chain']);
  });
});
