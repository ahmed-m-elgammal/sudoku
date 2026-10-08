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
  scrivener: require('../../../assets/game/ranks/rank-scrivener.svg'),
  clerk: require('../../../assets/game/ranks/rank-clerk.svg'),
  notary: require('../../../assets/game/ranks/rank-notary.svg'),
  advocate: require('../../../assets/game/ranks/rank-advocate.svg'),
  magistrate: require('../../../assets/game/ranks/rank-magistrate.svg'),
  'high-magistrate': require('../../../assets/game/ranks/rank-high-magistrate.svg'),
  justiciar: require('../../../assets/game/ranks/rank-justiciar.svg'),
  'lord-of-the-assize': require('../../../assets/game/ranks/rank-lord-of-the-assize.svg'),
};

const ACHIEVEMENT_ART: Record<string, number> = {
  'apothecary-sworn': require('../../../assets/game/achievements/achievement-apothecary-sworn.svg'),
  'augur-faithful': require('../../../assets/game/achievements/achievement-augur-faithful.svg'),
  'box-wright': require('../../../assets/game/achievements/achievement-box-wright.svg'),
  'clean-hand': require('../../../assets/game/achievements/achievement-clean-hand.svg'),
  'column-saint': require('../../../assets/game/achievements/achievement-column-saint.svg'),
  'daily-ember': require('../../../assets/game/achievements/achievement-daily-ember.svg'),
  'executioner-sworn': require('../../../assets/game/achievements/achievement-executioner-sworn.svg'),
  'first-blood': require('../../../assets/game/achievements/achievement-first-blood.svg'),
  flinchless: require('../../../assets/game/achievements/achievement-flinchless.svg'),
  'folio-fifth': require('../../../assets/game/achievements/achievement-folio-fifth.svg'),
  'folio-first': require('../../../assets/game/achievements/achievement-folio-first.svg'),
  'folio-ninth': require('../../../assets/game/achievements/achievement-folio-ninth.svg'),
  'hush-proof': require('../../../assets/game/achievements/achievement-hush-proof.svg'),
  'ledger-keeper': require('../../../assets/game/achievements/achievement-ledger-keeper.svg'),
  'miasma-walker': require('../../../assets/game/achievements/achievement-miasma-walker.svg'),
  'reckoning-dealt': require('../../../assets/game/achievements/achievement-reckoning-dealt.svg'),
  'row-lord': require('../../../assets/game/achievements/achievement-row-lord.svg'),
  'scholar-sworn': require('../../../assets/game/achievements/achievement-scholar-sworn.svg'),
  'seal-breaker': require('../../../assets/game/achievements/achievement-seal-breaker.svg'),
  'smudge-reader': require('../../../assets/game/achievements/achievement-smudge-reader.svg'),
  'streak-seven': require('../../../assets/game/achievements/achievement-streak-seven.svg'),
  'tide-turner': require('../../../assets/game/achievements/achievement-tide-turner.svg'),
  unchained: require('../../../assets/game/achievements/achievement-unchained.svg'),
  'warden-sworn': require('../../../assets/game/achievements/achievement-warden-sworn.svg'),
  'weekly-sat': require('../../../assets/game/achievements/achievement-weekly-sat.svg'),
};

const PURSE_ICONS = {
  inkDrop: require('../../../assets/game/icons/ink-drop.svg'),
  sigilCoin: require('../../../assets/game/icons/sigil-coin.svg'),
  chestClosed: require('../../../assets/game/reliquary/chest-closed.svg'),
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
