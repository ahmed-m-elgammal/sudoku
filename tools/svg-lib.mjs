// Engraving primitives for ASSIZE procedural assets (pipeline C, spec §9).
// Everything is seeded so output is deterministic: same manifest -> same bytes.
import path from 'node:path';

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const hashSeed = (s) => {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
};

export const INK = '#1A1410';
export const CHARCOAL = '#17171A';
export const PARCH = '#B8A27C';
export const PARCH_L = '#CDB992';
export const PARCH_D = '#9A8560';
export const BRASS = '#A58849';
export const BRASS_D = '#6F5B31';
export const OXBLOOD = '#7B1A1F';
export const PAPER = '#0E0E0F';

// hand-wobble a polyline path (returns path d)
export function wobble(pts, rnd, amp = 1.2, closed = false) {
  const j = ([x, y]) => [x + (rnd() - 0.5) * 2 * amp, y + (rnd() - 0.5) * 2 * amp];
  const p = pts.map(j);
  if (closed) p.push(p[0]);
  return p.map((q, i) => `${i === 0 ? 'M' : 'L'}${q[0].toFixed(1)} ${q[1].toFixed(1)}`).join(' ') + (closed ? ' Z' : '');
}
// straight line with slight wobble
export const wobLine = (x1, y1, x2, y2, rnd, amp = 1.1) =>
  wobble([[x1, y1], [(x1 + x2) / 2, (y1 + y2) / 2], [x2, y2]], rnd, amp);
export const wobRect = (x, y, w, h, rnd, amp = 1.1) =>
  wobble([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], rnd, amp, true);

// repeated hatch strokes inside a clip region
export function hatch(rnd, x, y, w, h, gap = 4, angle = 45, stroke = INK, sw = 1, amp = 0.7) {
  const c = Math.cos((angle * Math.PI) / 180), s = Math.sin((angle * Math.PI) / 180);
  const diag = Math.abs(w * s) + Math.abs(h * c);
  const n = Math.floor(diag / gap);
  let out = '';
  for (let i = 0; i <= n; i++) {
    const ox = -h * s + i * gap * c, oy = -w * c * -1;
    const cx = x + w / 2, cy = y + h / 2;
    const px = cx + ox - diag * c, py = cy + (i * gap * s - diag * s);
    out += `<path d="${wobLine(px, py, px + diag * c, py + diag * s, rnd, amp)}" stroke="${stroke}" stroke-width="${sw}" fill="none" stroke-linecap="round"/>`;
  }
  return out;
}
// stipple dots
export function stipple(rnd, x, y, w, h, n, r = 0.9, fill = INK, op = 0.8) {
  let out = '';
  for (let i = 0; i < n; i++) {
    out += `<circle cx="${(x + rnd() * w).toFixed(1)}" cy="${(y + rnd() * h).toFixed(1)}" r="${(r * (0.5 + rnd())).toFixed(2)}" fill="${fill}" opacity="${(op * (0.4 + rnd() * 0.6)).toFixed(2)}"/>`;
  }
  return out;
}

// shared <defs>: paper grain + hatch patterns (id-suffixed to avoid collisions)
export function defs(seedId, rnd, { grain = 0.09, size = 256 } = {}) {
  return `<defs>
  <filter id="grain-${seedId}" x="0" y="0" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="${hashSeed(seedId) % 1000}" result="n"/>
    <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.1 0 0 0 0 0.08 0 0 0 0 0.06 0 0 0 ${grain} 0"/>
    <feComposite operator="over" in2="SourceGraphic"/>
  </filter>
  <filter id="wobble-${seedId}" x="-5%" y="-5%" width="110%" height="110%">
    <feTurbulence type="turbulence" baseFrequency="0.05" numOctaves="2" seed="${(hashSeed(seedId) % 900) + 7}" result="t"/>
    <feDisplacementMap in="SourceGraphic" in2="t" scale="2.4"/>
  </filter>
  <pattern id="hatch-${seedId}" width="6" height="6" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
    <rect width="6" height="6" fill="none"/><line x1="0" y1="0" x2="0" y2="6" stroke="${INK}" stroke-width="1"/>
  </pattern>
  <pattern id="cross-${seedId}" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
    <line x1="0" y1="0" x2="0" y2="7" stroke="${INK}" stroke-width="0.9"/><line x1="0" y1="0" x2="7" y2="0" stroke="${INK}" stroke-width="0.9"/>
  </pattern>
  <radialGradient id="vig-${seedId}" cx="50%" cy="46%" r="72%">
    <stop offset="62%" stop-color="#000000" stop-opacity="0"/>
    <stop offset="100%" stop-color="#000000" stop-opacity="0.26"/>
  </radialGradient>
</defs>`;
}
export const grainOverlay = (id, w, h, rnd, n = 260) =>
  `<g opacity="0.5">${stipple(rnd, 0, 0, w, h, n, 0.7, INK, 0.28)}</g><rect width="${w}" height="${h}" fill="url(#vig-${id})"/>`;

export function svgWrap(id, w, h, body, bg = PARCH_L) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
<rect width="${w}" height="${h}" fill="${bg}"/>
${body}
</svg>`;
}

// simple path helper for figures built from commands
export const P = (d, stroke = INK, sw = 2.2, fill = 'none', extra = '') =>
  `<path d="${d}" stroke="${stroke}" stroke-width="${sw}" fill="${fill}" stroke-linecap="round" stroke-linejoin="round" ${extra}/>`;

export function writeSvg(fs, root, dir, file, content) {
  const dirPath = path.join(root, 'public/assets', dir);
  fs.mkdirSync(dirPath, { recursive: true });
  const fp = path.join(dirPath, file);
  fs.writeFileSync(fp, content);
  return fp;
}
