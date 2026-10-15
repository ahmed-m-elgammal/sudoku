// P2.4 — the Chronicle's memory law (docs/STORY_HOLD_PLAN.md P2.4).
//
//   CHRON-1  a pre-Chronicle save migrates with an empty ledger, hostile or not.
//   CHRON-2  fresh saves start with an empty ledger.
//   CHRON-3  markChronicle appends once and never duplicates (idempotent).
import { describe, it, expect, beforeEach } from 'vitest';
import { freshSave, migrate, useSave, type SaveStateV2 } from '@/state/save';
import { __resetStorageBackends, storage } from '@/platform/storage';

beforeEach(async () => {
  __resetStorageBackends();
  await storage.clearAll();
  useSave.setState({ save: null, loaded: false, quarantinedAt: null });
});

describe('chronicle memory (P2.4)', () => {
  it('CHRON-1 a pre-Chronicle v2 save migrates with an empty ledger', () => {
    const fresh = freshSave('the Clerk');
    const old = { ...fresh, campaign: { folioIdx: 2, duelIdx: 1, stars: {}, ended: false } };
    delete (old.campaign as { chronicleSeen?: unknown }).chronicleSeen;
    expect(migrate(old as unknown as SaveStateV2).campaign.chronicleSeen).toEqual([]);
  });

  it('CHRON-1 a hostile chronicleSeen degrades to clean strings', () => {
    const fresh = freshSave('the Clerk');
    const hostile = {
      ...fresh,
      campaign: { ...fresh.campaign, chronicleSeen: ['prologue', 42, '', null, 'folio:halbrecht'] },
    };
    expect(migrate(hostile as unknown as SaveStateV2).campaign.chronicleSeen).toEqual([
      'prologue',
      'folio:halbrecht',
    ]);
  });

  it('CHRON-2 fresh saves start with an empty ledger', () => {
    expect(freshSave('the Clerk').campaign.chronicleSeen).toEqual([]);
  });

  it('CHRON-3 markChronicle appends once and never duplicates', () => {
    useSave.setState({ save: freshSave('the Clerk'), loaded: true, quarantinedAt: null });
    const store = useSave.getState();
    store.markChronicle('prologue');
    store.markChronicle('prologue');
    store.markChronicle('folio:halbrecht');
    store.markChronicle('');
    expect(useSave.getState().save?.campaign.chronicleSeen).toEqual(['prologue', 'folio:halbrecht']);
  });
});
