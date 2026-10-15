// ASSIZE story canon — the single-source sync (STORY_HOLD_PLAN.md Phase 1, P1.1).
//
// MOBILE-ONLY SCOPE: this script syncs shared/i18n/*.json (the canon) into
// mobile/src/i18n/*.json (the Metro build artifact). The web's src/i18n/*.json
// is deliberately untouched here — web parity is deferred, not broken.
//
//   node tools/sync-story.mjs            -> copy shared -> mobile, log what changed
//   node tools/sync-story.mjs --check    -> CI mode: no writes, exit non-zero on drift
//
// Drift reporting names the first differing key path so the fix is obvious:
// edit the SHARED file, re-run without --check, commit both.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHARED = path.join(ROOT, 'shared', 'i18n');
const MOBILE = path.join(ROOT, 'mobile', 'src', 'i18n');
const FILES = ['story.json', 'en.json'];
const CHECK = process.argv.includes('--check');

function firstDiffPath(a, b, prefix = '') {
  if (a === b) return null;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) {
    return prefix || '(root)';
  }
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) {
    const p = prefix ? `${prefix}.${k}` : k;
    if (!(k in a)) return `${p} (missing in shared)`;
    if (!(k in b)) return `${p} (missing in mobile)`;
    const d = firstDiffPath(a[k], b[k], p);
    if (d) return d;
  }
  return null;
}

let drifted = false;
for (const f of FILES) {
  const from = path.join(SHARED, f);
  const to = path.join(MOBILE, f);
  if (!fs.existsSync(from)) {
    console.error(`✗ canon missing: ${path.relative(ROOT, from)}`);
    process.exitCode = 1;
    continue;
  }
  const sharedText = fs.readFileSync(from, 'utf8');
  const mobileText = fs.existsSync(to) ? fs.readFileSync(to, 'utf8') : null;
  if (sharedText === mobileText) {
    console.log(`ok  ${f} — in sync (${sharedText.length} bytes)`);
    continue;
  }
  // Same bytes? No — find whether it is formatting or a real content drift.
  let diff = '(unparseable JSON — fix the shared file)';
  try {
    diff = firstDiffPath(JSON.parse(sharedText), mobileText ? JSON.parse(mobileText) : null) ?? '(identical content, whitespace only)';
  } catch { /* keep the fallback message */ }
  if (CHECK) {
    console.error(`✗ DRIFT ${f}: first difference at ${diff}`);
    console.error(`  fix: edit shared/i18n/${f}, run \`node tools/sync-story.mjs\`, commit both.`);
    drifted = true;
  } else {
    fs.writeFileSync(to, sharedText);
    console.log(`synced ${f} -> mobile (first diff was at ${diff})`);
  }
}

if (CHECK && drifted) {
  console.error('\nSYNC CHECK FAIL — shared/i18n and mobile/src/i18n disagree.');
  process.exit(1);
}
if (CHECK) console.log('\nSYNC CHECK PASS — shared canon matches the mobile artifact.');
