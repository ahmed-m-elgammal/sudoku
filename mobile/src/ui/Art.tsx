// Art.tsx — the ONE render seam for the bundled game art on native.
//
// The engraved SVG kit (seals, sigils, board furniture, textures, chrome) ships as
// RASTER TWINS generated offline by `tools/rasterize-game-art.mjs` (sharp/librsvg —
// which implements feTurbulence/feDisplacementMap, unlike react-native-svg on
// native). Registries (duelArt.ts, cabinetArt.ts, ledgerArt.ts, theme/assets.ts)
// turn a Metro require into a URI string; this component paints it.
//
// Why not <SvgUri>: react-native-svg implements none of the kit's SVG filters and
// had to fetch + XML-parse every asset on every mount — the measured source of the
// "unsupported SVG filter" console warnings and the 0 fps stalls when iterating
// screens. A native <Image> decodes the twin once per texture and lets the OS cache
// it. react-native-svg stays ONLY for procedural geometry (cooldown rings, the
// Ledger spark) — never for the bundled art.
//
// Fidelity: `mode` defaults to 'contain' (the SVG `preserveAspectRatio="xMidYMid
// meet"` behaviour <SvgUri> had); the two full-bleed sites the web built with
// `background ... cover` pass mode="cover" (the SVG word for it was `slice`).
// An empty uri renders null — the same degrade-to-nothing law the registries follow.

import { Image, type ImageStyle, type StyleProp } from 'react-native';

export interface ArtProps {
  uri: string | null | undefined;
  width?: number | `${number}%`;
  height?: number | `${number}%`;
  /** 'contain' = SVG meet (default), 'cover' = SVG slice / CSS cover. */
  mode?: 'contain' | 'cover';
  opacity?: number;
  style?: StyleProp<ImageStyle>;
  accessibilityLabel?: string;
}

export default function Art({
  uri,
  width,
  height,
  mode = 'contain',
  opacity,
  style,
  accessibilityLabel,
}: ArtProps) {
  if (!uri) return null;
  return (
    <Image
      source={{ uri }}
      resizeMode={mode}
      fadeDuration={0}
      style={[{ width, height }, opacity != null ? { opacity } : null, style]}
      accessibilityLabel={accessibilityLabel}
    />
  );
}
