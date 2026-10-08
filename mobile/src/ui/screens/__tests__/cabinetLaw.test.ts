// CabinetScreen law — the gate for specs/17 phase 5.4's shop half.
//
// Pinned: the 26 cosmetics across the 6 tabs (the spec's own counts), the
// tab→slot mapping, the buy→own→equip loop (the 5.4 done-when: "buy spends Ink,
// equip persists"), the starter items' `owned` currency, and the T13 spend id.
import { describe, it, expect } from 'vitest';
import {
  buyItem, CABINET_ITEMS, CABINET_TABS, equipItem, equipKeyFor, spendDuelId,
  type CabinetSave, type CosmeticItem,
} from '@/ui/screens/cabinetLaw';

const save = (economy: { ink: number; sigils: number }, owned: string[] = []): CabinetSave => ({
  economy,
  cosmetics: {
    owned,
    equipped: { board: 'board-aged-vellum', wax: 'wax-oxblood', frame: 'frame-bronze', numerals: 'numerals-linocut', stamps: 'stamp-fleur', banner: 'banner-standard' },
  },
});

const item = (over: Partial<CosmeticItem> = {}): CosmeticItem => ({
  id: 'board-bone', name: 'Bone', desc: 'Scraped white, cold to the touch.',
  currency: 'ink', price: 400, tab: 'boards', preview: '/assets/textures/parchment-bone.svg',
  ...over,
});

describe('the cabinet inventory (spec 09: 26 cosmetics across 6 tabs)', () => {
  it('carries exactly the web table: 26 items, unique ids, 6 tabs in web order', () => {
    expect(CABINET_ITEMS).toHaveLength(26);
    expect(new Set(CABINET_ITEMS.map((i) => i.id)).size).toBe(26);
    expect(CABINET_TABS).toEqual(['boards', 'seals', 'frames', 'numerals', 'stamps', 'banners']);
  });

  it('the per-tab counts match the web ITEMS table', () => {
    const counts = Object.fromEntries(
      CABINET_TABS.map((t) => [t, CABINET_ITEMS.filter((i) => i.tab === t).length]),
    );
    expect(counts).toEqual({ boards: 6, seals: 5, frames: 4, numerals: 3, stamps: 5, banners: 3 });
  });

  it('the six starters are the owned-currency items, priced 0 — never for sale', () => {
    const starters = CABINET_ITEMS.filter((i) => i.currency === 'owned');
    expect(starters.map((i) => i.id).sort()).toEqual(
      ['banner-standard', 'board-aged-vellum', 'frame-bronze', 'numerals-linocut', 'stamp-fleur', 'wax-oxblood'],
    );
    for (const s of starters) expect(s.price).toBe(0);
  });

  it('every preview is a web /assets path — the art seam’s key space', () => {
    for (const i of CABINET_ITEMS) expect(i.preview.startsWith('/assets/')).toBe(true);
  });
});

describe('the tab→slot law (the web’s ternary)', () => {
  it('maps every tab to its equipped slot', () => {
    expect(equipKeyFor('boards')).toBe('board');
    expect(equipKeyFor('seals')).toBe('wax');
    expect(equipKeyFor('frames')).toBe('frame');
    expect(equipKeyFor('numerals')).toBe('numerals');
    expect(equipKeyFor('stamps')).toBe('stamps');
    expect(equipKeyFor('banners')).toBe('banner');
  });
});

describe('the buy law (CabinetScreen.tsx:72-87)', () => {
  it('an affordable Ink item spends its price and joins owned', () => {
    const bought = buyItem(save({ ink: 400, sigils: 0 }), item())!;
    expect(bought.spent).toBe('ink');
    expect(bought.economy.ink).toBe(0);
    expect(bought.economy.sigils).toBe(0);
    expect(bought.owned).toEqual(['board-bone']);
  });

  it('an affordable Sigil item spends sigils and records no ink spend', () => {
    const bought = buyItem(save({ ink: 0, sigils: 40 }), item({ id: 'board-cathedral', currency: 'sigil', price: 40 }))!;
    expect(bought.spent).toBe('sigil');
    expect(bought.economy.sigils).toBe(0);
    expect(bought.economy.ink).toBe(0);
    expect(bought.owned).toEqual(['board-cathedral']);
  });

  it('a light purse is refused — nothing moves', () => {
    expect(buyItem(save({ ink: 399, sigils: 0 }), item({ price: 400 }))).toBeNull();
    expect(buyItem(save({ ink: 0, sigils: 39 }), item({ currency: 'sigil', price: 40 }))).toBeNull();
  });

  it('the owned-currency starters are never purchasable', () => {
    expect(buyItem(save({ ink: 9999, sigils: 999 }), item({ id: 'wax-oxblood', currency: 'owned', price: 0 }))).toBeNull();
  });

  it('an Ink item priced beyond the purse never falls through to the Sigil path', () => {
    expect(buyItem(save({ ink: 10, sigils: 999 }), item())).toBeNull();
  });
});

describe('the equip law (CabinetScreen.tsx:139)', () => {
  it('moves the slot to the item and leaves the rest of the save alone', () => {
    const s = save({ ink: 0, sigils: 0 }, ['board-bone']);
    const cosmetics = equipItem(s, 'board', 'board-bone');
    expect(cosmetics.equipped.board).toBe('board-bone');
    expect(cosmetics.equipped.wax).toBe('wax-oxblood'); // untouched
    expect(cosmetics.owned).toEqual(['board-bone']);    // untouched
  });
});

describe('the T13 spend id (the web’s `spend-{id}-{now36}`)', () => {
  it('composes the ledger key the server dedupes on', () => {
    expect(spendDuelId('board-bone', 0xdeadbeef)).toBe(`spend-board-bone-${(0xdeadbeef).toString(36)}`);
  });
});
