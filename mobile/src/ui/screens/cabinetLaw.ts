// CabinetScreen law — the parts of S15 that can be pinned without native chrome.
//
// The web build keeps the 26-cosmetic shop inline in ../src/app/game/CabinetScreen.tsx —
// the ITEMS table (:21-48), the six tabs (:50-57), the tab→slot ternary (:67), the
// buy handler (:70-92) and the equip handler (:137-140). This port extracts them
// (the reliquaryLaw/friendLaw precedent) so the gate can pin the shop laws:
// 26 cosmetics across 6 tabs, Ink/Sigil pricing, the buy→own→equip loop
// (specs/17 phase 5.4 done-when: "buy spends Ink, equip persists").
//
// The item names and descriptions are the web screen's own literals (they are not
// in the frozen en.json) — carried verbatim, not reworded: it is the game's voice.

export type CabinetTab = 'boards' | 'seals' | 'frames' | 'numerals' | 'stamps' | 'banners';
export type CabinetCurrency = 'ink' | 'sigil' | 'owned';
export type EquipSlot = 'board' | 'wax' | 'frame' | 'numerals' | 'stamps' | 'banner';

export interface CosmeticItem {
  id: string;
  name: string;
  desc: string;
  currency: CabinetCurrency;
  price: number;
  tab: CabinetTab;
  /** the web asset path — the art seam's key (cabinetArt.ts resolves it to a bundled URI) */
  preview: string;
}

/** The web CabinetScreen's ITEMS table, verbatim — CabinetScreen.tsx:21-48. */
export const CABINET_ITEMS: readonly CosmeticItem[] = [
  { id: 'board-aged-vellum', name: 'Aged Vellum', desc: 'The standard sheet of the Assize.', currency: 'owned', price: 0, tab: 'boards', preview: '/assets/textures/parchment-aged-vellum.svg' },
  { id: 'board-bone', name: 'Bone', desc: 'Scraped white, cold to the touch.', currency: 'ink', price: 400, tab: 'boards', preview: '/assets/textures/parchment-bone.svg' },
  { id: 'board-slate', name: 'Slate', desc: 'For the pragmatic clerk.', currency: 'ink', price: 400, tab: 'boards', preview: '/assets/textures/parchment-slate.svg' },
  { id: 'board-plague-linen', name: 'Plague Linen', desc: 'Stripped from a sealed house.', currency: 'ink', price: 700, tab: 'boards', preview: '/assets/textures/parchment-plague-linen.svg' },
  { id: 'board-tallow', name: 'Tallow', desc: 'Candle-fat and patience.', currency: 'ink', price: 700, tab: 'boards', preview: '/assets/textures/parchment-tallow.svg' },
  { id: 'board-cathedral', name: 'Cathedral Rubric', desc: 'Illuminated margins. Rare.', currency: 'sigil', price: 40, tab: 'boards', preview: '/assets/textures/parchment-cathedral-rubric.svg' },
  { id: 'wax-oxblood', name: 'Oxblood', desc: 'Your mark, by right.', currency: 'owned', price: 0, tab: 'seals', preview: '/assets/seals/stamps/stamp-fleur.svg' },
  { id: 'wax-black', name: 'Black', desc: 'The court’s own wax.', currency: 'ink', price: 300, tab: 'seals', preview: '/assets/seals/stamps/stamp-tau.svg' },
  { id: 'wax-verdigris', name: 'Verdigris', desc: 'Bronze gone green in the rain.', currency: 'ink', price: 300, tab: 'seals', preview: '/assets/seals/seal-verdigris-intact.svg' },
  { id: 'wax-gilt', name: 'Gilt', desc: 'Moneylender’s choice.', currency: 'ink', price: 600, tab: 'seals', preview: '/assets/seals/seal-gilt-intact.svg' },
  { id: 'wax-ash', name: 'Ash', desc: 'What the Ledger leaves.', currency: 'ink', price: 300, tab: 'seals', preview: '/assets/seals/seal-ash-intact.svg' },
  { id: 'frame-bronze', name: 'Bronze Frame', desc: 'Honest metal.', currency: 'owned', price: 0, tab: 'frames', preview: '/assets/ui/frame-brass.svg' },
  { id: 'frame-iron', name: 'Iron Frame', desc: 'Warden-forged.', currency: 'ink', price: 350, tab: 'frames', preview: '/assets/ui/frame-brass.svg' },
  { id: 'frame-bone', name: 'Bone-inlay Frame', desc: 'Inlaid with something older.', currency: 'ink', price: 500, tab: 'frames', preview: '/assets/ui/frame-brass.svg' },
  { id: 'frame-lacquer', name: 'Black-lacquer Frame', desc: 'Nine coats. Fabled.', currency: 'sigil', price: 25, tab: 'frames', preview: '/assets/ui/frame-brass.svg' },
  { id: 'numerals-linocut', name: 'Linocut Numerals', desc: 'Cut by hand, inked by hand.', currency: 'owned', price: 0, tab: 'numerals', preview: '/assets/ui/num-tile-normal.svg' },
  { id: 'numerals-caslon', name: 'Court Caslon', desc: 'The Registrar’s face.', currency: 'ink', price: 400, tab: 'numerals', preview: '/assets/ui/num-tile-normal.svg' },
  { id: 'numerals-gothic', name: 'Gothic Numerals', desc: 'Older than the walls.', currency: 'ink', price: 450, tab: 'numerals', preview: '/assets/ui/num-tile-normal.svg' },
  { id: 'stamp-fleur', name: 'Fleur-de-lis', desc: 'Your claim, unmistakable.', currency: 'owned', price: 0, tab: 'stamps', preview: '/assets/seals/stamps/stamp-fleur.svg' },
  { id: 'stamp-laurel', name: 'Laurel', desc: 'For clean hands.', currency: 'ink', price: 350, tab: 'stamps', preview: '/assets/seals/stamps/stamp-laurel.svg' },
  { id: 'stamp-crown', name: 'Crown', desc: 'Rule asserted.', currency: 'ink', price: 500, tab: 'stamps', preview: '/assets/seals/stamps/stamp-crown.svg' },
  { id: 'stamp-tower', name: 'Tower', desc: 'Novem holds.', currency: 'ink', price: 350, tab: 'stamps', preview: '/assets/seals/stamps/stamp-tower.svg' },
  { id: 'stamp-scale', name: 'Scales', desc: 'Everything weighed.', currency: 'sigil', price: 15, tab: 'stamps', preview: '/assets/seals/stamps/stamp-scale.svg' },
  { id: 'banner-standard', name: 'Plain Verdict', desc: 'True, and unadorned.', currency: 'owned', price: 0, tab: 'banners', preview: '/assets/ui/divider-1.svg' },
  { id: 'banner-rubric', name: 'Rubric Verdict', desc: 'Red-letter victory.', currency: 'ink', price: 500, tab: 'banners', preview: '/assets/ui/divider-2.svg' },
  { id: 'banner-ninth', name: 'The Ninth Banner', desc: 'For folios settled.', currency: 'sigil', price: 30, tab: 'banners', preview: '/assets/ui/divider-3.svg' },
];

/** the six tabs in web order (CabinetScreen.tsx:50-57); the labels are i18n.cabinet.tabs.* */
export const CABINET_TABS: readonly CabinetTab[] = ['boards', 'seals', 'frames', 'numerals', 'stamps', 'banners'];

/** the web's tab→equipped-slot ternary (CabinetScreen.tsx:67). */
export function equipKeyFor(tab: CabinetTab): EquipSlot {
  return tab === 'boards' ? 'board'
    : tab === 'seals' ? 'wax'
    : tab === 'frames' ? 'frame'
    : tab === 'numerals' ? 'numerals'
    : tab === 'stamps' ? 'stamps'
    : 'banner';
}

/** minimal structural view of the save this law touches (SaveStateV2 satisfies it). */
export interface CabinetSave {
  economy: { ink: number; sigils: number };
  cosmetics: { owned: string[]; equipped: Record<EquipSlot, string> };
}

/** the law's output: what was spent, the new balances and the new owned array,
 *  spread-safe — the save's equipped map and the economy's other counters stay
 *  untouched, exactly as the web's spread update keeps them. */
export interface BoughtSlices {
  spent: 'ink' | 'sigil';
  economy: { ink: number; sigils: number };
  owned: string[];
}

/**
 * The purchase law (CabinetScreen.tsx:72-87): an Ink item the purse can afford
 * spends its price and joins `owned`; the same for a Sigil item; anything else —
 * an unaffordable item, or the `owned`-currency starters that were never for
 * sale — refuses. (The web's silent already-owned guard stays at the call site:
 * it returns without even the error sound, CabinetScreen.tsx:71.)
 */
export function buyItem(save: CabinetSave, item: CosmeticItem): BoughtSlices | null {
  if (item.currency === 'ink' && save.economy.ink >= item.price) {
    return {
      spent: 'ink',
      economy: { ink: save.economy.ink - item.price, sigils: save.economy.sigils },
      owned: [...save.cosmetics.owned, item.id],
    };
  }
  if (item.currency === 'sigil' && save.economy.sigils >= item.price) {
    return {
      spent: 'sigil',
      economy: { ink: save.economy.ink, sigils: save.economy.sigils - item.price },
      owned: [...save.cosmetics.owned, item.id],
    };
  }
  return null;
}

/** the equip (CabinetScreen.tsx:139): the slot's key moves to this item, owned or not at the law's level. */
export function equipItem(save: CabinetSave, slot: EquipSlot, id: string): CabinetSave['cosmetics'] {
  return { ...save.cosmetics, equipped: { ...save.cosmetics.equipped, [slot]: id } };
}

/** the T13 spend id — the web's `spend-${item.id}-${Date.now().toString(36)}` (CabinetScreen.tsx:79). */
export const spendDuelId = (itemId: string, nowMs: number): string =>
  `spend-${itemId}-${nowMs.toString(36)}`;
