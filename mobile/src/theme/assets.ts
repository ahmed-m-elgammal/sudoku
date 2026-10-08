// ASSIZE mobile — the asset registry.
//
// The web build served everything out of ../public/assets by absolute URL
// (`/assets/plates/plate-orsolo-reveal.webp`). React Native has no document root, so
// every asset is bundled and addressed here. The real files were copied verbatim from
// ../public/assets into mobile/assets/ — 222 files, 18.4 MB, including the WebP twins
// that T9 produced.
//
// require() (not a path string) is what makes Metro bundle the file, so every entry
// below is a build input: renaming a file breaks the build here, loudly and at the
// one place you would look.
//
// story payloads carry plates as web paths (they are data). `imageForPath` maps such a
// path onto a bundled key so a screen can render a plate it was handed without knowing
// about bundling. An unmapped path returns null and the plate degrades to the
// parchment ground — never a crash.

// Metro requires literal strings in require() — no variable interpolation.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _A = '../../assets/game'; // kept for documentation only

export const images = {
  // ---- brand
  icon192: require('../../assets/game/brand/app-icon-192.png'),
  icon512: require('../../assets/game/brand/app-icon-512.png'),
  iconMaster: require('../../assets/game/brand/app-icon-master.png'),
  iconMaskable: require('../../assets/game/brand/app-icon-maskable.png'),
  ogImage: require('../../assets/game/brand/og-image.png'),
  splash828: require('../../assets/game/brand/splash-828.png'),
  wordmark: require('../../assets/game/brand/wordmark.png'),

  // ---- story plates
  platePrologue: require('../../assets/game/plates/plate-prologue.webp'),
  plateFolio1: require('../../assets/game/plates/plate-folio-1.webp'),
  plateFolio2: require('../../assets/game/plates/plate-folio-2.webp'),
  plateFolio3: require('../../assets/game/plates/plate-folio-3.webp'),
  plateFolio4: require('../../assets/game/plates/plate-folio-4.webp'),
  plateFolio5: require('../../assets/game/plates/plate-folio-5.webp'),
  plateFolio6: require('../../assets/game/plates/plate-folio-6.webp'),
  plateFolio7: require('../../assets/game/plates/plate-folio-7.webp'),
  plateFolio8: require('../../assets/game/plates/plate-folio-8.webp'),
  plateFolio9: require('../../assets/game/plates/plate-folio-9.webp'),
  plateInterlude1: require('../../assets/game/plates/plate-interlude-1.webp'),
  plateInterlude2: require('../../assets/game/plates/plate-interlude-2.webp'),
  plateOrsoloReveal: require('../../assets/game/plates/plate-orsolo-reveal.webp'),
  plateEndingBalance: require('../../assets/game/plates/plate-ending-balance.webp'),
  plateEndingBurn: require('../../assets/game/plates/plate-ending-burn.webp'),

  // ---- portraits (webp twins — the pngs stay for the web build)
  clerk: require('../../assets/game/portraits/clerk.webp'),
  magAnsel: require('../../assets/game/portraits/mag-anselm.webp'),
  magCorvane: require('../../assets/game/portraits/mag-corvane.webp'),
  magHalbrecht: require('../../assets/game/portraits/mag-halbrecht.webp'),
  magIlse: require('../../assets/game/portraits/mag-ilse.webp'),
  magMarchetti: require('../../assets/game/portraits/mag-marchetti.webp'),
  magNox: require('../../assets/game/portraits/mag-nox.webp'),
  magOrsolo: require('../../assets/game/portraits/mag-orsolo.webp'),
  magQuill: require('../../assets/game/portraits/mag-quill.webp'),
  magVael: require('../../assets/game/portraits/mag-vael.webp'),
  orderApothecary: require('../../assets/game/portraits/order-apothecary.webp'),
  orderExecutioner: require('../../assets/game/portraits/order-executioner.webp'),
  orderScholar: require('../../assets/game/portraits/order-scholar.webp'),
  orderWarden: require('../../assets/game/portraits/order-warden.webp'),
  shadeMark: require('../../assets/game/portraits/shade-mark.webp'),
  shadeOrsolo: require('../../assets/game/portraits/shade-orsolo.webp'),

  // ---- the folio map (the heaviest single asset: 1.15 MB webp)
  folioMap: require('../../assets/game/map/folio-map.webp'),
} as const;

export type ImageKey = keyof typeof images;

const BY_PATH: Record<string, ImageKey> = {
  '/assets/plates/plate-prologue.webp': 'platePrologue',
  '/assets/plates/plate-folio-1.webp': 'plateFolio1',
  '/assets/plates/plate-folio-2.webp': 'plateFolio2',
  '/assets/plates/plate-folio-3.webp': 'plateFolio3',
  '/assets/plates/plate-folio-4.webp': 'plateFolio4',
  '/assets/plates/plate-folio-5.webp': 'plateFolio5',
  '/assets/plates/plate-folio-6.webp': 'plateFolio6',
  '/assets/plates/plate-folio-7.webp': 'plateFolio7',
  '/assets/plates/plate-folio-8.webp': 'plateFolio8',
  '/assets/plates/plate-folio-9.webp': 'plateFolio9',
  '/assets/plates/plate-interlude-1.webp': 'plateInterlude1',
  '/assets/plates/plate-interlude-2.webp': 'plateInterlude2',
  '/assets/plates/plate-orsolo-reveal.webp': 'plateOrsoloReveal',
  '/assets/plates/plate-ending-balance.webp': 'plateEndingBalance',
  '/assets/plates/plate-ending-burn.webp': 'plateEndingBurn',
  '/assets/map/folio-map.webp': 'folioMap',
  '/assets/portraits/clerk.webp': 'clerk',
  '/assets/portraits/shade-orsolo.webp': 'shadeOrsolo',
  '/assets/portraits/shade-mark.webp': 'shadeMark',
  '/assets/portraits/order-scholar.webp': 'orderScholar',
  '/assets/portraits/order-executioner.webp': 'orderExecutioner',
  '/assets/portraits/order-apothecary.webp': 'orderApothecary',
  '/assets/portraits/order-warden.webp': 'orderWarden',
};

/** Map a web asset path (story data, campaign data) onto a bundled image. */
export function imageForPath(path: string | null | undefined) {
  if (!path) return null;
  const direct = BY_PATH[path];
  if (direct) return images[direct];
  // .png twins of the same art
  const webp = path.replace(/\.png$/, '.webp');
  const viaWebp = BY_PATH[webp];
  if (viaWebp) return images[viaWebp];
  // portraits/orders addressed by bare name, e.g. 'mag-orsolo'
  const bare = path.split('/').pop()?.replace(/\.(png|webp)$/, '');
  if (bare) {
    const camel = bare.replace(/-([a-z0-9])/g, (_m, c: string) => c.toUpperCase());
    if (camel in images) return images[camel as ImageKey];
  }
  return null;
}

/** The nine Magistrates' portraits, keyed by the campaign's portrait slugs. */
export const magistratePortraits: Record<string, ImageKey> = {
  anselm: 'magAnsel',
  corvane: 'magCorvane',
  halbrecht: 'magHalbrecht',
  ilse: 'magIlse',
  marchetti: 'magMarchetti',
  nox: 'magNox',
  orsolo: 'magOrsolo',
  quill: 'magQuill',
  vael: 'magVael',
};

export const orderPortraits: Record<string, ImageKey> = {
  scholar: 'orderScholar',
  executioner: 'orderExecutioner',
  apothecary: 'orderApothecary',
  warden: 'orderWarden',
};

/**
 * The engraved kit's SVG sources are not bundled on native — screens render the
 * raster twins (`tools/rasterize-game-art.mjs`) through `src/ui/Art.tsx`. This helper
 * remains only as a path documentation of the assets/game tree; prefer a literal
 * require of the twin through a registry (duelArt.ts, cabinetArt.ts, ledgerArt.ts).
 */
export const svgAsset = (relative: string): string =>
  `../../assets/game/${relative.replace(/^\//, '')}`;
