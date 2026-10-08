#!/usr/bin/env node
// ASSIZE — tools/rasterize-game-art.mjs
//
// RASTER TWINS for the native build (Phase 6 ship-gate follow-up).
//
// The web build renders the engraved SVG kit in the browser, where feTurbulence,
// feDisplacementMap, feComposite and feColorMatrix are implemented. React Native's
// react-native-svg implements NONE of them: at runtime <SvgUri> had to fetch and
// parse every SVG on every mount, emit a console warning per unsupported primitive,
// and drop the art's grain entirely. On the new architecture that parse storm is
// also the measured source of the 0 fps stalls when iterating screens.
//
// The fix is a build step: each `mobile/assets/game/**/*.svg` is rasterised HERE,
// offline, by sharp/librsvg — which implements the full filter spec — into a raster
// twin beside its source. Native screens render the twin through RN <Image> (the
// src/ui/Art.tsx seam). The .svg sources stay in-tree as the vector source of truth
// (and the web build keeps serving them from ../public/assets).
//
// Twin format, chosen per file:
//   - .png  (palette + dithering) — marks, chrome, stamps: small, alpha-critical
//   - .webp (q82, alpha)          — full-bleed noise (textures, fog overlays) where
//                                    lossless PNG of fractal grain would cost megabytes
//
// Scale: 2x the SVG's intrinsic size, clamped to [96, 1024] — ≥2x the largest DPR
// any call site renders at, without upscaling the 1024 texture ground.
//
// Usage:  node tools/rasterize-game-art.mjs [--force]
// Output: one twin per SVG + a manifest at mobile/assets/game/raster-manifest.json

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const sharp = require('sharp');

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', 'mobile', 'assets', 'game');
const MANIFEST = join(ROOT, 'raster-manifest.json');

const FORCE = process.argv.includes('--force');
const MIN = 96;
const MAX = 1024;
// q95, alpha 100: the grain IS the art direction (matte ink on parchment). q80 kept
// the variance but softened the fine grain; q95 measured ~92 KB per texture — 9
// textures ≈ 830 KB, well inside the bundle budget for a faithful ground.
const WEBP_QUALITY = 95;
const WEBP_ALPHA = 100;

// Full-bleed noise goes to WebP: the entropy of fractal grain makes lossless PNG
// of a 1024 sheet cost ~1 MB each — the whole textures dir would outgrow the
// bundle. Everything else rides palette PNG.
const WEBP_DIRS = new Set(['textures']);

function walk(dir, out = []) {
  for (const f of readdirSync(dir).sort()) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith('.svg')) out.push(p);
  }
  return out;
}

function intrinsic(svg) {
  const w = svg.match(/<svg[^>]*\swidth="(\d+(?:\.\d+)?)/);
  const h = svg.match(/<svg[^>]*\sheight="(\d+(?:\.\d+)?)/);
  if (w && h) return { w: parseFloat(w[1]), h: parseFloat(h[1]) };
  const vb = svg.match(/viewBox="\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([-\d.]+)[\s,]+([-\d.]+)/);
  if (vb) return { w: parseFloat(vb[1]), h: parseFloat(vb[2]) };
  return null;
}

const files = walk(ROOT);
const manifest = {};
let totalBytes = 0;
let skipped = 0;

for (const svgPath of files) {
  const rel = relative(ROOT, svgPath);
  const svg = readFileSync(svgPath, 'utf8');
  const dims = intrinsic(svg);
  if (!dims) {
    console.error(`SKIP (no intrinsic size): ${rel}`);
    continue;
  }
  const scale = Math.min(MAX / Math.max(dims.w, dims.h), 2);
  const width = Math.max(MIN, Math.round(dims.w * scale));
  const height = Math.max(MIN, Math.round(dims.h * scale));
  const useWebp = WEBP_DIRS.has(rel.split('/')[0]);
  const twinPath = svgPath.replace(/\.svg$/, useWebp ? '.webp' : '.png');

  if (!FORCE && existsSync(twinPath)) {
    skipped++;
  } else {
    const pipe = sharp(svgPath, { density: 72 * (scale > 1 ? scale : 1) }).resize(width, height, { fit: 'fill' });
    if (useWebp) await pipe.webp({ quality: WEBP_QUALITY, alphaQuality: WEBP_ALPHA }).toFile(twinPath);
    else await pipe.png({ palette: true, compressionLevel: 9, dither: 1.0 }).toFile(twinPath);
  }

  const bytes = statSync(twinPath).size;
  totalBytes += bytes;
  manifest[rel] = {
    twin: relative(ROOT, twinPath),
    width,
    height,
    bytes,
  };
  console.log(`${rel} → ${relative(ROOT, twinPath)} @ ${width}x${height} (${(bytes / 1024).toFixed(1)} KB)`);
}

writeFileSync(MANIFEST, JSON.stringify({ generatedBy: 'tools/rasterize-game-art.mjs', files: manifest }, null, 2) + '\n');
console.log(`\n${files.length} SVGs → twins, skipped(existing) ${skipped}, total ${(totalBytes / 1024 / 1024).toFixed(2)} MB`);
