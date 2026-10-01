// T9 — PNG compression pass, tested against a synthetic fixture root (never the repo's art).
// The tool must shrink, record, update manifest primaries, stay idempotent, pick up
// regenerated art, and survive a hostile manifest record without ever growing a file.
import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { compressPngs, needsCompress, recordCompression, manifestPathsFor, PNG_DIRS } from '../tools/compress-png.mjs';

let sharp: typeof import('sharp');
const tmpRoots: string[] = [];

function rawNoise(size: number, seed: number): Buffer {
  // deterministic pseudo-noise: incompressible content, so libimagequant has real work
  const raw = Buffer.alloc(size * size * 3);
  let s = seed >>> 0;
  for (let i = 0; i < raw.length; i++) {
    s = (s * 1664525 + 1013904223) >>> 0;
    raw[i] = (s >>> 24) & 0xff;
  }
  return raw;
}

async function encodePng(raw: Buffer, size: number): Promise<Buffer> {
  // a REAL png: raw noise encoded through sharp (default compression — no palette),
  // so the fixture art is a valid, heavy file the pass can legitimately shrink
  return sharp(raw, { raw: { width: size, height: size, channels: 3 } }).png().toBuffer();
}

async function buildFixture(): Promise<{ root: string; manifestPath: string }> {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'assize-t9-'));
  tmpRoots.push(root);
  const assets = path.join(root, 'public', 'assets');
  fs.mkdirSync(path.join(assets, 'brand'), { recursive: true });
  fs.mkdirSync(path.join(assets, 'portraits'), { recursive: true });
  fs.writeFileSync(path.join(assets, 'brand', 'og-image.png'), await encodePng(rawNoise(96, 7), 96));
  fs.writeFileSync(path.join(assets, 'brand', 'app-icon-512.png'), await encodePng(rawNoise(64, 11), 64));
  fs.writeFileSync(path.join(assets, 'portraits', 'clerk.png'), await encodePng(rawNoise(48, 13), 48));
  const manifestPath = path.join(root, 'assets', 'manifest.json');
  fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
  fs.writeFileSync(manifestPath, JSON.stringify({
    generated: 'fixture', note: '',
    assets: [
      { id: 'og-image', path: '/assets/brand/og-image.png', bytes: 999999 },
      { id: 'app-icon', path: '/assets/brand/app-icon-master.png', bytes: 1 }, // file absent
      { id: 'clerk', path: '/assets/portraits/clerk.webp', bytes: 4242 },      // webp twin: untouched
    ],
  }, null, 2));
  return { root, manifestPath };
}

const read = (p: string) => fs.readFileSync(p);
const sizeOf = (p: string) => fs.statSync(p).size;

beforeAll(async () => {
  sharp = (await import('sharp')).default;
});

describe('T9 pure law', () => {
  it('needsCompress: no record / garbage record / size drift means yes; matching record means no', () => {
    expect(needsCompress(100, undefined)).toBe(true);
    expect(needsCompress(100, null)).toBe(true);
    expect(needsCompress(100, 'garbage')).toBe(true);
    expect(needsCompress(100, { bytes: 'x' })).toBe(true);
    expect(needsCompress(100, { bytes: NaN })).toBe(true);
    expect(needsCompress(100, { bytes: 100 })).toBe(false);
    expect(needsCompress(101, { bytes: 100 })).toBe(true);
  });

  it('recordCompression: refuses non-shrinking and non-finite sizes', () => {
    expect(recordCompression(100, 90, 0)).toEqual({ orig: 100, bytes: 90, at: new Date(0).toISOString() });
    expect(recordCompression(100, 100, 0)).toBeNull();
    expect(recordCompression(90, 100, 0)).toBeNull();
    expect(recordCompression(NaN, 10, 0)).toBeNull();
    expect(recordCompression(100, Infinity, 0)).toBeNull();
  });

  it('manifestPathsFor matches by exact /assets-relative path, tolerates a hostile assets array', () => {
    expect(manifestPathsFor({ assets: [{ path: '/assets/brand/og-image.png' }] }, 'brand/og-image.png')).toHaveLength(1);
    expect(manifestPathsFor({ assets: [{ path: '/assets/brand/og-image.webp' }] }, 'brand/og-image.png')).toHaveLength(0);
    expect(manifestPathsFor({}, 'brand/og-image.png')).toEqual([]);
    expect(manifestPathsFor({ assets: 'garbage' }, 'brand/og-image.png')).toEqual([]);
    expect(manifestPathsFor({ assets: [null, 3, { path: '/assets/brand/og-image.png' }] }, 'brand/og-image.png')).toHaveLength(1);
  });

  it('PNG_DIRS covers the spec scope (brand, portraits, plates) plus map', () => {
    expect(new Set(PNG_DIRS)).toEqual(new Set(['brand', 'portraits', 'plates', 'map']));
  });
});

describe('T9 tool pass on a fixture root', () => {
  it('compresses, records, updates primary manifest bytes, leaves webp twins untouched', async () => {
    const { root, manifestPath } = await buildFixture();
    const r = await compressPngs({ root, manifestPath });
    expect(r.compressed).toHaveLength(3);
    expect(r.refused).toHaveLength(0);
    const m = JSON.parse(read(manifestPath).toString());
    // primary entry bytes updated to the true new size
    expect(m.assets[0].bytes).toBe(sizeOf(path.join(root, 'public/assets/brand/og-image.png')));
    expect(r.manifestUpdated).toContain('og-image');
    // the absent app-icon-master was never touched; the webp twin entry untouched
    expect(r.manifestUpdated).not.toContain('app-icon');
    expect(m.assets[2].bytes).toBe(4242);
    // records exist with orig >= bytes and real savings
    for (const rec of Object.values(m.pngCompression) as Array<{ orig: number; bytes: number }>) {
      expect(rec.orig).toBeGreaterThanOrEqual(rec.bytes);
    }
    expect(m.pngCompression['portraits/clerk.png'].bytes).toBe(sizeOf(path.join(root, 'public/assets/portraits/clerk.png')));
    // files still decode with unchanged dimensions
    const meta = await sharp(read(path.join(root, 'public/assets/brand/og-image.png'))).metadata();
    expect(meta.width).toBe(96);
    expect(meta.height).toBe(96);
  });

  it('second run is a byte-for-byte no-op (idempotence)', async () => {
    const { root, manifestPath } = await buildFixture();
    await compressPngs({ root, manifestPath });
    const og = path.join(root, 'public/assets/brand/og-image.png');
    const snap = read(og).toString('base64');
    const manifestSnap = read(manifestPath).toString();
    const r2 = await compressPngs({ root, manifestPath });
    expect(r2.compressed).toHaveLength(0);
    expect(r2.skipped).toHaveLength(3);
    expect(read(og).toString('base64')).toBe(snap);
    expect(read(manifestPath).toString()).toBe(manifestSnap);
  });

  it('a regenerated (different-size) file is picked up again; force re-compresses everything', async () => {
    const { root, manifestPath } = await buildFixture();
    await compressPngs({ root, manifestPath });
    const og = path.join(root, 'public/assets/brand/og-image.png');
    // "regeneration": new art of a different size
    fs.writeFileSync(og, await encodePng(rawNoise(80, 99), 80));
    const regenSize = sizeOf(og);
    const r = await compressPngs({ root, manifestPath });
    expect(r.compressed.map((c: { file: string }) => c.file)).toEqual(['brand/og-image.png']);
    const rec = JSON.parse(read(manifestPath).toString()).pngCompression['brand/og-image.png'];
    expect(rec.orig).toBe(regenSize);           // the regenerated (pre-compression) size
    expect(rec.bytes).toBe(sizeOf(og));         // the compressed size now on disk
    // --force rebuilds every record and still never grows a file
    const sizesBefore = PNG_DIRS.map((d) => path.join(root, 'public/assets', d))
      .filter(fs.existsSync).flatMap((d) => fs.readdirSync(d).filter((f) => f.endsWith('.png')).map((f) => sizeOf(path.join(d, f))));
    const rf = await compressPngs({ root, manifestPath, force: true });
    expect(rf.compressed).toHaveLength(3);
    const sizesAfter = PNG_DIRS.map((d) => path.join(root, 'public/assets', d))
      .filter(fs.existsSync).flatMap((d) => fs.readdirSync(d).filter((f) => f.endsWith('.png')).map((f) => sizeOf(path.join(d, f))));
    // --force may squeeze an already-quantized file further — it may shrink, never grow
    expect(sizesAfter.every((s, i) => s <= sizesBefore[i])).toBe(true);
  });

  it('a hostile manifest record can never crash the pass', async () => {
    const { root, manifestPath } = await buildFixture();
    await compressPngs({ root, manifestPath });
    const m = JSON.parse(read(manifestPath).toString());
    m.pngCompression['brand/og-image.png'] = { bytes: { evil: true } };
    m.pngCompression['portraits/clerk.png'] = null;
    m.pngCompression['brand/app-icon-512.png'] = 42;
    m.assets = 'not-an-array';
    read; // keep lints honest
    fs.writeFileSync(manifestPath, JSON.stringify(m));
    const r = await compressPngs({ root, manifestPath });
    expect(r.compressed).toHaveLength(3);
    const m2 = JSON.parse(read(manifestPath).toString());
    for (const rec of Object.values(m2.pngCompression) as Array<{ bytes: number }>) {
      expect(typeof rec.bytes).toBe('number');
    }
  });

  it('refuses to grow a file that palette quantization cannot shrink', async () => {
    const { root, manifestPath } = await buildFixture();
    const tiny = path.join(root, 'public/assets/brand/app-icon-512.png');
    // a 1x1 flat PNG is already optimal; re-encode must not enlarge it
    const flat = await sharp({ create: { width: 1, height: 1, channels: 3, background: { r: 200, g: 30, b: 40 } } }).png().toBuffer();
    fs.writeFileSync(tiny, flat);
    const r = await compressPngs({ root, manifestPath });
    expect(sizeOf(tiny)).toBe(flat.length);
    const m = JSON.parse(read(manifestPath).toString());
    const rec = m.pngCompression['brand/app-icon-512.png'];
    if (!r.compressed.some((c: { file: string }) => c.file === 'brand/app-icon-512.png')) {
      expect(rec.bytes).toBe(flat.length);
    }
  });
});

describe('T9 repo state (after the real pass has run)', () => {
  const repoManifest = path.resolve(__dirname, '..', 'assets', 'manifest.json');
  const repoAssets = path.resolve(__dirname, '..', 'public', 'assets');

  it('every in-scope PNG is recorded, its record matches disk, and it never grew', () => {
    if (!fs.existsSync(repoManifest)) throw new Error('repo manifest missing');
    const m = JSON.parse(fs.readFileSync(repoManifest, 'utf8'));
    expect(m.pngCompression).toBeTruthy();
    let checked = 0;
    for (const dir of PNG_DIRS) {
      const absDir = path.join(repoAssets, dir);
      if (!fs.existsSync(absDir)) continue;
      for (const f of fs.readdirSync(absDir).filter((x) => x.toLowerCase().endsWith('.png'))) {
        const rel = `${dir}/${f}`;
        const rec = m.pngCompression[rel];
        expect(rec, `record for ${rel}`).toBeTruthy();
        expect(sizeOf(path.join(absDir, f))).toBe(rec.bytes);
        expect(rec.bytes).toBeLessThanOrEqual(rec.orig);
        checked++;
      }
    }
    expect(checked).toBeGreaterThanOrEqual(30);
  });

  it('brand files referenced by UI still decode with their protocol dimensions', async () => {
    sharp = (await import('sharp')).default;
    for (const [file, w, h] of [
      ['brand/og-image.png', 1200, 630],
      ['brand/app-icon-192.png', 192, 192],
      ['brand/app-icon-512.png', 512, 512],
      ['brand/app-icon-maskable.png', 512, 512],
    ] as const) {
      const meta = await sharp(fs.readFileSync(path.join(repoAssets, file))).metadata();
      expect([meta.width, meta.height], file).toEqual([w, h]);
    }
  });
});
