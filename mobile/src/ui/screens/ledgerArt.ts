// ledgerArt.ts — the 5.5/5.6 screens' bundled SVG chrome (the cabinetArt law).
//
// Metro-only requires, ONE seam, no logic beyond the resolvers: module-scope SVG
// requires fail the vitest transform, so — exactly as CabinetScreen did with
// cabinetArt.ts — the art lives here and the component tests vi.mock THIS SEAM
// while the real screens render under vitest (the documented split of proof).
//
// Every entry is a literal require() (no variable interpolation): that is what
// makes Metro bundle the file. Renaming a file breaks the build here, loudly.
//
// Art inventory (all verified present in assets/game/):
//   - the 8 rank emblems (rank-${id}.svg, the rankOfStanding ids)
//   - 25 of the 26 Marginalia icons — 'endless-ten' has NO art file. The web
//     <img> renders a broken image for it; the port degrades identically: no
//     art, the title + desc still tell (the Reliquary precedent, defect (b)).
//   - the Purse's three explainer icons (ink-drop, sigil-coin, chest-closed)
import { Image } from 'react-native';

const RANK_EMBLEMS: Record<string, number> = {
  scrivener: require('../../../assets/game/ranks/rank-scrivener.png'),
  clerk: require('../../../assets/game/ranks/rank-clerk.png'),
  notary: require('../../../assets/game/ranks/rank-notary.png'),
  advocate: require('../../../assets/game/ranks/rank-advocate.png'),
  magistrate: require('../../../assets/game/ranks/rank-magistrate.png'),
  'high-magistrate': require('../../../assets/game/ranks/rank-high-magistrate.png'),
  justiciar: require('../../../assets/game/ranks/rank-justiciar.png'),
  'lord-of-the-assize': require('../../../assets/game/ranks/rank-lord-of-the-assize.png'),
};

const ACHIEVEMENT_ART: Record<string, number> = {
  'apothecary-sworn': require('../../../assets/game/achievements/achievement-apothecary-sworn.png'),
  'augur-faithful': require('../../../assets/game/achievements/achievement-augur-faithful.png'),
  'box-wright': require('../../../assets/game/achievements/achievement-box-wright.png'),
  'clean-hand': require('../../../assets/game/achievements/achievement-clean-hand.png'),
  'column-saint': require('../../../assets/game/achievements/achievement-column-saint.png'),
  'daily-ember': require('../../../assets/game/achievements/achievement-daily-ember.png'),
  'executioner-sworn': require('../../../assets/game/achievements/achievement-executioner-sworn.png'),
  'first-blood': require('../../../assets/game/achievements/achievement-first-blood.png'),
  flinchless: require('../../../assets/game/achievements/achievement-flinchless.png'),
  'folio-fifth': require('../../../assets/game/achievements/achievement-folio-fifth.png'),
  'folio-first': require('../../../assets/game/achievements/achievement-folio-first.png'),
  'folio-ninth': require('../../../assets/game/achievements/achievement-folio-ninth.png'),
  'hush-proof': require('../../../assets/game/achievements/achievement-hush-proof.png'),
  'ledger-keeper': require('../../../assets/game/achievements/achievement-ledger-keeper.png'),
  'miasma-walker': require('../../../assets/game/achievements/achievement-miasma-walker.png'),
  'reckoning-dealt': require('../../../assets/game/achievements/achievement-reckoning-dealt.png'),
  'row-lord': require('../../../assets/game/achievements/achievement-row-lord.png'),
  'scholar-sworn': require('../../../assets/game/achievements/achievement-scholar-sworn.png'),
  'seal-breaker': require('../../../assets/game/achievements/achievement-seal-breaker.png'),
  'smudge-reader': require('../../../assets/game/achievements/achievement-smudge-reader.png'),
  'streak-seven': require('../../../assets/game/achievements/achievement-streak-seven.png'),
  'tide-turner': require('../../../assets/game/achievements/achievement-tide-turner.png'),
  unchained: require('../../../assets/game/achievements/achievement-unchained.png'),
  'warden-sworn': require('../../../assets/game/achievements/achievement-warden-sworn.png'),
  'weekly-sat': require('../../../assets/game/achievements/achievement-weekly-sat.png'),
};

const PURSE_ICONS = {
  inkDrop: require('../../../assets/game/icons/ink-drop.png'),
  sigilCoin: require('../../../assets/game/icons/sigil-coin.png'),
  chestClosed: require('../../../assets/game/reliquary/chest-closed.png'),
} as const;

export type PurseIcon = keyof typeof PURSE_ICONS;

const uri = (assetId: number): string => Image.resolveAssetSource(assetId)?.uri ?? '';

/** the rank emblem for a rankOfStanding id — '' degrades to no art, never a crash. */
export function rankArt(id: string): string {
  return id in RANK_EMBLEMS ? uri(RANK_EMBLEMS[id]) : '';
}

/** the Marginalia icon for an achievements dictionary id ('endless-ten' → ''). */
export function achievementArt(id: string): string {
  return id in ACHIEVEMENT_ART ? uri(ACHIEVEMENT_ART[id]) : '';
}

/** the Purse explainer's icon by its web address order (ink, sigils, reliquary). */
export function purseArt(which: PurseIcon): string {
  return uri(PURSE_ICONS[which]);
}
