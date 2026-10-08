// artSeam.test.ts — the raster-art pipeline law.
//
// The engraved kit's SVG sources carry feTurbulence/feDisplacementMap filters that
// react-native-svg does not implement on native, and its runtime fetch+parse of every
// asset per mount was the measured source of the "unsupported SVG filter" warnings and
// the 0 fps stalls when iterating screens (the Phase 6 ship-gate follow-up). The
// pipeline since then: tools/rasterize-game-art.mjs bakes raster twins beside every
// SVG, the registries require the twins, and src/ui/Art.tsx paints them through a
// native <Image>.
//
// This suite pins the three invariants that keep that pipeline honest:
//   1. no screen/registry requires an .svg (the twins are the bundled assets)
//   2. no src file imports SvgUri/SvgXml — react-native-svg is procedural geometry
//      only (cooldown rings, the Ledger spark, the duel's seat circles)
//   3. every SVG under assets/game has a manifest entry whose twin exists on disk
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const MOBILE = join(__dirname, '..', '..', '..');
const SRC = join(MOBILE, 'src');
const GAME = join(MOBILE, 'assets', 'game');
const MANIFEST = join(GAME, 'raster-manifest.json');

function walk(dir: string, exts: string[], out: string[] = []): string[] {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, exts, out);
    else if (exts.some((e) => p.endsWith(e))) out.push(p);
  }
  return out;
}

function stripComments(code: string): string {
  // enough for the law check: drop line + block comments so prose like
  // "why not <SvgUri>" doesn't read as usage
  return code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

describe('artSeam — the raster-twin pipeline law', () => {
  it('LAW-1 no src module bundles an .svg — screens render the raster twins', () => {
    const offenders = walk(SRC, ['.ts', '.tsx'])
      .filter((f) => !f.includes('__tests__'))
      .filter((f) => /require\('[^']*\.svg'\)/.test(readFileSync(f, 'utf8')));
    expect(
      offenders.map((f) => f.replace(`${SRC}/`, '')),
    ).toEqual([]);
  });

  it('LAW-2 SvgUri/SvgXml are gone — react-native-svg is procedural geometry only', () => {
    const offenders = walk(SRC, ['.ts', '.tsx'])
      .filter((f) => !f.includes('__tests__'))
      // imports or rendered tags; prose mentions in comments are documentation
      .filter((f) => /import[^;]*\b(SvgUri|SvgXml)\b|<(SvgUri|SvgXml)\b/.test(stripComments(readFileSync(f, 'utf8'))));
    expect(offenders.map((f) => f.replace(`${SRC}/`, ''))).toEqual([]);
  });

  it('LAW-3 every game SVG has a manifest entry whose twin exists with content', () => {
    const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8')) as {
      files: Record<string, { twin: string; width: number; height: number; bytes: number }>;
    };
    const svgs = walk(GAME, ['.svg']);
    for (const svg of svgs) {
      const key = svg.replace(`${GAME}/`, '');
      const entry = manifest.files[key];
      expect(entry, `manifest entry for ${key}`).toBeTruthy();
      const twinPath = join(GAME, entry!.twin);
      expect(existsSync(twinPath), `twin file for ${key}`).toBe(true);
      expect(statSync(twinPath).size, `twin bytes for ${key}`).toBeGreaterThan(0);
      expect(entry!.width).toBeGreaterThanOrEqual(96);
      expect(entry!.height).toBeGreaterThanOrEqual(96);
    }
  });
});
