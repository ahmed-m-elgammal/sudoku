// ASSIZE mobile — the asset-place audit (specs/17 Phase 6 ship gate).
//
//   node tools/audit-mobile-assets.mjs
//     -> exits non-zero if any asset the mobile source requires/imports is missing
//     -> prints the unreferenced asset inventory (informational: the PNG twins the
//        web build keeps are shipped for parity and may be legitimately unreferenced)
//
// "Every asset loading in the right place" is a SHIP GATE, not a vibe: Metro only
// bundles what a literal require()/import names, so the audit walks every literal
// asset reference under mobile/src (plus app.json's icon/splash entries) and checks
// the file exists on disk. A renamed asset fails HERE, at review time — not on a
// phone, silently, mid-duel.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MOBILE = path.join(ROOT, 'mobile');
const SRC = path.join(MOBILE, 'src');

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

// ---- 1. every literal asset reference in the mobile source
const sourceFiles = walk(SRC).filter((f) => /\.(ts|tsx)$/.test(f));
const refPattern = /(?:require\(|from\s+|import\s+[\w$]+\s+from\s+)['"](\.[^'"]+\.(png|webp|svg|wav|jpg|jpeg|gif|ttf|otf))['"]/g;

const referenced = new Map(); // resolved path -> [where]
const unresolved = [];
for (const file of sourceFiles) {
  const text = fs.readFileSync(file, 'utf8');
  for (const m of text.matchAll(refPattern)) {
    const rel = m[1];
    const resolved = path.resolve(path.dirname(file), rel);
    const where = `${path.relative(MOBILE, file)} -> ${rel}`;
    if (fs.existsSync(resolved)) {
      if (!referenced.has(resolved)) referenced.set(resolved, []);
      referenced.get(resolved).push(where);
    } else {
      unresolved.push(where);
    }
  }
}

// ---- 2. app.json's own asset entries (icon, splash, adaptive layers, favicon)
const appJson = JSON.parse(fs.readFileSync(path.join(MOBILE, 'app.json'), 'utf8'));
const appRefs = [];
const expo = appJson.expo ?? {};
const pushRef = (label, p) => {
  if (!p) return;
  const resolved = path.resolve(MOBILE, p.replace(/^\.\//, ''));
  appRefs.push({ label, resolved, ok: fs.existsSync(resolved) });
};
pushRef('icon', expo.icon);
pushRef('splash image', expo.plugins?.find((pl) => Array.isArray(pl) && pl[0] === 'expo-splash-screen')?.[1]?.image);
pushRef('android adaptive foreground', expo.android?.adaptiveIcon?.foregroundImage);
pushRef('android adaptive background', expo.android?.adaptiveIcon?.backgroundImage);
pushRef('android adaptive monochrome', expo.android?.adaptiveIcon?.monochromeImage);
pushRef('web favicon', expo.web?.favicon);

// ---- 3. the on-disk inventory vs what the source names
const assetsDir = path.join(MOBILE, 'assets');
const onDisk = walk(assetsDir).map((p) => path.resolve(p));
const referencedSet = new Set(referenced.keys());
const unreferenced = onDisk.filter((p) => !referencedSet.has(p));

// ---- report
let failed = false;
console.log(`mobile/src asset references: ${[...referenced.values()].flat().length} (${referenced.size} distinct files)`);
if (unresolved.length) {
  failed = true;
  console.error(`\nMISSING (${unresolved.length}) — the build would break on device:`);
  for (const u of unresolved) console.error(`  ✗ ${u}`);
}
const badAppRefs = appRefs.filter((r) => !r.ok);
if (badAppRefs.length) {
  failed = true;
  console.error('\napp.json asset entries MISSING:');
  for (const r of badAppRefs) console.error(`  ✗ ${r.label}: ${r.resolved}`);
}
console.log(`\napp.json entries: ${appRefs.filter((r) => r.ok).length}/${appRefs.length} resolve`);
console.log(`on-disk assets under mobile/assets: ${onDisk.length}`);
console.log(`referenced by the source: ${onDisk.filter((p) => referencedSet.has(p)).length}`);
console.log(`not referenced by the source: ${unreferenced.length} (PNG twins for the web build, PWA brand set — legitimate by design)`);
const byDir = {};
for (const p of unreferenced) {
  const dir = path.relative(assetsDir, path.dirname(p));
  byDir[dir] = (byDir[dir] ?? 0) + 1;
}
for (const [dir, count] of Object.entries(byDir).sort()) console.log(`    ${dir}: ${count}`);

if (failed) process.exit(1);
console.log('\nAUDIT PASS — every referenced asset resolves; every app.json entry resolves.');
