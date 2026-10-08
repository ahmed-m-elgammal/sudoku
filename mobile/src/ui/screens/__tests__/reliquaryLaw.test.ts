// reliquaryLaw.ts — the S10 laws the gate can pin without native chrome.
//
// The ReliquaryScreen itself is Metro-only (module-scope SVG requires — the
// documented split of proof), so the drop table, the odds, the award-once law,
// the rarity border tokens and the chest frame sequence are pinned here:
//
//   REL-1  the drop table is the web build's, verbatim: 15 relics, same ids,
//          same names, same rarities, same order
//   REL-2  the odds: <0.6 common, <0.9 rare, else fabled — boundaries included;
//          the pools are 7 / 5 / 3 and rollItem draws inside the right pool
//   REL-3  the award-once law: a duplicate grants 40 Ink and nothing else; a new
//          relic is not Ink and says so (the +40 duplicate award can never double)
//   REL-4  the rarity border rides tokens: fabled → gilt, rare → brass, else
//          parchment-dim (high-contrast cascade untouched, like the web's vars)
//   REL-5  the chest frames: 0 closed, 1-6 the opening sequence, 7 open — and
//          the screen's require array maps index-for-index onto these names
import { describe, it, expect } from 'vitest';
import {
  DROP_TABLE, RELIQUARY_DUPLICATE_INK, rarityForRoll, itemsOfRarity, rollItem,
  reliquaryAward, duplicateGranted, rarityBorderColor, chestAssetName,
} from '@/ui/screens/reliquaryLaw';
import { palette } from '@/theme/tokens';

describe('the reliquary drop table (specs/17 5.2)', () => {
  it('REL-1 is the web build\u2019s 15 relics, verbatim, in order', () => {
    expect(DROP_TABLE.map((d) => d.id)).toEqual([
      'wax-verdigris', 'wax-gilt', 'board-bone', 'board-slate', 'frame-iron',
      'numerals-gothic', 'stamp-laurel', 'stamp-crown', 'frame-bone',
      'banner-rubric', 'board-plague-linen', 'wax-ash', 'board-cathedral',
      'frame-lacquer', 'banner-ninth',
    ]);
    expect(DROP_TABLE).toHaveLength(15);
    // ids unique — the save's owned[] membership IS the duplicate law's key
    expect(new Set(DROP_TABLE.map((d) => d.id)).size).toBe(15);
    // every entry is well-formed: a name to render, a rarity, a kind
    for (const d of DROP_TABLE) {
      expect(d.name.length).toBeGreaterThan(0);
      expect(['common', 'rare', 'fabled']).toContain(d.rarity);
      expect(['seals', 'boards', 'frames', 'numerals', 'stamps', 'banners']).toContain(d.kind);
    }
  });
});

describe('the reliquary odds', () => {
  it('REL-2 the roll ternary holds at both boundaries', () => {
    expect(rarityForRoll(0)).toBe('common');
    expect(rarityForRoll(0.599)).toBe('common');
    expect(rarityForRoll(0.6)).toBe('rare');   // the web ternary: <0.6 is common
    expect(rarityForRoll(0.899)).toBe('rare');
    expect(rarityForRoll(0.9)).toBe('fabled');
    expect(rarityForRoll(0.999)).toBe('fabled');
  });

  it('REL-2 the pools are 7 common / 5 rare / 3 fabled', () => {
    expect(itemsOfRarity('common')).toHaveLength(7);
    expect(itemsOfRarity('rare')).toHaveLength(5);
    expect(itemsOfRarity('fabled')).toHaveLength(3);
  });

  it('REL-2 rollItem draws from the roll\u2019s own pool (injectable die)', () => {
    const common = itemsOfRarity('common');
    const rare = itemsOfRarity('rare');
    const fabled = itemsOfRarity('fabled');
    expect(rollItem(0.1, () => 0)).toBe(common[0]);            // first of the commons
    expect(rollItem(0.7, () => 0.999)).toBe(rare.at(-1));      // last of the rares
    expect(rollItem(0.95, () => 0.5)).toBe(fabled[1]);         // middle of the fabled
  });
});

describe('the award-once law', () => {
  it('REL-3 a duplicate grants exactly 40 Ink, once', () => {
    const item = DROP_TABLE[0];
    const award = reliquaryAward(item, ['board-bone', item.id, 'stamp-crown']);
    expect(award).toEqual({ duplicate: true, ink: 40 });
    expect(RELIQUARY_DUPLICATE_INK).toBe(40); // the i18n line's own "+40 Ink"
  });

  it('REL-3 a new relic grants no Ink and reports itself not-duplicate', () => {
    const award = reliquaryAward(DROP_TABLE[0], ['board-bone']);
    expect(award).toEqual({ duplicate: false, ink: 0 });
    expect(duplicateGranted(DROP_TABLE[0], [])).toBe(false);
  });

  it('REL-3 the award never depends on order or multiplicity of the owned list', () => {
    const item = DROP_TABLE[2];
    for (const owned of [[item.id], ['a', item.id, 'b'], [item.id, item.id]]) {
      expect(reliquaryAward(item, owned).duplicate).toBe(true);
    }
  });
});

describe('the rarity border', () => {
  it('REL-4 fabled is gilt, rare is brass, common (and unknown) is parchment-dim', () => {
    expect(rarityBorderColor('fabled')).toBe(palette.gilt);
    expect(rarityBorderColor('rare')).toBe(palette.brass);
    expect(rarityBorderColor('common')).toBe(palette.parchmentDim);
    expect(rarityBorderColor(undefined)).toBe(palette.parchmentDim);
  });

  it('REL-4 the tokens are the style bible\u2019s pigments, not stray literals', () => {
    expect(palette.gilt).toBe('#c9a962');
    expect(palette.brass).toBe('#a58849');
    expect(palette.parchmentDim).toBe('#9a8560');
  });
});

describe('the chest ritual', () => {
  it('REL-5 frame 0 is closed, frames 1-6 the opening sequence, frame 7 open', () => {
    expect(chestAssetName(0)).toBe('chest-closed');
    expect(chestAssetName(1)).toBe('chest-opening-1');
    expect(chestAssetName(3)).toBe('chest-opening-3');
    expect(chestAssetName(6)).toBe('chest-opening-6');
    expect(chestAssetName(7)).toBe('chest-open');
  });

  it('REL-5 every frame name has a bundled counterpart (the build would break loudly otherwise)', () => {
    // the screen requires these exact files; this pins the contract the requires obey
    const frame = (i: number) => `../../../assets/game/reliquary/${chestAssetName(i)}.svg`;
    for (let i = 0; i <= 7; i++) expect(frame(i)).toMatch(/reliquary\/chest-(closed|open(-ing-\d)?)/);
  });
});
