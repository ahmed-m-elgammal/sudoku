// P2.5 — the Lexicon's exhaustiveness law (docs/STORY_HOLD_PLAN.md P2.5).
//
//   LEX-1  every AbilityId in shared/config.ts has a glossary entry, and the
//          entry's value names the rite's true cooldown from CONFIG.
//   LEX-2  every StatusType has a glossary entry, and the value names the true
//          duration from CONFIG.
//   LEX-3  terms are unique (one entry owns each word).
//
// Adding a rite or status without a glossary line fails CI — the config is the
// compile-driven tripwire that keeps the glossary honest forever.
import { describe, it, expect } from 'vitest';
import { CONFIG, type AbilityId, type StatusType } from '../config';
import { LEXICON } from '../lexicon';

const ABILITIES: AbilityId[] = [
  'augur', 'unseal', 'fairCopy',
  'sever', 'hush', 'reckoning',
  'smudge', 'tincture', 'miasma',
  'ward', 'mirror', 'quarantine',
];
const STATUSES: StatusType[] = ['chain', 'smudge', 'hush', 'miasma', 'quarantine'];

describe('lexicon exhaustiveness (P2.5)', () => {
  it('LEX-1 every rite is documented with its true cooldown', () => {
    for (const id of ABILITIES) {
      const entry = LEXICON.find((e) => e.ability === id);
      expect(entry, `no lexicon entry covers rite ${id}`).toBeDefined();
      const cdS = `${CONFIG.abilityCdMs[id] / 1000} s`;
      expect(entry!.value ?? '', `${id} value must name cooldown ${cdS}`).toContain(cdS);
      expect(entry!.plain.length, `${id} plain must be one sentence`).toBeGreaterThan(0);
    }
  });

  it('LEX-2 every status is documented with its true duration', () => {
    for (const id of STATUSES) {
      const entry = LEXICON.find((e) => e.status === id);
      expect(entry, `no lexicon entry covers status ${id}`).toBeDefined();
      const durS = `${CONFIG.statusDurationsMs[id] / 1000} s`;
      expect(entry!.value ?? '', `${id} value must name duration ${durS}`).toContain(durS);
    }
  });

  it('LEX-3 terms are unique', () => {
    const terms = LEXICON.map((e) => e.term);
    expect(new Set(terms).size).toBe(terms.length);
  });
});
