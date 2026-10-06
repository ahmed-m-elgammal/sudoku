// ASSIZE design tokens — a direct port of src/styles/tokens.css (spec §9 style bible).
//
// THE STYLE BIBLE, in one line: matte. No gradients, no glow, ever. Ink on parchment,
// brass for the frame, oxblood for your seal and ash for the foe's. If a component
// needs a drop shadow to look finished, the component is wrong.
//
// The CSS custom properties become plain constants; the `data-text` / `data-contrast`
// / `data-motion` attribute switching becomes `themeFor(settings)`.

export const palette = {
  inkBlack: '#0e0e0f',
  charcoal: '#17171a',
  charcoal2: '#1d1d21',
  parchment: '#b8a27c',
  parchmentLight: '#cdb992',
  parchmentDim: '#9a8560',
  ink: '#1a1410',
  brass: '#a58849',
  brassDim: '#6f5b31',
  oxblood: '#7b1a1f',
  oxbloodDeep: '#5c1216',
  bone: '#d8d2c4',
  verdigris: '#3e6b5a',
  gilt: '#c9a962',
  ash: '#8d8a82',
} as const;

export type Theme = {
  bg: string;
  bgRaised: string;
  bgSunken: string;
  fg: string;
  fgDim: string;
  fgBright: string;
  accent: string;
  accentDeep: string;
  line: string;
  lineStrong: string;
  focus: string;
  danger: string;
  ok: string;
  /** the flood/tint colours, which swap when the viewer is behind (J4 `cold`) */
  floodYou: string;
  floodYouSettle: string;
  floodYouCold: string;
  floodYouColdSettle: string;
  floodFoe: string;
  floodFoeSettle: string;
  /** J4 — the warm wash over the NumPad, `opacity = heat * heatWashAlpha` */
  heatWash: string;
  /** the J4 wash peaks at 0.6 of full opacity over the pad */
  heatWashAlpha: number;
  /** the cooldown ring's unfilled track */
  cdTrack: string;
  /** the Hush veil over a dead pad */
  hushVeil: string;
  /** the engraved tile grounds (num tile, ability tile) sit at this opacity */
  tileArtAlpha: number;
  textScale: number;
};

const base = {
  bg: palette.inkBlack,
  bgRaised: palette.charcoal,
  bgSunken: palette.charcoal2,
  fg: palette.parchmentLight,
  fgDim: palette.parchmentDim,
  fgBright: palette.bone,
  accent: palette.oxblood,
  accentDeep: palette.oxbloodDeep,
  line: '#3a352c',
  lineStrong: '#574e3d',
  focus: palette.brass,
  danger: palette.oxblood,
  ok: palette.verdigris,
  floodYou: 'rgba(123, 26, 31, 0.34)',
  floodYouSettle: 'rgba(123, 26, 31, 0.09)',
  floodYouCold: 'rgba(97, 78, 76, 0.34)',
  floodYouColdSettle: 'rgba(97, 78, 76, 0.10)',
  floodFoe: 'rgba(141, 138, 130, 0.40)',
  floodFoeSettle: 'rgba(141, 138, 130, 0.15)',
  // Values lifted verbatim from Duel.module.css (`--warm-brass` / numPadWarm).
  // They live here so no component ever writes a colour literal.
  heatWash: 'rgba(196, 151, 66, 0.32)',
  heatWashAlpha: 0.6,
  cdTrack: 'rgba(0, 0, 0, 0.40)',
  hushVeil: 'rgba(14, 14, 15, 0.55)',
  tileArtAlpha: 0.28,
};

// :root[data-contrast='high']
const highContrast = {
  ...base,
  fg: '#efe6d2',
  fgDim: '#cdbfa4',
  line: '#6a5f49',
  bg: '#000000',
  bgRaised: '#101012',
};

const TEXT_SCALE = { s: 0.9, m: 1, l: 1.15 } as const;

/** Resolve the theme from the player's settings — the port of the CSS cascade. */
export function themeFor(settings?: {
  contrast?: boolean;
  text?: 's' | 'm' | 'l';
}): Theme {
  const contrast = settings?.contrast ? highContrast : base;
  const text = settings?.text ?? 'm';
  return { ...contrast, textScale: TEXT_SCALE[text] ?? 1 };
}

// ------------------------------------------------------------------ type
export const fonts = {
  display: 'IM Fell English SC',
  body: 'IM Fell DW Pica',
  digit: 'Libre Caslon Text',
} as const;

const step = (px: number, scale: number) => Math.round(px * scale);

export const type = (scale = 1) => ({
  xs: step(11, scale),
  sm: step(13, scale),
  md: step(15, scale),
  lg: step(19, scale),
  xl: step(24, scale),
  xxl: step(34, scale),
});

// ------------------------------------------------------------------ layout
export const layout = {
  /** the web build capped the hub at 480px; on a phone this is just the max width */
  hubMax: 480,
  ribbonH: 64,
  radius: 4,
  radiusLg: 8,
  /** the board must fit the shorter axis on an iPhone SE */
  boardMin: 280,
  /** Apple's minimum comfortable touch target; the spec already demands 44 */
  touch: 44,
  gutter: 20,
} as const;

// ------------------------------------------------------------------ motion
export const motion = {
  fast: 120,
  med: 260,
  page: 340,
} as const;

// ------------------------------------------------------------------ faction law
// "you = oxblood, foe = ash" is the established law (the Mirror strip; both wax
// stamps are oxblood, so seat colour comes from the strip, not the stamp).
export const seat = {
  you: palette.oxblood,
  foe: palette.ash,
  tintYou: palette.oxblood,
  tintFoe: palette.ash,
} as const;
