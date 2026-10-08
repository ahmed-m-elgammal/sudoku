// ASSIZE mobile — the DUEL's engraved-art registry (raster twins).
//
// The duel is the one screen that leans hardest on the procedural art kit: seals,
// sigils, board furniture, status overlays, the num-tile and medallion chrome. The web
// build addressed all of them by absolute URL in a stylesheet or a `background-image`.
//
// React Native has two constraints this file exists to satisfy:
//
//   1. Metro only bundles a file when it sees a literal `require()`. Every entry below
//      is one explicit require — no template-built paths, no runtime strings. Renaming a
//      file breaks the BUILD, loudly, at the one place you would look.
//   2. The kit's SVG sources carry feTurbulence/feDisplacementMap filters that
//      react-native-svg does not implement — and runtime XML parsing of the kit per
//      mount was the measured 0 fps + unsupported-filter-warning source. So native
//      renders the RASTER TWINS generated offline by `tools/rasterize-game-art.mjs`
//      (sharp/librsvg implements the full filter spec — the grain is now actually
//      visible on device). `require()` returns the twin, `Image.resolveAssetSource()`
//      turns it into a URI, and `src/ui/Art.tsx` paints it through a native <Image>.
//      The .svg files stay in-tree as the vector source of truth, not bundled here.
//
// The web build's `/assets/...` paths appear as DATA inside `shared/orders.ts` (order
// portraits and ability sigils) and `story.json` (plates). `artUriFor` maps such a path
// onto a bundled URI so a screen can render art it was handed without knowing about
// bundling. An unmapped path returns null and the mark degrades to nothing — never a crash.
//
// Story portraits (WebP) are handled in `theme/assets.ts`; the engraved kit lives here
// because only the duel (and the hub screens that grew out of it) use it.

import { Image } from 'react-native';

/** Convert a Metro asset ID (from require()) to a URI string that the Art seam paints. */
export function resolveUri(assetId: number): string {
  const source = Image.resolveAssetSource(assetId);
  return source?.uri ?? '';
}

// Metro requires literal strings in require() — no variable interpolation.

export const duelArt = {
  // ---- board ground + furniture
  parchmentVellum: resolveUri(require('../../../assets/game/textures/parchment-aged-vellum.webp')),
  parchmentTallow: resolveUri(require('../../../assets/game/textures/parchment-tallow.webp')),
  boxLine: resolveUri(require('../../../assets/game/board/box-line.png')),
  gridLine: resolveUri(require('../../../assets/game/board/grid-line.png')),
  gutterStrip: resolveUri(require('../../../assets/game/board/gutter-strip.png')),
  cornerNW: resolveUri(require('../../../assets/game/board/corner-nw.png')),
  cornerNE: resolveUri(require('../../../assets/game/board/corner-ne.png')),
  cornerSW: resolveUri(require('../../../assets/game/board/corner-sw.png')),
  cornerSE: resolveUri(require('../../../assets/game/board/corner-se.png')),

  // ---- cell status overlays + the wrong-ink strike-through (3 variants)
  overlayChain: resolveUri(require('../../../assets/game/overlays/chain.png')),
  overlaySmudge: resolveUri(require('../../../assets/game/overlays/smudge.png')),
  overlayMiasma: resolveUri(require('../../../assets/game/overlays/miasma.png')),
  overlayHush: resolveUri(require('../../../assets/game/overlays/hush.png')),
  overlayQuarantine: resolveUri(require('../../../assets/game/overlays/quarantine.png')),
  strike1: resolveUri(require('../../../assets/game/overlays/strike-1.png')),
  strike2: resolveUri(require('../../../assets/game/overlays/strike-2.png')),
  strike3: resolveUri(require('../../../assets/game/overlays/strike-3.png')),

  // ---- the num pad chrome
  numTileNormal: resolveUri(require('../../../assets/game/ui/num-tile-normal.png')),
  numTileComplete: resolveUri(require('../../../assets/game/ui/num-tile-complete.png')),
  numTilePressed: resolveUri(require('../../../assets/game/ui/num-tile-pressed.png')),

  // ---- HUD chrome
  medallion: resolveUri(require('../../../assets/game/ui/medallion.png')),
  tabRibbon: resolveUri(require('../../../assets/game/ui/tab-ribbon.png')),
  modalSheet: resolveUri(require('../../../assets/game/ui/modal-sheet.png')),
  panelParchment: resolveUri(require('../../../assets/game/ui/panel-parchment.png')),
  abilityTile: resolveUri(require('../../../assets/game/ui/ability-tile.png')),
  divider1: resolveUri(require('../../../assets/game/ui/divider-1.png')),

  // ---- status chips (the 5 anti-frustration statuses)
  statusChain: resolveUri(require('../../../assets/game/statuses/status-chain.png')),
  statusSmudge: resolveUri(require('../../../assets/game/statuses/status-smudge.png')),
  statusHush: resolveUri(require('../../../assets/game/statuses/status-hush.png')),
  statusMiasma: resolveUri(require('../../../assets/game/statuses/status-miasma.png')),
  statusQuarantine: resolveUri(require('../../../assets/game/statuses/status-quarantine.png')),

  // ---- claim stamps: the Mirror strip / board gutters mark ownership
  stampFleur: resolveUri(require('../../../assets/game/seals/stamps/stamp-fleur.png')), // seat 0 (you) — oxblood
  stampTau: resolveUri(require('../../../assets/game/seals/stamps/stamp-tau.png')),     // seat 1 (foe) — ash

  // ---- the twelve ability sigils, named exactly as `shared/orders.ts` names them
  //      (`icon: 'sigil-eye'` etc.), so lookup is a plain map lookup, not a guess.
  'sigil-eye': resolveUri(require('../../../assets/game/sigils/sigil-eye.png')),       // augur
  'sigil-key': resolveUri(require('../../../assets/game/sigils/sigil-key.png')),       // unseal
  'sigil-quill': resolveUri(require('../../../assets/game/sigils/sigil-quill.png')),   // fairCopy
  'sigil-dagger': resolveUri(require('../../../assets/game/sigils/sigil-dagger.png')), // sever
  'sigil-hourglass': resolveUri(require('../../../assets/game/sigils/sigil-hourglass.png')), // hush
  'sigil-axe': resolveUri(require('../../../assets/game/sigils/sigil-axe.png')),       // reckoning
  'sigil-vial': resolveUri(require('../../../assets/game/sigils/sigil-vial.png')),     // smudge
  'sigil-cup': resolveUri(require('../../../assets/game/sigils/sigil-cup.png')),       // tincture
  'sigil-censer': resolveUri(require('../../../assets/game/sigils/sigil-censer.png')), // miasma
  'sigil-shield': resolveUri(require('../../../assets/game/sigils/sigil-shield.png')), // ward
  'sigil-lantern': resolveUri(require('../../../assets/game/sigils/sigil-lantern.png')), // mirror
  'sigil-bar': resolveUri(require('../../../assets/game/sigils/sigil-bar.png')),       // quarantine

  // ---- misc marks
  inkDrop: resolveUri(require('../../../assets/game/icons/ink-drop.png')),
} as const;

export type DuelArtKey = keyof typeof duelArt;

// The 5 statuses, keyed the way `shared/engine` names them.
export const statusArt: Record<string, DuelArtKey> = {
  chain: 'statusChain',
  smudge: 'statusSmudge',
  hush: 'statusHush',
  miasma: 'statusMiasma',
  quarantine: 'statusQuarantine',
};

// The 3 strike-through variants for a wrong digit (index 0..2).
export const strikeArt: readonly DuelArtKey[] = ['strike1', 'strike2', 'strike3'];

/**
 * The sigil URI for an ability's `icon` slug (the value `shared/orders.ts` already carries).
 * Returns the resolved URI string so it can be passed directly to the Art seam.
 */
export function sigilArt(slug: string | undefined | null): string | null {
  if (!slug) return null;
  return slug in duelArt ? duelArt[slug as DuelArtKey] : null;
}

/**
 * Map a web asset path (`/assets/…`, the form used as DATA by `shared/` and
 * `story.json`) onto a bundled URI. Null when unmapped — the caller degrades.
 */
const BY_WEB_PATH: Record<string, DuelArtKey> = {
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

export function artUriFor(webPath: string | null | undefined): string | null {
  if (!webPath) return null;
  const key = BY_WEB_PATH[webPath];
  return key ? duelArt[key] : null;
}