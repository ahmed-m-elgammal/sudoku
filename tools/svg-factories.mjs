// ASSIZE procedural SVG factories. Each factory: (rnd, params) -> svg string.
// Style: engraved linocut/woodcut, matte, ink on parchment, single oxblood accent.
import * as L from './svg-lib.mjs';
const { INK, CHARCOAL, PARCH, PARCH_L, PARCH_D, BRASS, BRASS_D, OXBLOOD, PAPER,
  mulberry32, hashSeed, wobble, wobLine, wobRect, hatch, stipple, defs, grainOverlay, svgWrap, P } = L;

const S = (id) => id.replace(/[^a-z0-9-]/gi, '');

// ---------------------------------------------------------------- textures
const parchTints = ['#C9B48C', '#C4AE84', '#9FA3A6', '#C2B393', '#CBB488', '#B99B77'];
export const texParchment = (rnd, { variant = 0 }) => {
  const w = 1024, h = 1024, tint = parchTints[variant % parchTints.length];
  let fib = '';
  for (let i = 0; i < 90; i++) {
    const y = rnd() * h, x = rnd() * w, len = 60 + rnd() * 220;
    fib += `<path d="${wobLine(x, y, x + len, y + (rnd() - 0.5) * 14, rnd, 2)}" stroke="${PARCH_D}" stroke-width="0.7" opacity="${0.08 + rnd() * 0.1}"/>`;
  }
  const blotches = Array.from({ length: 14 }, () => {
    const cx = rnd() * w, cy = rnd() * h, r = 30 + rnd() * 90;
    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${PARCH_D}" opacity="${0.05 + rnd() * 0.07}"/>`;
  }).join('');
  return svgWrap('tp', w, h, `${defs('tp' + variant, rnd, { grain: 0.13 })}
  <rect width="${w}" height="${h}" fill="${tint}"/>${blotches}${fib}
  <rect width="${w}" height="${h}" filter="url(#grain-tp${variant})" opacity="0.5"/>
  <rect width="${w}" height="${h}" fill="url(#vig-tp${variant})"/>`, tint);
};
export const texCharcoal = (rnd) => {
  const w = 1024, h = 1024;
  let strokes = '';
  for (let i = 0; i < 400; i++) {
    const x = rnd() * w, y = rnd() * h, len = 8 + rnd() * 50, a = rnd() * Math.PI;
    strokes += `<line x1="${x}" y1="${y}" x2="${x + Math.cos(a) * len}" y2="${y + Math.sin(a) * len}" stroke="${INK}" opacity="${0.06 + rnd() * 0.1}" stroke-width="${0.6 + rnd()}"/>`;
  }
  return svgWrap('tc', w, h, `${defs('tcharc', rnd, { grain: 0.2 })}<rect width="${w}" height="${h}" fill="#232326"/>${strokes}${stipple(rnd, 0, 0, w, h, 900, 0.8, '#0A0A0B', 0.35)}`, '#232326');
};
export const texBrass = (rnd) => {
  const w = 1024, h = 1024;
  let brush = '';
  for (let i = 0; i < 160; i++) {
    const y = rnd() * h;
    brush += `<line x1="0" y1="${y}" x2="${w}" y2="${y + (rnd() - 0.5) * 8}" stroke="${BRASS_D}" opacity="${0.05 + rnd() * 0.12}" stroke-width="${0.5 + rnd() * 1.6}"/>`;
  }
  return svgWrap('tb', w, h, `${defs('tbrass', rnd, { grain: 0.1 })}<rect width="${w}" height="${h}" fill="#8F7642"/>${brush}${stipple(rnd, 0, 0, w, h, 500, 0.7, '#4E3F1E', 0.3)}`, '#8F7642');
};
export const texLeather = (rnd) => {
  const w = 1024, h = 1024;
  let grain = '';
  for (let i = 0; i < 220; i++) {
    const x = rnd() * w, y = rnd() * h, r = 3 + rnd() * 14;
    grain += `<circle cx="${x}" cy="${y}" r="${r}" stroke="#3A2B20" opacity="${0.1 + rnd() * 0.14}" fill="none" stroke-width="0.8"/>`;
  }
  return svgWrap('tl', w, h, `${defs('tleath', rnd, { grain: 0.14 })}<rect width="${w}" height="${h}" fill="#4A3626"/>${grain}${stipple(rnd, 0, 0, w, h, 700, 0.8, '#241A12', 0.35)}`, '#4A3626');
};

// ---------------------------------------------------------------- board parts
export const gridLine = (rnd) => svgWrap('gl', 64, 64,
  `<path d="${wobLine(0, 32, 64, 32, rnd, 0.8)}" stroke="${INK}" stroke-width="1.6"/><path d="${wobLine(32, 0, 32, 64, rnd, 0.8)}" stroke="${INK}" stroke-width="1.6" opacity="0.9"/>`, 'rgba(0,0,0,0)');
export const boxLine = (rnd) => svgWrap('bl', 64, 64,
  `<path d="${wobLine(0, 32, 64, 32, rnd, 0.9)}" stroke="${INK}" stroke-width="4"/><path d="${wobLine(32, 0, 32, 64, rnd, 0.9)}" stroke="${INK}" stroke-width="4" opacity="0.95"/>`, 'rgba(0,0,0,0)');
export const cornerOrnament = (rnd, { rot = 0 } = {}) => svgWrap('co', 96, 96, `
  <g transform="rotate(${rot} 48 48)">
    <path d="M6 90 L6 34 Q6 6 34 6 L90 6" stroke="${INK}" stroke-width="3" fill="none"/>
    <path d="M14 90 L14 38 Q14 14 38 14 L90 14" stroke="${INK}" stroke-width="1.2" fill="none"/>
    <path d="M20 34 Q34 20 48 34 Q40 44 20 34" stroke="${INK}" stroke-width="1.4" fill="${PARCH_L}"/>
    ${stipple(rnd, 20, 20, 30, 30, 14, 0.7, INK, 0.5)}
    <circle cx="24" cy="24" r="2.4" fill="${OXBLOOD}"/>
  </g>`, 'rgba(0,0,0,0)');
export const gutterStrip = (rnd) => svgWrap('gs', 48, 512, `
  ${defs('gstr', rnd)}<rect width="48" height="512" fill="${PARCH}"/>
  ${Array.from({ length: 9 }, (_, i) => `<path d="${wobLine(6, i * 56.9 + 8, 42, i * 56.9 + 8, rnd, 1)}" stroke="${INK}" stroke-width="1" opacity="0.55"/>`).join('')}
  <path d="${wobLine(10, 4, 10, 508, rnd, 0.8)}" stroke="${INK}" stroke-width="1.4"/>`, PARCH);

// ---------------------------------------------------------------- seals & stamps
export const waxSeal = (rnd, { wax = '#7B1A1F', state = 'intact' } = {}) => {
  const id = 'ws' + hashSeed(wax + state).toString(36);
  const scallop = Array.from({ length: 22 }, (_, i) => {
    const a = (i / 22) * Math.PI * 2, r = 52 + Math.sin(i * 2.4) * 3.4;
    return `${i === 0 ? 'M' : 'L'}${(64 + Math.cos(a) * r).toFixed(1)} ${(64 + Math.sin(a) * r).toFixed(1)}`;
  }).join(' ') + ' Z';
  const cracks = state === 'intact' ? '' : state === 'cracked'
    ? `${P('M40 30 L58 52 L52 66 L70 88', INK, 2)}${P('M84 40 L70 58', INK, 1.6)}`
    : `${P('M36 28 L58 52 L50 68 L72 92', INK, 2.6)}${P('M92 44 L68 60 L74 78', INK, 2.2)}${P('M30 74 L52 66', INK, 2)}`;
  const brokenBit = state === 'broken' ? `<path d="M84 88 L96 96 L82 100 Z" fill="${wax}" stroke="${INK}" stroke-width="1.6"/>` : '';
  return svgWrap(id, 128, 128, `
    ${defs(id, rnd)}<ellipse cx="64" cy="68" rx="54" ry="50" fill="${INK}" opacity="0.18"/>
    <path d="${scallop}" fill="${wax}" stroke="${INK}" stroke-width="2.4"/>
    <path d="${scallop}" fill="none" stroke="#000" stroke-width="1" opacity="0.25" transform="translate(0 3)"/>
    ${hatch(rnd, 20, 22, 88, 84, 7, 62, '#000', 0.5, 0.5).replace(/opacity/g, 'data-o')}
    <circle cx="64" cy="64" r="34" fill="none" stroke="${INK}" stroke-width="2"/>
    <circle cx="64" cy="64" r="30" fill="none" stroke="${INK}" stroke-width="0.8" opacity="0.6"/>
    <path d="M50 52 q14 -12 28 0 q-14 8 -28 0" stroke="${INK}" stroke-width="1.6" fill="none"/>
    ${cracks}${brokenBit}${grainOverlay(id, 128, 128, rnd, 90)}`, PARCH_L);
};

const stampGlyphs = {
  fleur: `M64 40 C56 52 52 58 56 66 C60 74 68 74 72 66 C76 58 72 52 64 40 Z M64 66 L64 88 M52 78 Q58 84 64 82 M76 78 Q70 84 64 82 M40 88 H88`,
  tau: `M64 38 V90 M42 38 H86`,
  laurel: `M64 88 V44 M46 52 Q64 60 82 52 M50 66 Q64 72 78 66 M46 52 Q40 46 42 38 M82 52 Q88 46 86 38`,
  crown: `M42 78 L46 48 L56 62 L64 44 L72 62 L82 48 L86 78 Z M46 86 H82`,
  tower: `M50 88 V52 H78 V88 M46 52 H82 M50 44 V36 H58 V44 M70 44 V36 H78 V44 M64 88 V72 H64`,
  scale: `M64 40 V84 M44 50 H84 M44 50 L36 68 M44 50 L52 68 M36 68 Q44 78 52 68 M84 50 L76 68 M84 50 L92 68 M76 68 Q84 78 92 68 M50 88 H78`,
};
export const claimStamp = (rnd, { design = 'fleur' } = {}) => {
  const id = 'st' + design;
  return svgWrap(id, 128, 128, `
    ${defs(id, rnd)}<ellipse cx="64" cy="70" rx="50" ry="46" fill="${INK}" opacity="0.16"/>
    <circle cx="64" cy="64" r="46" fill="${OXBLOOD}" stroke="${INK}" stroke-width="2.6"/>
    <circle cx="64" cy="64" r="46" fill="none" stroke="#000" stroke-width="1" opacity="0.3" transform="translate(0 3)"/>
    <circle cx="64" cy="64" r="36" fill="none" stroke="${INK}" stroke-width="1.6"/>
    <path d="${stampGlyphs[design]}" stroke="${INK}" stroke-width="3" fill="none" stroke-linecap="round"/>
    ${hatch(rnd, 24, 24, 80, 80, 9, 40, '#000', 0.5, 0.5)}
    ${grainOverlay(id, 128, 128, rnd, 70)}`, PARCH_L);
};

// ---------------------------------------------------------------- overlays
export const brushStrike = (rnd, { variant = 0 } = {}) => {
  const y0 = 70 + variant * 22, tilt = [-8, 6, -3][variant % 3];
  return svgWrap('bs', 256, 256, `
    <g transform="rotate(${tilt} 128 128)">
      <path d="M18 ${y0} Q70 ${y0 - 26} 130 ${y0 - 8} T238 ${y0 - 18}" stroke="${OXBLOOD}" stroke-width="${18 - variant * 3}" fill="none" stroke-linecap="round" opacity="0.92"/>
      <path d="M30 ${y0 + 12} Q90 ${y0 - 6} 150 ${y0 + 6} T226 ${y0 - 2}" stroke="${OXBLOOD}" stroke-width="6" fill="none" stroke-linecap="round" opacity="0.6"/>
      ${stipple(rnd, 20, y0 - 26, 210, 44, 90, 1.4, OXBLOOD, 0.7)}
    </g>`, 'rgba(0,0,0,0)');
};
export const chainOverlay = (rnd) => svgWrap('ch', 256, 256, `
  ${defs('chn', rnd)}
  ${[-14, 22].map((dy, k) => Array.from({ length: 5 }, (_, i) => `
    <rect x="${16 + i * 46 + (k ? 20 : 0)}" y="${96 + dy}" width="38" height="26" rx="13" fill="none" stroke="${BRASS_D}" stroke-width="5" transform="rotate(${k ? 8 : -6} ${34 + i * 46} ${110 + dy})"/>`).join('')).join('')}
  <g transform="translate(96 128)">
    <rect x="0" y="14" width="64" height="46" rx="8" fill="${BRASS}" stroke="${INK}" stroke-width="3"/>
    <path d="M14 14 V0 a18 18 0 0 1 36 0 V14" fill="none" stroke="${INK}" stroke-width="6"/>
    <circle cx="32" cy="36" r="7" fill="${INK}"/><rect x="29" y="36" width="6" height="14" fill="${INK}"/>
    ${hatch(rnd, 4, 18, 56, 38, 6, 52, '#000', 0.6, 0.4)}
  </g>`, 'rgba(0,0,0,0)');
export const smudgeBlot = (rnd) => svgWrap('sm', 256, 256, `
  <ellipse cx="128" cy="140" rx="92" ry="60" fill="${INK}" opacity="0.5"/>
  <ellipse cx="150" cy="120" rx="60" ry="40" fill="${INK}" opacity="0.35"/>
  ${stipple(rnd, 40, 80, 180, 120, 220, 1.6, INK, 0.55)}
  <path d="M60 190 q40 24 90 12" stroke="${INK}" stroke-width="10" opacity="0.4" fill="none" stroke-linecap="round"/>`, 'rgba(0,0,0,0)');
export const hushSeal = (rnd) => svgWrap('hs', 256, 256, `
  ${defs('hush', rnd)}
  <ellipse cx="128" cy="150" rx="70" ry="26" fill="#C89A94" stroke="${INK}" stroke-width="3" opacity="0.9"/>
  <ellipse cx="118" cy="146" rx="44" ry="12" fill="none" stroke="${INK}" stroke-width="2"/>
  <path d="M150 150 q20 -34 6 -44 q-14 -8 -20 8" stroke="${INK}" stroke-width="14" fill="none" stroke-linecap="round"/>
  <path d="M150 150 q20 -34 6 -44" stroke="${OXBLOOD}" stroke-width="9" fill="none" stroke-linecap="round"/>
  <circle cx="168" cy="88" r="30" fill="${OXBLOOD}" stroke="${INK}" stroke-width="2.6"/>
  <path d="M168 76 V96 M158 84 Q168 78 178 84" stroke="${PARCH_L}" stroke-width="3" fill="none"/>
  ${grainOverlay('hush', 256, 256, rnd, 110)}`, 'rgba(0,0,0,0)');
export const miasmaHatch = (rnd) => svgWrap('mi', 256, 256, `
  ${defs('mia', rnd)}
  ${Array.from({ length: 7 }, (_, i) => `<path d="M${20 + i * 34} 240 Q${40 + i * 34} ${160 - i * 8} ${20 + i * 34} ${80 + (i % 3) * 20} T${40 + i * 34} 10" stroke="#4E5B4A" stroke-width="${2 + (i % 2) * 1.4}" fill="none" opacity="${0.5 - i * 0.04}"/>`).join('')}
  ${stipple(rnd, 0, 0, 256, 256, 160, 1.4, '#3C4A3A', 0.4)}`, 'rgba(0,0,0,0)');
export const quarantineStripe = (rnd) => svgWrap('qg', 256, 64, `
  ${defs('qt', rnd)}<rect width="256" height="64" fill="${OXBLOOD}" opacity="0.16"/>
  ${Array.from({ length: 9 }, (_, i) => `<path d="M${i * 30 - 10} 70 L${i * 30 + 20} -6" stroke="${OXBLOOD}" stroke-width="9" opacity="0.8"/>`).join('')}
  <path d="${wobLine(0, 4, 256, 4, rnd, 1)}" stroke="${OXBLOOD}" stroke-width="3"/>
  <path d="${wobLine(0, 60, 256, 60, rnd, 1)}" stroke="${OXBLOOD}" stroke-width="3"/>`, 'rgba(0,0,0,0)');

// ---------------------------------------------------------------- glyphs (shared by sigils/status/achievements)
const G = {
  eye: (r) => `${P('M18 32 Q32 18 46 32 Q32 46 18 32 Z')}${P('M32 24 a8 8 0 1 1 -0.1 0')}<circle cx="32" cy="32" r="3.4" fill="${INK}"/>${stipple(r, 14, 40, 36, 10, 10, 0.6, INK, 0.5)}`,
  key: () => `${P('M28 12 a10 10 0 1 0 0.1 0 M30 22 V52 M30 40 H42 M30 48 H40')}`,
  quill: () => `${P('M44 10 Q22 22 14 50 L12 54 Q22 44 32 40 Q42 30 46 12 Z M12 54 L20 46 M10 56 L8 58')}`,
  dagger: () => `${P('M32 8 L38 26 L34 40 H30 L26 26 Z M30 40 V50 M24 52 H40 M32 52 V56')}`,
  hourglass: () => `${P('M20 10 H44 M20 54 H44 M22 12 Q22 28 32 32 Q42 28 42 12 M22 52 Q22 36 32 32 Q42 36 42 52')}${stipple(mulberry32(7), 24, 38, 16, 12, 8, 0.8, INK, 0.6)}`,
  axe: () => `${P('M40 8 L24 54 M36 12 Q20 12 16 24 Q28 28 38 22 Z')}`,
  vial: () => `${P('M28 10 H36 M30 10 V22 L22 44 Q20 52 28 54 H36 Q44 52 42 44 L34 22 V10 M25 40 H39')}<path d="M25 40 H39 L37 48 H27 Z" fill="${OXBLOOD}" stroke="${INK}" stroke-width="1.6"/>`,
  cup: () => `${P('M18 14 H46 Q46 34 32 36 Q18 34 18 14 Z M32 36 V48 M24 52 H40')}`,
  censer: () => `${P('M24 34 H40 L44 48 H20 Z M32 34 V26 M32 26 Q24 20 30 12 M32 26 Q40 22 34 14')}${stipple(mulberry32(3), 24, 0, 16, 12, 10, 0.8, INK, 0.5)}`,
  shield: () => `${P('M32 8 L50 16 Q50 38 32 56 Q14 38 14 16 Z M32 16 V46')}`,
  lantern: () => `${P('M24 12 H40 M26 16 V10 H38 V16 M22 16 H42 L44 46 H20 Z M32 22 a7 7 0 1 1 -0.1 0 M32 46 V52')}`,
  bar: () => `${P('M14 12 V52 M50 12 V52 M14 22 H50 M14 34 H50 M14 46 H50')}`,
  'broken-seal': () => `${P('M16 26 Q32 12 48 26 L44 46 Q32 54 20 46 Z M28 24 L38 40 M24 44 L40 30')}`,
  'ruled-line': () => `${P('M10 22 H54 M10 32 H48 M10 42 H54 M10 52 H44')}<path d="M10 32 H48" stroke="${OXBLOOD}" stroke-width="2.4"/>`,
  pillar: () => `${P('M22 10 H42 M20 14 H44 M24 18 V46 M32 18 V46 M40 18 V46 M20 48 H44 M22 54 H42')}`,
  grid: () => `${P('M12 12 H52 V52 H12 Z M12 25 H52 M12 39 H52 M25 12 V52 M39 12 V52')}`,
  'steady-hand': () => `${P('M20 52 Q20 30 32 26 Q44 22 44 34 Q44 42 36 42 M26 52 H46 M32 26 V12')}<circle cx="32" cy="10" r="2.6" fill="${OXBLOOD}"/>`,
  wave: () => `${P('M8 40 Q20 28 32 40 T56 40 M14 50 Q26 40 38 50 T58 48')}<path d="M32 26 L36 34 H28 Z" fill="${OXBLOOD}"/>`,
  'finger-lips': () => `${P('M18 40 Q32 30 46 40 Q32 48 18 40 Z M36 44 Q40 20 46 14')}`,
  'broken-chain': () => `${P('M12 24 a8 8 0 1 1 0 16 M52 24 a8 8 0 1 0 0 16 M22 28 L30 32 L26 36 M42 28 L34 32 L38 36')}`,
  'smeared-page': () => `${P('M14 10 H50 V54 H14 Z M20 22 H44 M20 32 H40 M20 42 H46')}<ellipse cx="36" cy="36" rx="12" ry="6" fill="${INK}" opacity="0.55"/>`,
  'sun-axe': () => `<circle cx="32" cy="30" r="10" stroke="${INK}" stroke-width="2" fill="none"/>${P('M32 14 V8 M32 52 V46 M16 30 H10 M54 30 H48 M20 18 L16 14 M44 18 L48 14 M20 42 L16 46 M44 42 L48 46')}${P('M40 34 L52 52 L46 54 L36 40', OXBLOOD, 3)}`,
  'open-book': () => `${P('M10 16 Q22 10 32 18 Q42 10 54 16 V46 Q42 40 32 48 Q22 40 10 46 Z M32 18 V48')}`,
  'rope-and-blade': () => `${P('M14 12 Q32 20 26 38 Q22 50 40 52 M40 8 L34 30 M30 34 Q28 30 34 26 Q44 22 42 34 Q40 44 32 42')}`,
  compass: () => `<circle cx="32" cy="32" r="18" stroke="${INK}" stroke-width="2" fill="none"/>${P('M32 18 L38 32 L32 46 L26 32 Z M32 18 V10')}<path d="M38 32 L46 36" stroke="${OXBLOOD}" stroke-width="2.4"/>`,
  'nine-seals': () => Array.from({ length: 9 }, (_, i) => { const a = (i / 9) * Math.PI * 2 - Math.PI / 2; return `<circle cx="${(32 + Math.cos(a) * 16).toFixed(1)}" cy="${(32 + Math.sin(a) * 16).toFixed(1)}" r="5.4" fill="none" stroke="${INK}" stroke-width="1.8"/>`; }).join('') + `<circle cx="32" cy="32" r="5" fill="${OXBLOOD}"/>`,
  candle: () => `${P('M26 26 H38 V54 H26 Z M32 22 V16')}<path d="M32 8 Q38 14 32 20 Q27 15 32 8 Z" fill="${OXBLOOD}" stroke="${INK}" stroke-width="1.4"/>`,
  'candle-ring': () => Array.from({ length: 7 }, (_, i) => { const a = (i / 7) * Math.PI * 2 - Math.PI / 2; return `<g transform="translate(${(32 + Math.cos(a) * 17).toFixed(1)} ${(32 + Math.sin(a) * 17).toFixed(1)})"><rect x="-3" y="0" width="6" height="9" fill="none" stroke="${INK}" stroke-width="1.6"/><path d="M0 -6 Q4 -2 0 1 Q-3 -2 0 -6 Z" fill="${OXBLOOD}"/></g>`; }).join(''),
  scales: () => `${P('M32 10 V48 M18 18 H46 M18 18 L12 34 M18 18 L24 34 M12 34 Q18 42 24 34 M46 18 L40 34 M46 18 L52 34 M40 34 Q46 42 52 34 M22 52 H42')}`,
};
export const sigil = (rnd, { sigil: s }) => svgWrap('sg' + S(s), 128, 128, `
  ${defs('sg' + S(s), rnd)}
  <circle cx="64" cy="64" r="56" fill="none" stroke="${INK}" stroke-width="2.4"/>
  <circle cx="64" cy="64" r="51" fill="none" stroke="${INK}" stroke-width="1" opacity="0.55"/>
  ${stipple(rnd, 10, 10, 108, 108, 40, 0.7, INK, 0.35)}
  <g transform="translate(32 32) scale(2)">${(G[s] || G.eye)(rnd)}</g>
  ${grainOverlay('sg' + S(s), 128, 128, rnd, 60)}`, PARCH_L);
export const statusIcon = (rnd, { status }) => svgWrap('st' + S(status), 128, 128, `
  <circle cx="64" cy="64" r="54" fill="${PARCH_L}" stroke="${INK}" stroke-width="3"/>
  <circle cx="64" cy="64" r="54" fill="none" stroke="${OXBLOOD}" stroke-width="2" stroke-dasharray="4 6"/>
  <g transform="translate(32 32) scale(2)">${(G[status] || G.eye)(rnd)}</g>`, PARCH_L);
export const achievementIcon = (rnd, { motif }) => svgWrap('ac' + S(motif), 128, 128, `
  ${defs('ac' + S(motif), rnd)}
  <path d="M64 6 L76 22 L98 18 L96 40 L114 52 L98 66 L102 88 L80 88 L68 106 L56 88 L34 90 L38 68 L22 54 L38 40 L34 18 L56 22 Z" fill="${PARCH_L}" stroke="${INK}" stroke-width="2.2"/>
  <g transform="translate(32 32) scale(2)">${(G[motif] || G.eye)(rnd)}</g>
  ${grainOverlay('ac' + S(motif), 128, 128, rnd, 60)}`, PARCH_L);

// ---------------------------------------------------------------- ui kit
export const numTile = (rnd, { state = 'normal' } = {}) => {
  const fills = { normal: PARCH_L, pressed: '#B49B6F', disabled: '#A7946F', complete: '#BFB089' };
  return svgWrap('nt', 128, 128, `
    ${defs('nt' + state, rnd)}
    <rect x="3" y="3" width="122" height="122" rx="7" fill="${fills[state]}" stroke="${INK}" stroke-width="${state === 'pressed' ? 3.4 : 2.4}"/>
    <rect x="9" y="9" width="110" height="110" rx="4" fill="none" stroke="${INK}" stroke-width="0.8" opacity="0.5"/>
    ${state === 'complete' ? `<path d="${wobLine(14, 64, 114, 64, rnd, 1.4)}" stroke="${OXBLOOD}" stroke-width="3" opacity="0.75"/>` : ''}
    ${state !== 'disabled' ? hatch(rnd, 3, 3, 122, 10, 3, 0, INK, 0.7, 0.3) : ''}
    ${grainOverlay('nt' + state, 128, 128, rnd, 40)}`, 'rgba(0,0,0,0)');
};
export const abilityTile = (rnd) => svgWrap('at', 128, 128, `
  <rect x="3" y="3" width="122" height="122" rx="9" fill="${CHARCOAL}" stroke="${BRASS_D}" stroke-width="2.6"/>
  <rect x="8" y="8" width="112" height="112" rx="6" fill="none" stroke="${BRASS}" stroke-width="1" opacity="0.6"/>
  ${stipple(rnd, 8, 8, 112, 112, 50, 0.7, '#000', 0.4)}`, 'rgba(0,0,0,0)');
export const button = (rnd, { kind = 'primary', state = 'normal' } = {}) => {
  const dark = kind === 'primary';
  const bg = { primary: CHARCOAL, secondary: PARCH_L }[kind];
  const bgP = { primary: '#101013', secondary: '#C0AA7E' }[kind];
  const bgD = { primary: '#2A2A2E', secondary: '#8F7F60' }[kind];
  const fill = state === 'pressed' ? bgP : state === 'disabled' ? bgD : bg;
  const stroke = state === 'disabled' ? '#55534E' : dark ? BRASS : INK;
  return svgWrap('btn', 320, 88, `
    ${defs('btn' + kind + state, rnd)}
    <rect x="3" y="3" width="314" height="82" rx="6" fill="${fill}" stroke="${stroke}" stroke-width="2.6"/>
    <rect x="9" y="9" width="302" height="70" rx="4" fill="none" stroke="${stroke}" stroke-width="0.9" opacity="0.55"/>
    ${state === 'pressed' ? `<rect x="3" y="3" width="314" height="82" rx="6" fill="#000" opacity="0.18"/>` : ''}
    ${state === 'normal' && dark ? `<path d="${wobLine(20, 76, 300, 76, rnd, 0.8)}" stroke="${BRASS_D}" stroke-width="1.2" opacity="0.7"/>` : ''}
    ${grainOverlay('btn' + kind + state, 320, 88, rnd, 60)}`, 'rgba(0,0,0,0)');
};
const nineSliceRect = (rnd, id, w, h, fill, stroke, sw = 3) => `
  <rect x="2" y="2" width="${w - 4}" height="${h - 4}" rx="8" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>
  <rect x="12" y="12" width="${w - 24}" height="${h - 24}" rx="4" fill="none" stroke="${stroke}" stroke-width="1" opacity="0.5"/>
  ${stipple(rnd, 2, 2, w, 26, 30, 0.7, '#000', 0.25)}`;
export const panelParchment = (rnd) => svgWrap('pp', 480, 320, `${defs('pp', rnd)}${nineSliceRect(rnd, 'pp', 480, 320, PARCH_L, INK)}`, 'rgba(0,0,0,0)');
export const frameBrass = (rnd) => svgWrap('fb', 480, 320, `${defs('fb', rnd)}${nineSliceRect(rnd, 'fb', 480, 320, '#201D18', BRASS, 4)}<rect x="8" y="8" width="464" height="304" rx="6" fill="none" stroke="${BRASS}" stroke-width="1.4" opacity="0.8"/>`, 'rgba(0,0,0,0)');
export const divider = (rnd, { variant = 0 } = {}) => {
  const mid = { 0: `M158 12 H162 M64 40 60`, 1: '', 2: '', 3: '', 4: '' }[variant] || '';
  const orn = [
    `${P('M20 12 H130 M190 12 H300')}<path d="M148 12 l10 -7 l10 7 l-10 7 Z" fill="${INK}"/>`,
    `${P('M20 12 H300')}<circle cx="160" cy="12" r="6" fill="none" stroke="${INK}" stroke-width="2"/><circle cx="160" cy="12" r="2" fill="${OXBLOOD}"/>`,
    `${P('M20 12 H300')}<path d="M150 12 Q160 4 170 12 Q160 20 150 12 Z" fill="${INK}"/>`,
    `${P('M20 12 H140 M180 12 H300')}<path d="M160 4 V20 M154 12 H166" stroke="${INK}" stroke-width="2.4"/>`,
    `${P('M20 12 H300')}<path d="M154 12 L160 6 L166 12 L160 18 Z M144 12 H152 M168 12 H176" stroke="${INK}" stroke-width="1.8"/>`,
  ][variant % 5];
  return svgWrap('dv', 320, 24, `${orn}${mid}`, 'rgba(0,0,0,0)');
};
export const uiCorner = (rnd, { variant = 0 } = {}) => svgWrap('uc', 96, 96, `
  ${[
    P('M8 88 V24 Q8 8 24 8 H88', INK, 2.6) + P('M16 88 V28 Q16 16 28 16 H88', INK, 1) + `<circle cx="24" cy="24" r="3" fill="${OXBLOOD}"/>`,
    P('M8 88 Q8 30 40 16 Q60 8 88 8', INK, 2.4) + `<path d="M30 30 q10 8 22 6" stroke="${INK}" stroke-width="1.4" fill="none"/>`,
    P('M8 88 V28 L28 8 H88', INK, 2.4) + P('M8 44 L44 8', INK, 1.2),
    P('M8 88 V24 Q8 8 24 8 H88', INK, 2.4) + `<path d="M20 20 q14 -6 24 4 q-12 10 -24 -4" fill="${INK}"/>`,
  ][variant % 4]}`, 'rgba(0,0,0,0)');
export const medallion = (rnd) => svgWrap('md', 128, 128, `
  ${defs('md', rnd)}<circle cx="64" cy="64" r="58" fill="${CHARCOAL}" stroke="${BRASS}" stroke-width="3"/>
  <circle cx="64" cy="64" r="50" fill="none" stroke="${BRASS_D}" stroke-width="1.4"/>
  ${Array.from({ length: 9 }, (_, i) => { const a = (i / 9) * Math.PI * 2; return `<circle cx="${(64 + Math.cos(a) * 42).toFixed(1)}" cy="${(64 + Math.sin(a) * 42).toFixed(1)}" r="2" fill="${BRASS}"/>`; }).join('')}
  ${grainOverlay('md', 128, 128, rnd, 50)}`, 'rgba(0,0,0,0)');
export const tabRibbon = (rnd) => svgWrap('tr', 512, 112, `
  ${defs('trb', rnd)}<path d="${wobRect(2, 2, 508, 108, rnd, 1)}" fill="${CHARCOAL}" stroke="${BRASS_D}" stroke-width="2.6"/>
  <path d="${wobLine(2, 22, 510, 22, rnd, 0.8)}" stroke="${BRASS}" stroke-width="1" opacity="0.5"/>
  ${Array.from({ length: 3 }, (_, i) => `<path d="${wobLine(171 + i * 85, 10, 171 + i * 85, 102, rnd, 0.7)}" stroke="${BRASS_D}" stroke-width="1" opacity="0.4"/>`).join('')}
  ${grainOverlay('trb', 512, 112, rnd, 90)}`, 'rgba(0,0,0,0)');
export const toggle = (rnd) => svgWrap('tg', 128, 72, `
  <rect x="4" y="4" width="120" height="64" rx="32" fill="${CHARCOAL}" stroke="${INK}" stroke-width="2.4"/>
  <rect x="10" y="10" width="60" height="52" rx="26" fill="${PARCH_L}" stroke="${INK}" stroke-width="2"/>
  <rect x="66" y="10" width="52" height="52" rx="26" fill="${OXBLOOD}" stroke="${INK}" stroke-width="2" opacity="0.85"/>
  <path d="${wobLine(74, 36, 110, 36, rnd, 0.8)}" stroke="${PARCH_L}" stroke-width="3"/>`, 'rgba(0,0,0,0)');
export const slider = (rnd) => svgWrap('sl', 320, 72, `
  <path d="${wobLine(10, 36, 310, 36, rnd, 0.6)}" stroke="${INK}" stroke-width="3"/>
  <path d="${wobLine(10, 36, 190, 36, rnd, 0.6)}" stroke="${OXBLOOD}" stroke-width="5"/>
  <circle cx="190" cy="36" r="16" fill="${PARCH_L}" stroke="${INK}" stroke-width="2.6"/>
  <circle cx="190" cy="36" r="5" fill="${INK}"/>`, 'rgba(0,0,0,0)');
export const modalSheet = (rnd) => svgWrap('ms', 480, 640, `
  ${defs('ms', rnd)}<rect x="2" y="2" width="476" height="636" rx="10" fill="${PARCH_L}" stroke="${INK}" stroke-width="3"/>
  <rect x="14" y="14" width="452" height="612" rx="6" fill="none" stroke="${INK}" stroke-width="1" opacity="0.5"/>
  ${stipple(rnd, 0, 0, 480, 40, 60, 0.7, '#000', 0.3)}
  ${grainOverlay('ms', 480, 640, rnd, 200)}`, 'rgba(0,0,0,0)');
export const toast = (rnd) => svgWrap('to', 480, 96, `
  ${defs('to', rnd)}<rect x="2" y="2" width="476" height="92" rx="8" fill="${CHARCOAL}" stroke="${BRASS}" stroke-width="2.4"/>
  <path d="${wobLine(2, 12, 478, 12, rnd, 0.6)}" stroke="${BRASS}" stroke-width="0.9" opacity="0.5"/>
  ${grainOverlay('to', 480, 96, rnd, 50)}`, 'rgba(0,0,0,0)');
export const divisionPip = (rnd) => svgWrap('dp', 64, 64, `
  <circle cx="16" cy="32" r="11" fill="${BRASS}" stroke="${INK}" stroke-width="2"/>
  <circle cx="48" cy="32" r="11" fill="none" stroke="${INK}" stroke-width="2" opacity="0.6"/>`, 'rgba(0,0,0,0)');

// ---------------------------------------------------------------- ranks
const rankGlyphs = [
  (r) => `${P('M32 12 Q24 30 16 44 L14 50 Q24 42 32 38 Q40 30 40 14 Z M14 50 L20 44')}`,
  () => `${P('M32 12 Q24 30 16 44 L14 50 Q24 42 32 38 Q40 30 40 14 Z')}<path d="M10 54 H54" stroke="${INK}" stroke-width="2"/>`,
  () => `${P('M32 10 Q22 26 16 42 L14 48 Q24 40 32 36 Q40 30 40 12 Z')}<path d="M8 44 Q20 36 32 36 Q44 36 56 44" stroke="${INK}" stroke-width="2" fill="none"/>`,
  () => `${G.scales()}${P('M32 50 V56')}`,
  () => `<circle cx="32" cy="32" r="16" fill="none" stroke="${INK}" stroke-width="2.4"/>${stampGlyphs.fleur.replace(/M64 40/, 'M32 22').replace(/V88|H88|M52 78 Q58 84 64 82 M76 78 Q70 84 64 82/g, '').replace(/L64 88/g, 'L32 44')}`,
  () => `<circle cx="32" cy="36" r="14" fill="none" stroke="${INK}" stroke-width="2.4"/>${P('M18 24 L20 12 L27 20 L32 8 L37 20 L44 12 L46 24', INK, 2)}`,
  () => `${P('M32 6 L38 24 L34 44 H30 L26 24 Z M26 44 H38 M32 44 V54')}${G.scales().replace(/M18 18 H46/, 'M20 16 H44')}`,
  () => `${P('M14 28 L20 10 L27 22 L32 6 L37 22 L44 10 L50 28 Z', INK, 2.4)}<circle cx="32" cy="42" r="12" fill="none" stroke="${INK}" stroke-width="2.4"/><path d="${stampGlyphs.fleur.replace(/M64 40 C56 52 52 58 56 66 C60 74 68 74 72 66 C76 58 72 52 64 40 Z M64 66 L64 88 M52 78 Q58 84 64 82 M76 78 Q70 84 64 82 M40 88 H88/, 'M32 34 C28 40 26 43 28 47 C30 51 34 51 36 47 C38 43 36 40 32 34 Z M32 47 L32 52 M28 50 Q30 52 32 51 M36 50 Q34 52 32 51 M26 53 H38')}"/>`,
];
export const rankEmblem = (rnd, { rank = 0 } = {}) => svgWrap('rk' + rank, 192, 192, `
  ${defs('rk' + rank, rnd)}
  <circle cx="96" cy="96" r="86" fill="${CHARCOAL}" stroke="${BRASS}" stroke-width="3.4"/>
  <circle cx="96" cy="96" r="76" fill="none" stroke="${BRASS_D}" stroke-width="1.6"/>
  ${Array.from({ length: rank + 1 }, (_, i) => { const a = (i / Math.max(rank + 1, 1)) * Math.PI * 2 - Math.PI / 2; return `<circle cx="${(96 + Math.cos(a) * 66).toFixed(1)}" cy="${(96 + Math.sin(a) * 66).toFixed(1)}" r="2.6" fill="${BRASS}"/>`; }).join('')}
  <g transform="translate(56 56) scale(2.5)">${rankGlyphs[rank % 8](rnd)}</g>
  ${grainOverlay('rk' + rank, 192, 192, rnd, 80)}`, 'rgba(0,0,0,0)');

// ---------------------------------------------------------------- currencies, chest, candle, brand
export const inkDrop = (rnd) => svgWrap('id', 128, 128, `
  <path d="M64 14 Q92 52 92 76 a28 30 0 1 1 -56 0 Q36 52 64 14 Z" fill="${INK}" stroke="#000" stroke-width="2"/>
  <path d="M52 78 a14 16 0 0 0 10 16" stroke="${PARCH_L}" stroke-width="3" fill="none" opacity="0.7"/>
  ${stipple(rnd, 40, 60, 50, 50, 20, 0.8, '#000', 0.4)}`, 'rgba(0,0,0,0)');
export const sigilCoin = (rnd) => svgWrap('sc', 128, 128, `
  <circle cx="64" cy="66" r="46" fill="${BRASS}" stroke="${INK}" stroke-width="3"/>
  <circle cx="64" cy="64" r="46" fill="${BRASS}" stroke="${INK}" stroke-width="3"/>
  <circle cx="64" cy="64" r="34" fill="none" stroke="${INK}" stroke-width="1.6"/>
  <path d="M64 44 L74 60 L64 84 L54 60 Z" fill="${OXBLOOD}" stroke="${INK}" stroke-width="1.6"/>
  ${stipple(rnd, 20, 20, 90, 90, 40, 0.7, '#4E3F1E', 0.5)}`, 'rgba(0,0,0,0)');
export const chest = (rnd, { state = 0 } = {}) => {
  const openT = Math.min(state / 7, 1); // 0 closed .. 1 open
  const lidRot = -openT * 95;
  const glow = state >= 3;
  return svgWrap('ch' + state, 256, 256, `
    ${defs('chest' + state, rnd)}
    <ellipse cx="128" cy="216" rx="86" ry="14" fill="${INK}" opacity="0.25"/>
    <rect x="44" y="140" width="168" height="76" rx="8" fill="#4A3626" stroke="${INK}" stroke-width="3"/>
    ${hatch(rnd, 48, 144, 160, 68, 8, 30, '#241A12', 1.2, 0.4)}
    <rect x="116" y="140" width="24" height="76" fill="${BRASS}" stroke="${INK}" stroke-width="2"/>
    <circle cx="128" cy="172" r="7" fill="${INK}"/>
    <g transform="rotate(${lidRot} 44 140)">
      <path d="M44 140 V96 Q44 62 78 62 H178 Q212 62 212 96 V140 Z" fill="#5A4430" stroke="${INK}" stroke-width="3"/>
      <path d="M52 136 V98 Q52 70 80 70 H176 Q204 70 204 98 V136" fill="none" stroke="#241A12" stroke-width="1.6"/>
      <rect x="116" y="96" width="24" height="44" fill="${BRASS}" stroke="${INK}" stroke-width="2"/>
    </g>
    ${glow ? `<path d="M92 138 Q128 96 164 138 Z" fill="#D8C089" opacity="${0.25 + openT * 0.5}"/>
      ${stipple(rnd, 92, 100, 72, 40, 30, 1, '#D8C089', 0.8)}` : ''}
    ${state >= 1 && state < 7 ? `<path d="M120 ${70 - state * 4} l8 14 l-6 10" stroke="${OXBLOOD}" stroke-width="${2 + state * 0.4}" fill="none"/>` : ''}
    ${state === 7 ? `<path d="M96 120 L128 84 L160 120" stroke="${BRASS}" stroke-width="3" fill="none"/>
      <circle cx="128" cy="112" r="10" fill="${OXBLOOD}" stroke="${INK}" stroke-width="2"/>` : ''}
    ${grainOverlay('chest' + state, 256, 256, rnd, 90)}`, PARCH_L);
};
export const candle = (rnd, { state = 'lit' } = {}) => svgWrap('cd' + state, 128, 128, `
  ${defs('cd' + state, rnd)}
  <rect x="52" y="56" width="24" height="54" rx="3" fill="${PARCH_L}" stroke="${INK}" stroke-width="2.4"/>
  ${hatch(rnd, 54, 58, 20, 50, 5, 88, '#000', 0.5, 0.3)}
  <rect x="44" y="108" width="40" height="8" rx="2" fill="${BRASS_D}" stroke="${INK}" stroke-width="2"/>
  ${state === 'unlit' ? `<path d="M64 48 v-8" stroke="${INK}" stroke-width="2.4"/>` : `
    <path d="M64 22 Q${state === 'gutter' ? 76 : 72} 34 64 46 Q${state === 'gutter' ? 54 : 56} 34 64 22 Z" fill="${OXBLOOD}" stroke="${INK}" stroke-width="1.6"/>
    <path d="M64 32 Q68 38 64 44 Q60 38 64 32 Z" fill="${PARCH_L}"/>
    ${state === 'gutter' ? stipple(rnd, 52, 20, 24, 26, 26, 0.9, INK, 0.5) : ''}`}
  ${grainOverlay('cd' + state, 128, 128, rnd, 40)}`, 'rgba(0,0,0,0)');
export const wordmark = (rnd) => svgWrap('wm', 640, 200, `
  ${defs('wm', rnd)}
  <g font-family="Georgia, 'Times New Roman', serif" font-size="104" fill="${INK}" text-anchor="middle" letter-spacing="14">
    <text x="320" y="118">ASSIZE</text>
  </g>
  <path d="${wobLine(40, 168, 600, 168, rnd, 1)}" stroke="${INK}" stroke-width="2.6"/>
  <circle cx="320" cy="168" r="7" fill="${OXBLOOD}" stroke="${INK}" stroke-width="2"/>
  ${grainOverlay('wm', 640, 200, rnd, 80)}`, 'rgba(0,0,0,0)');
export const faviconSvg = () => `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
<rect width="64" height="64" rx="12" fill="${PAPER}"/>
<circle cx="32" cy="32" r="22" fill="${OXBLOOD}" stroke="#CDB992" stroke-width="2.5"/>
<path d="M32 18 C28 24 26 27 28 31 C30 35 34 35 36 31 C38 27 36 24 32 18 Z M32 31 V44 M26 39 Q29 42 32 41 M38 39 Q35 42 32 41" stroke="#CDB992" stroke-width="2.6" fill="none" stroke-linecap="round"/>
</svg>`;

export const FACTORIES = {
  texParchment, texCharcoal, texBrass, texLeather,
  gridLine, boxLine, cornerOrnament, gutterStrip,
  waxSeal, claimStamp, brushStrike, chainOverlay, smudgeBlot, hushSeal, miasmaHatch, quarantineStripe,
  statusIcon, sigil, achievementIcon, numTile, abilityTile, button, panelParchment, frameBrass,
  divider, uiCorner, medallion, tabRibbon, toggle, slider, modalSheet, toast, divisionPip,
  rankEmblem, inkDrop, sigilCoin, chest, candle, wordmark, faviconSvg,
};
