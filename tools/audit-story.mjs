// ASSIZE story — the dead-copy detector (STORY_HOLD_PLAN.md Phase 1, P1.2).
//
// MOBILE-ONLY SCOPE: walks mobile/src/**/*.ts/tsx. The web tree is not scanned
// here — web parity is deferred, not broken.
//
//   node tools/audit-story.mjs            -> report; exit 0 unless NEW dead copy exists
//   node tools/audit-story.mjs --strict   -> ignore the allowlist (prove the tripwire)
//
// How it works: each canon leaf has a regex describing its live wiring. A leaf
// with no match is dead. Leaves in ALLOWLIST are known Phase-2 debt (they print
// as ALLOWLISTED, not as failures); anything else dead fails the run. After
// Phase 2 the allowlist must be empty — every story key ships somewhere, or CI
// says so (P4.1).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'mobile', 'src');
const STRICT = process.argv.includes('--strict');

// Known dead copy, each owned by a Phase-2 item. Remove the entry when the item
// lands — the audit then guards the new wiring forever.
// P2.1 landed the full prologue and P2.2–P2.4 wired every in-moment surface:
// the allowlist is EMPTY. Every story key ships somewhere on mobile, or this
// script fails the run (P4.1).
const ALLOWLIST = new Map([]);

// id, human label, live-wiring pattern (matched against mobile/src file texts).
const CHECKS = [
  { id: 'prologue.0', label: 'prologue[0] (plague, sealed city)', re: /prologue\s*\[\s*0\s*\]/ },
  { id: 'prologue.1', label: 'prologue[1] (Orsolo execution)', re: /prologue\s*\[\s*1\s*\]/ },
  { id: 'prologue.2', label: 'prologue[2] (the Reckoning)', re: /prologue\s*\[\s*2\s*\]/ },
  { id: 'prologue.3', label: 'prologue[3] (ink-echo at door)', re: /prologue\s*\[\s*3\s*\]/ },
  { id: 'tutorial', label: 'tutorial[0..2] (Shade lesson)', re: /storyJson\.tutorial|story\.tutorial/ },
  { id: 'folios.*', label: 'folios.*.title/sub (9 folios)', re: /storyJson\.folios|story\.folios|folioCopy/ },
  { id: 'mag.*.challenge', label: 'mag.*.challenge (pre-duel)', re: /\.challenge\b/ },
  { id: 'mag.*.defeat@result', label: 'mag.*.defeat (in-moment @ ResultScreen)', re: /ResultScreen\.tsx/, fileRe: /magText\.defeat|storyJson\.mag|story\.mag/ },
  { id: 'mag.*.folio@result', label: 'mag.*.folio card (in-moment @ ResultScreen)', re: /ResultScreen\.tsx/, fileRe: /magText\.folio|storyJson\.mag[^_]*folio|mag\.\w+\.folio/ },
  { id: 'mag.*.taunt@duel', label: 'mag.*.taunt (in-moment @ Ticker/Duel)', re: /(Ticker|DuelScreen)\.tsx/, fileRe: /taunt/ },
  { id: 'interlude1', label: 'interlude1 (after Folio III)', re: /interlude1/ },
  { id: 'interlude2', label: 'interlude2 (after Folio VI)', re: /interlude2/ },
  { id: 'orsoloReveal', label: 'orsoloReveal (after Folio IX)', re: /orsoloReveal/ },
  { id: 'orsoloRevealReply', label: "orsoloRevealReply (the Clerk's answer)", re: /orsoloRevealReply/ },
  { id: 'endings.balance', label: 'endings.balance', re: /endings\.balance/ },
  { id: 'endings.burn', label: 'endings.burn', re: /endings\.burn/ },
];

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(p);
  }
  return out;
}

const files = walk(SRC);
const texts = new Map(files.map((f) => [f, fs.readFileSync(f, 'utf8')]));

// A check with fileRe only passes when a file matching `re` (the surface file)
// also matches `fileRe` (the wiring inside it). Otherwise `re` is matched
// against every file and the referencing files are listed.
const rows = CHECKS.map((c) => {
  let refs = [];
  if (c.fileRe) {
    const surfaces = [...texts.entries()].filter(([f]) => c.re.test(path.basename(f)));
    refs = surfaces.filter(([, t]) => c.fileRe.test(t)).map(([f]) => path.relative(ROOT, f));
  } else {
    refs = [...texts.entries()].filter(([, t]) => c.re.test(t)).map(([f]) => path.relative(ROOT, f));
  }
  return { ...c, refs, live: refs.length > 0 };
});

const dead = rows.filter((r) => !r.live);
const allowlisted = dead.filter((r) => !STRICT && ALLOWLIST.has(r.id));
const failing = dead.filter((r) => !allowlisted.includes(r));

console.log(`mobile/src files scanned: ${files.length}\n`);
console.log('key'.padEnd(34) + 'status'.padEnd(14) + 'referencing files');
for (const r of rows) {
  const status = r.live ? 'LIVE' : allowlisted.includes(r) ? 'ALLOWLISTED' : 'DEAD';
  const where = r.live ? r.refs.slice(0, 3).join(', ') + (r.refs.length > 3 ? ` (+${r.refs.length - 3})` : '') : (ALLOWLIST.get(r.id) ?? '');
  console.log(`${r.id.padEnd(34)}${status.padEnd(14)}${where}`);
}

if (allowlisted.length) {
  console.log(`\nallowlisted dead copy (${allowlisted.length}) — known Phase-2 debt, not failures:`);
  for (const r of allowlisted) console.log(`  ~ ${r.id}: ${ALLOWLIST.get(r.id)}`);
}
if (failing.length) {
  console.error(`\nDEAD COPY (${failing.length}) — wire it or allowlist it with a Phase-2 owner:`);
  for (const r of failing) console.error(`  ✗ ${r.id} (${r.label})`);
  process.exit(1);
}
console.log('\nAUDIT PASS — every non-allowlisted story key ships somewhere on mobile.');
if (!STRICT && dead.length === 0 && ALLOWLIST.size > 0) {
  console.log('NOTE — allowlist is stale: all keys live, remove the entries.');
}
