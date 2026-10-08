// ReliquaryScreen law — the parts of S10 that can be pinned without native chrome.
//
// The web build keeps the drop table inline in ReliquaryScreen.tsx; here it is
// extracted (the friendLaw/dailyFormat precedent) so the gate can pin the odds,
// the award-once law and the chest frame sequence — the screen itself is Metro-only
// (module-scope SVG requires), the documented split of proof.
//
// Every value is the web build's, verbatim:
//   · the 15-entry DROP_TABLE (ReliquaryScreen.tsx:10-26);
//   · the roll ternary `<0.6 common, <0.9 rare, else fabled` (ReliquaryScreen.tsx:41);
//   · the duplicate law: a duplicate grants 40 Ink and nothing else; a new item is
//     added to `owned` and the Reliquary progress resets (ReliquaryScreen.tsx:44-54);
//   · the rarity border: fabled → gilt, rare → brass, else parchment-dim (:60);
//   · the chest frames: 0 closed, 1-6 the opening sequence, 7 open (:69).
import { palette } from '@/theme/tokens';

export type ReliquaryRarity = 'common' | 'rare' | 'fabled';
export type ReliquaryKind = 'seals' | 'boards' | 'frames' | 'numerals' | 'stamps' | 'banners';

export interface ReliquaryItem {
  id: string;
  name: string;
  rarity: ReliquaryRarity;
  kind: ReliquaryKind;
}

/** The web ReliquaryScreen's DROP_TABLE, verbatim — the same 15 relics, same order. */
export const DROP_TABLE: readonly ReliquaryItem[] = [
  { id: 'wax-verdigris', name: 'Verdigris Wax', rarity: 'common', kind: 'seals' },
  { id: 'wax-gilt', name: 'Gilt Wax', rarity: 'common', kind: 'seals' },
  { id: 'board-bone', name: 'Bone Board', rarity: 'common', kind: 'boards' },
  { id: 'board-slate', name: 'Slate Board', rarity: 'common', kind: 'boards' },
  { id: 'frame-iron', name: 'Iron Frame', rarity: 'common', kind: 'frames' },
  { id: 'numerals-gothic', name: 'Gothic Numerals', rarity: 'common', kind: 'numerals' },
  { id: 'stamp-laurel', name: 'Laurel Stamp', rarity: 'common', kind: 'stamps' },
  { id: 'stamp-crown', name: 'Crown Stamp', rarity: 'rare', kind: 'stamps' },
  { id: 'frame-bone', name: 'Bone-inlay Frame', rarity: 'rare', kind: 'frames' },
  { id: 'banner-rubric', name: 'Rubric Banner', rarity: 'rare', kind: 'banners' },
  { id: 'board-plague-linen', name: 'Plague Linen Board', rarity: 'rare', kind: 'boards' },
  { id: 'wax-ash', name: 'Ash Wax', rarity: 'rare', kind: 'seals' },
  { id: 'board-cathedral', name: 'Cathedral Rubric Board', rarity: 'fabled', kind: 'boards' },
  { id: 'frame-lacquer', name: 'Black-lacquer Frame', rarity: 'fabled', kind: 'frames' },
  { id: 'banner-ninth', name: 'The Ninth Banner', rarity: 'fabled', kind: 'banners' },
];

/** The duplicate's Ink award — the i18n line's own "+40 Ink", and T13's `reliquary` cap. */
export const RELIQUARY_DUPLICATE_INK = 40;

/** the web's roll ternary: <0.6 common, <0.9 rare, else fabled */
export const rarityForRoll = (roll: number): ReliquaryRarity =>
  roll < 0.6 ? 'common' : roll < 0.9 ? 'rare' : 'fabled';

export const itemsOfRarity = (rarity: ReliquaryRarity): ReliquaryItem[] =>
  DROP_TABLE.filter((d) => d.rarity === rarity);

/** the web's pool pick — the die is injectable so the gate can pin the selection */
export const rollItem = (roll: number, die: () => number = Math.random): ReliquaryItem | null => {
  const pool = itemsOfRarity(rarityForRoll(roll));
  if (!pool.length) return null;
  return pool[Math.floor(die() * pool.length)];
};

/** the web's duplicateGranted(): a duplicate grants Ink instead of the item */
export const duplicateGranted = (item: { id: string }, owned: readonly string[]): boolean =>
  owned.includes(item.id);

/**
 * The award law, once: a duplicate → `duplicate` true and 40 Ink granted once;
 * a new relic → owned grows and the Reliquary progress resets. The caller applies
 * it to the save exactly like the web's two update branches.
 */
export const reliquaryAward = (item: ReliquaryItem, owned: readonly string[]) => {
  if (duplicateGranted(item, owned)) return { duplicate: true as const, ink: RELIQUARY_DUPLICATE_INK };
  return { duplicate: false as const, ink: 0 };
};

/** the web's rarity border: fabled → gilt, rare → brass, common → parchment-dim */
export const rarityBorderColor = (rarity: ReliquaryRarity | undefined): string =>
  rarity === 'fabled' ? palette.gilt : rarity === 'rare' ? palette.brass : palette.parchmentDim;

/** the chest's 8 frames: 0 closed, 1-6 the opening sequence, 7 open (web ternary) */
export const chestAssetName = (frame: number): string =>
  frame === 0 ? 'chest-closed' : frame === 7 ? 'chest-open' : `chest-opening-${frame}`;
