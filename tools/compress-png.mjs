// ASSIZE T9 — repeatable PNG compression pass (TODO T9).
//   bun tools/compress-png.mjs             -> compress every in-scope PNG not yet recorded
//   bun tools/compress-png.mjs --force     -> re-compress everything, records rebuilt
//   node tools/compress-png.mjs            -> same (sharp is a plain node dep)
// Law: sharp().png({ quality: 80, palette: true }) over public/assets/{brand,portraits,plates,map};
// overwrite ONLY when the re-encode is actually smaller; every decision is recorded in
// assets/manifest.json under a top-level `pngCompression` map so re-runs are idempotent and
// regenerated art (size no longer matches the record) is picked up automatically.
// Manifest entries whose primary `path` is a compressed file also get their `bytes` updated.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const PNG_DIRS = ['brand', 'portraits', 'plates', 'map'];

// pure law: does this file need (re-)compression? A missing/garbage record means yes;
// a record whose `bytes` matches the on-disk size means the file is already compressed.
export function needsCompress(sizeOnDisk, record) {
  if (!record || typeof record !== 'object') return true;
  const b = record.bytes;
  return typeof b !== 'number' || !Number.isFinite(b) || b !== sizeOnDisk;
}

// pure law: build the record for a compression attempt. Refuses (null) when the
// re-encode did not actually shrink the file — the pass never grows a PNG.
export function recordCompression(sizeBefore, sizeAfter, now) {
  if (!Number.isFinite(sizeBefore) || !Number.isFinite(sizeAfter)) return null;
  if (sizeAfter >= sizeBefore) return null;
  return { orig: Math.round(sizeBefore), bytes: Math.round(sizeAfter), at: new Date(now).toISOString() };
}

// pure law: which manifest asset entries (if any) point at this file, by path.
export function manifestPathsFor(manifest, assetsRelFile) {
  const want = '/assets/' + assetsRelFile.split(path.sep).join('/');
  return (Array.isArray(manifest.assets) ? manifest.assets : []).filter((a) => a && a.path === want);
}

export async function compressPngs({ root, manifestPath, dirs = PNG_DIRS, force = false, log = () => {} }) {
  const { default: sharp } = await import('sharp');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const map = force ? {} : (manifest.pngCompression ?? {});
  const nextMap = { ...map };
  const results = { compressed: [], skipped: [], refused: [], manifestUpdated: [] };
  const assetsRoot = path.join(root, 'public', 'assets');

  for (const dir of dirs) {
    const absDir = path.join(assetsRoot, dir);
    if (!fs.existsSync(absDir)) continue;
    const files = fs.readdirSync(absDir).filter((f) => f.toLowerCase().endsWith('.png')).sort();
    for (const f of files) {
      const abs = path.join(absDir, f);
      const rel = path.join(dir, f);
      const size = fs.statSync(abs).size;
      if (!force && !needsCompress(size, map[rel])) { results.skipped.push(rel); continue; }
      const before = fs.readFileSync(abs);
      const buf = await sharp(before).png({ quality: 80, palette: true }).toBuffer();
      const rec = recordCompression(before.length, buf.length, Date.now());
      if (rec) {
        fs.writeFileSync(abs, buf);
        nextMap[rel] = rec;
        results.compressed.push({ file: rel, orig: rec.orig, bytes: rec.bytes });
        log(`  ${rel}: ${rec.orig} -> ${rec.bytes} bytes`);
      } else {
        // refused (not smaller): record a stable no-op so future runs skip the re-encode,
        // but never claim a saving that did not happen.
        nextMap[rel] = { orig: before.length, bytes: before.length, at: new Date().toISOString() };
        results.refused.push(rel);
        log(`  ${rel}: kept (${before.length} bytes, re-encode not smaller)`);
      }
      // manifest primary-path entries: keep their advertised bytes true
      for (const entry of manifestPathsFor(manifest, rel)) {
        if (typeof entry.bytes === 'number' && entry.bytes !== nextMap[rel].bytes) {
          entry.bytes = nextMap[rel].bytes;
          results.manifestUpdated.push(entry.id);
        }
      }
    }
  }

  // write only when something actually changed — a no-op run leaves the manifest byte-identical
  const dirty = results.compressed.length > 0 || results.manifestUpdated.length > 0
    || JSON.stringify(nextMap) !== JSON.stringify(manifest.pngCompression ?? {});
  if (dirty) {
    manifest.pngCompression = nextMap;
    manifest.generated = new Date().toISOString();
    const saved = results.compressed.reduce((a, c) => a + (c.orig - c.bytes), 0);
    manifest.note = `T9 png compression: ${results.compressed.length} compressed, ${saved} bytes saved`;
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  }
  const saved = results.compressed.reduce((a, c) => a + (c.orig - c.bytes), 0);
  return { ...results, savedBytes: saved };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const manifestPath = path.join(root, 'assets', 'manifest.json');
  const force = process.argv.includes('--force');
  compressPngs({ root, manifestPath, force, log: (m) => console.log(m) }).then((r) => {
    console.log(`T9 done: ${r.compressed.length} compressed, ${r.skipped.length} already recorded, ${r.refused.length} kept, ${r.savedBytes} bytes saved`);
  }).catch((e) => { console.error('T9 failed:', e); process.exit(1); });
}
