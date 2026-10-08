// CabinetScreen art — the Metro-only seam (the duelAssets.ts law).
//
// Metro bundles a file only through a literal require(), and Image.resolveAssetSource
// turns the asset id into the URI the Art seam paints (see ../Art.tsx). The ITEMS table in cabinetLaw.ts
// carries the web's `/assets/...` paths as DATA; this registry maps each one onto the
// bundled copy (all 20 unique files exist in assets/game/**, the 222-file verbatim
// copy of ../public/assets).
//
// This module is deliberately ONLY art: no logic, no copy. The screen imports it for
// the preview plates; the component tests mock it (vi.mock) so the shop's flows stay
// provable under vitest without Metro's asset pipeline — the same documented split
// of proof the ReliquaryScreen uses, with the seam drawn one file thinner.
import { Image } from 'react-native';

// Metro requires literal strings in require() — no variable interpolation.
const ART: Record<string, number> = {
  // ---- board themes (the six parchment textures)
  '/assets/textures/parchment-aged-vellum.svg': require('../../../assets/game/textures/parchment-aged-vellum.webp'),
  '/assets/textures/parchment-bone.svg': require('../../../assets/game/textures/parchment-bone.webp'),
  '/assets/textures/parchment-slate.svg': require('../../../assets/game/textures/parchment-slate.webp'),
  '/assets/textures/parchment-plague-linen.svg': require('../../../assets/game/textures/parchment-plague-linen.webp'),
  '/assets/textures/parchment-tallow.svg': require('../../../assets/game/textures/parchment-tallow.webp'),
  '/assets/textures/parchment-cathedral-rubric.svg': require('../../../assets/game/textures/parchment-cathedral-rubric.webp'),

  // ---- seal waxes (stamps + intact seals, exactly as the web table addresses them)
  '/assets/seals/stamps/stamp-fleur.svg': require('../../../assets/game/seals/stamps/stamp-fleur.png'),
  '/assets/seals/stamps/stamp-tau.svg': require('../../../assets/game/seals/stamps/stamp-tau.png'),
  '/assets/seals/stamps/stamp-laurel.svg': require('../../../assets/game/seals/stamps/stamp-laurel.png'),
  '/assets/seals/stamps/stamp-crown.svg': require('../../../assets/game/seals/stamps/stamp-crown.png'),
  '/assets/seals/stamps/stamp-tower.svg': require('../../../assets/game/seals/stamps/stamp-tower.png'),
  '/assets/seals/stamps/stamp-scale.svg': require('../../../assets/game/seals/stamps/stamp-scale.png'),
  '/assets/seals/seal-verdigris-intact.svg': require('../../../assets/game/seals/seal-verdigris-intact.png'),
  '/assets/seals/seal-gilt-intact.svg': require('../../../assets/game/seals/seal-gilt-intact.png'),
  '/assets/seals/seal-ash-intact.svg': require('../../../assets/game/seals/seal-ash-intact.png'),

  // ---- frames + numerals (the web table reuses the brass frame and the num tile)
  '/assets/ui/frame-brass.svg': require('../../../assets/game/ui/frame-brass.png'),
  '/assets/ui/num-tile-normal.svg': require('../../../assets/game/ui/num-tile-normal.png'),

  // ---- victory banners
  '/assets/ui/divider-1.svg': require('../../../assets/game/ui/divider-1.png'),
  '/assets/ui/divider-2.svg': require('../../../assets/game/ui/divider-2.png'),
  '/assets/ui/divider-3.svg': require('../../../assets/game/ui/divider-3.png'),

  // ---- the header's purse icons
  '/assets/icons/ink-drop.svg': require('../../../assets/game/icons/ink-drop.png'),
  '/assets/icons/sigil-coin.svg': require('../../../assets/game/icons/sigil-coin.png'),
};

/**
 * The bundled URI for a web asset path, or '' when unmapped — the caller degrades
 * to no art, never a crash (the artUriFor law).
 */
export function cabinetArtUri(webPath: string): string {
  return webPath in ART ? (Image.resolveAssetSource(ART[webPath])?.uri ?? '') : '';
}
