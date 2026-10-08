// ASSIZE mobile — the DUEL's engraved SVG registry.
//
// The duel is the one screen that leans hardest on the procedural SVG kit: seals,
// sigils, board furniture, status overlays, the num-tile and medallion chrome. The web
// build addressed all of them by absolute URL in a stylesheet or a `background-image`.
//
// React Native has two constraints this file exists to satisfy:
//
//   1. Metro only bundles a file when it sees a literal `require()`. Every entry below
//      is one explicit require — no template-built paths, no runtime strings. Renaming a
//      file breaks the BUILD, loudly, at the one place you would look.
//   2. Metro treats `.svg` as an asset (see metro.config.js `assetExts`), so `require()`
//      returns a numeric asset ID. We convert that to a URI string via
//      `Image.resolveAssetSource()` so react-native-svg's <SvgUri> can render it.
//
// The web build's `/assets/...` paths appear as DATA inside `shared/orders.ts` (order
// portraits and ability sigils) and `story.json` (plates). `svgUriFor` maps such a path
// onto a bundled URI so a screen can render art it was handed without knowing about
// bundling. An unmapped path returns null and the mark degrades to nothing — never a crash.
//
// This is a portrait (PNG/WebP) is handled in `theme/assets.ts`; SVGs live here because
// only the duel uses them at this stage.

import { Image } from 'react-native';

/** Convert a Metro asset ID (from require()) to a URI string that SvgUri can render. */
export function resolveUri(assetId: number): string {
  const source = Image.resolveAssetSource(assetId);
  return source?.uri ?? '';
}

// Metro requires literal strings in require() — no variable interpolation.

export const duelSvgs = {
  // ---- board ground + furniture
  parchmentVellum: resolveUri(require('../../../assets/game/textures/parchment-aged-vellum.svg')),
  parchmentTallow: resolveUri(require('../../../assets/game/textures/parchment-tallow.svg')),
  boxLine: resolveUri(require('../../../assets/game/board/box-line.svg')),
  gridLine: resolveUri(require('../../../assets/game/board/grid-line.svg')),
  gutterStrip: resolveUri(require('../../../assets/game/board/gutter-strip.svg')),
  cornerNW: resolveUri(require('../../../assets/game/board/corner-nw.svg')),
  cornerNE: resolveUri(require('../../../assets/game/board/corner-ne.svg')),
  cornerSW: resolveUri(require('../../../assets/game/board/corner-sw.svg')),
  cornerSE: resolveUri(require('../../../assets/game/board/corner-se.svg')),

  // ---- cell status overlays + the wrong-ink strike-through (3 variants)
  overlayChain: resolveUri(require('../../../assets/game/overlays/chain.svg')),
  overlaySmudge: resolveUri(require('../../../assets/game/overlays/smudge.svg')),
  overlayMiasma: resolveUri(require('../../../assets/game/overlays/miasma.svg')),
  overlayHush: resolveUri(require('../../../assets/game/overlays/hush.svg')),
  overlayQuarantine: resolveUri(require('../../../assets/game/overlays/quarantine.svg')),
  strike1: resolveUri(require('../../../assets/game/overlays/strike-1.svg')),
  strike2: resolveUri(require('../../../assets/game/overlays/strike-2.svg')),
  strike3: resolveUri(require('../../../assets/game/overlays/strike-3.svg')),

  // ---- the num pad chrome
  numTileNormal: resolveUri(require('../../../assets/game/ui/num-tile-normal.svg')),
  numTileComplete: resolveUri(require('../../../assets/game/ui/num-tile-complete.svg')),
  numTilePressed: resolveUri(require('../../../assets/game/ui/num-tile-pressed.svg')),

  // ---- HUD chrome
  medallion: resolveUri(require('../../../assets/game/ui/medallion.svg')),
  tabRibbon: resolveUri(require('../../../assets/game/ui/tab-ribbon.svg')),
  modalSheet: resolveUri(require('../../../assets/game/ui/modal-sheet.svg')),
  panelParchment: resolveUri(require('../../../assets/game/ui/panel-parchment.svg')),
  abilityTile: resolveUri(require('../../../assets/game/ui/ability-tile.svg')),
  divider1: resolveUri(require('../../../assets/game/ui/divider-1.svg')),

  // ---- status chips (the 5 anti-frustration statuses)
  statusChain: resolveUri(require('../../../assets/game/statuses/status-chain.svg')),
  statusSmudge: resolveUri(require('../../../assets/game/statuses/status-smudge.svg')),
  statusHush: resolveUri(require('../../../assets/game/statuses/status-hush.svg')),
  statusMiasma: resolveUri(require('../../../assets/game/statuses/status-miasma.svg')),
  statusQuarantine: resolveUri(require('../../../assets/game/statuses/status-quarantine.svg')),

  // ---- claim stamps: the Mirror strip / board gutters mark ownership
  stampFleur: resolveUri(require('../../../assets/game/seals/stamps/stamp-fleur.svg')), // seat 0 (you) — oxblood
  stampTau: resolveUri(require('../../../assets/game/seals/stamps/stamp-tau.svg')),     // seat 1 (foe) — ash

  // ---- the twelve ability sigils, named exactly as `shared/orders.ts` names them
  //      (`icon: 'sigil-eye'` etc.), so lookup is a plain map lookup, not a guess.
  'sigil-eye': resolveUri(require('../../../assets/game/sigils/sigil-eye.svg')),       // augur
  'sigil-key': resolveUri(require('../../../assets/game/sigils/sigil-key.svg')),       // unseal
  'sigil-quill': resolveUri(require('../../../assets/game/sigils/sigil-quill.svg')),   // fairCopy
  'sigil-dagger': resolveUri(require('../../../assets/game/sigils/sigil-dagger.svg')), // sever
  'sigil-hourglass': resolveUri(require('../../../assets/game/sigils/sigil-hourglass.svg')), // hush
  'sigil-axe': resolveUri(require('../../../assets/game/sigils/sigil-axe.svg')),       // reckoning
  'sigil-vial': resolveUri(require('../../../assets/game/sigils/sigil-vial.svg')),     // smudge
  'sigil-cup': resolveUri(require('../../../assets/game/sigils/sigil-cup.svg')),       // tincture
  'sigil-censer': resolveUri(require('../../../assets/game/sigils/sigil-censer.svg')), // miasma
  'sigil-shield': resolveUri(require('../../../assets/game/sigils/sigil-shield.svg')), // ward
  'sigil-lantern': resolveUri(require('../../../assets/game/sigils/sigil-lantern.svg')), // mirror
  'sigil-bar': resolveUri(require('../../../assets/game/sigils/sigil-bar.svg')),       // quarantine

  // ---- misc marks
  inkDrop: resolveUri(require('../../../assets/game/icons/ink-drop.svg')),
} as const;

export type DuelSvgKey = keyof typeof duelSvgs;

// The 5 statuses, keyed the way `shared/engine` names them.
export const statusSvg: Record<string, DuelSvgKey> = {
  chain: 'statusChain',
  smudge: 'statusSmudge',
  hush: 'statusHush',
  miasma: 'statusMiasma',
  quarantine: 'statusQuarantine',
};

// The 3 strike-through variants for a wrong digit (index 0..2).
export const strikeSvg: readonly DuelSvgKey[] = ['strike1', 'strike2', 'strike3'];

/**
 * The sigil URI for an ability's `icon` slug (the value `shared/orders.ts` already carries).
 * Returns the resolved URI string so it can be passed directly to SvgUri.
 */
export function sigilSvg(slug: string | undefined | null): string | null {
  if (!slug) return null;
  return slug in duelSvgs ? duelSvgs[slug as DuelSvgKey] : null;
}

/**
 * Map a web asset path (`/assets/…`, the form used as DATA by `shared/` and
 * `story.json`) onto a bundled URI. Null when unmapped — the caller degrades.
 */
const BY_WEB_PATH: Record<string, DuelSvgKey> = {
  '/assets/ui/medallion.svg': 'medallion',
  '/assets/overlays/chain.svg': 'overlayChain',
  '/assets/overlays/smudge.svg': 'overlaySmudge',
  '/assets/overlays/miasma.svg': 'overlayMiasma',
  '/assets/overlays/hush.svg': 'overlayHush',
  '/assets/overlays/quarantine.svg': 'overlayQuarantine',
  '/assets/overlays/strike-1.svg': 'strike1',
  '/assets/overlays/strike-2.svg': 'strike2',
  '/assets/overlays/strike-3.svg': 'strike3',
  '/assets/ui/num-tile-normal.svg': 'numTileNormal',
  '/assets/ui/num-tile-complete.svg': 'numTileComplete',
  '/assets/ui/num-tile-pressed.svg': 'numTilePressed',
  '/assets/ui/tab-ribbon.svg': 'tabRibbon',
  '/assets/ui/panel-parchment.svg': 'panelParchment',
  '/assets/ui/ability-tile.svg': 'abilityTile',
  '/assets/ui/modal-sheet.svg': 'modalSheet',
  '/assets/seals/stamps/stamp-fleur.svg': 'stampFleur',
  '/assets/seals/stamps/stamp-tau.svg': 'stampTau',
  '/assets/textures/parchment-aged-vellum.svg': 'parchmentVellum',
  '/assets/textures/parchment-tallow.svg': 'parchmentTallow',
  '/assets/board/box-line.svg': 'boxLine',
  '/assets/board/grid-line.svg': 'gridLine',
  '/assets/board/gutter-strip.svg': 'gutterStrip',
  '/assets/icons/ink-drop.svg': 'inkDrop',
};

export function svgUriFor(webPath: string | null | undefined): string | null {
  if (!webPath) return null;
  const key = BY_WEB_PATH[webPath];
  return key ? duelSvgs[key] : null;
}