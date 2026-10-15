// ASSIZE story canon test (STORY_HOLD_PLAN.md Phase 1, P1.1).
//
// MOBILE-ONLY SCOPE: asserts shared/i18n (the canon) matches
// mobile/src/i18n (the Metro build artifact) exactly. The web tree is not
// asserted here — web parity is deferred, not broken.
//
// Editing one file and running the app on stale copy fails HERE, not on a
// player's phone: run `node tools/sync-story.mjs` to re-sync, commit both.
import { describe, it, expect } from 'vitest';
import sharedStory from '../i18n/story.json';
import mobileStory from '../../mobile/src/i18n/story.json';
import sharedEn from '../i18n/en.json';
import mobileEn from '../../mobile/src/i18n/en.json';

const GROUPS = [
  'prologue',
  'tutorial',
  'folios',
  'mag',
  'interlude1',
  'interlude2',
  'orsoloReveal',
  'endings',
] as const;

function firstDiffPath(a: unknown, b: unknown, prefix = ''): string | null {
  if (a === b) return null;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) {
    return prefix || '(root)';
  }
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) {
    const p = prefix ? `${prefix}.${k}` : k;
    if (!(k in (a as Record<string, unknown>))) return `${p} (missing in shared)`;
    if (!(k in (b as Record<string, unknown>))) return `${p} (missing in mobile)`;
    const d = firstDiffPath(
      (a as Record<string, unknown>)[k],
      (b as Record<string, unknown>)[k],
      p,
    );
    if (d) return d;
  }
  return null;
}

describe('story canon (P1.1)', () => {
  it('shared/i18n/story.json matches mobile/src/i18n/story.json byte-for-byte in content', () => {
    const diff = firstDiffPath(sharedStory, mobileStory);
    expect(diff, diff ? `canon drift at ${diff} — run \`node tools/sync-story.mjs\`` : 'canon drift').toBeNull();
  });

  it('shared/i18n/en.json matches mobile/src/i18n/en.json in content', () => {
    const diff = firstDiffPath(sharedEn, mobileEn);
    expect(diff, diff ? `dictionary drift at ${diff} — run \`node tools/sync-story.mjs\`` : 'dictionary drift').toBeNull();
  });

  it('every top-level story group is non-empty', () => {
    for (const g of GROUPS) {
      const v = (sharedStory as Record<string, unknown>)[g];
      const size = Array.isArray(v) ? v.length : v && typeof v === 'object' ? Object.keys(v).length : 0;
      expect(size, `story group ${g} is empty`).toBeGreaterThan(0);
    }
  });

  it('canon shape matches docs/STORY.md: prologue[4], tutorial[3], 9 folios, 9 mags', () => {
    const s = sharedStory as {
      prologue: unknown[];
      tutorial: unknown[];
      folios: Record<string, unknown>;
      mag: Record<string, unknown>;
      orsoloRevealReply: unknown;
    };
    expect(s.prologue).toHaveLength(4);
    expect(s.tutorial).toHaveLength(3);
    expect(Object.keys(s.folios)).toHaveLength(9);
    expect(Object.keys(s.mag)).toHaveLength(9);
    // P3.4 — the Clerk's one reply line at the reveal (owner-approved canon).
    expect(s.orsoloRevealReply).toEqual([
      'Then hear my plea, Magistrate: the folios are mine, and the pen is in my hand.',
    ]);
  });
});
