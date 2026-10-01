// T18 — the Endless Assize. ADVERSARIAL SUITE. The ladder must be a *place*,
// not a slot machine: the same (rung, salt) always derives the same foe, hostile
// rungs/salts/states degrade to lawful duels, every derived profile sits inside
// the hard envelope, and the curves are monotonic — a higher rung must never be
// a gentler duel.
import { describe, it, expect } from 'vitest';
import {
  endlessFoe, endlessOnWin, endlessOnLoss, sanitizeEndless, newEndlessState,
  endlessInkBonus, tierForRung, isBossRung, cycleLabel, ENDLESS_MAX_RUNG,
} from '../endless';
import { clampProfile, PROFILE_ENVELOPE } from '../shade';
import { BOSS_SCRIPTS } from '../phaseScript';
import { FOLIOS } from '../orders';

const sweep = (n: number) => Array.from({ length: n }, (_, i) => i);

describe('EN · rung derivation is deterministic and lawful', () => {
  it('EN1 rung 0 is the foot of the stair: Halbrecht, Easy, 7 Seals, no script', () => {
    const f = endlessFoe(0, 'salt1');
    expect(f.rung).toBe(0);
    expect(f.name).toBe('Shade of Halbrecht');
    expect(f.tier).toBe('Easy');
    expect(f.seals).toEqual([7, 7]);
    expect(f.bossRung).toBe(false);
    expect(f.script).toBeUndefined();
    expect(f.profile.techniques).toBe(0);
    expect(f.order).toBe(FOLIOS[0].duels[2].order);
    expect(f.seed).toBe('endless-salt1-0');
  });

  it('EN2 every third rung is a Magistrate duel: 8 Seals + the magistrate\u2019s arc', () => {
    for (const r of [2, 5, 8, 11, 14]) {
      const f = endlessFoe(r, 'salt1');
      expect(f.bossRung, `rung ${r}`).toBe(true);
      expect(f.seals[1]).toBe(8);
      expect(f.script, `rung ${r} carries an arc`).toBeDefined();
      expect(BOSS_SCRIPTS[FOLIOS[r % 9].duels[2].script!]).toBe(f.script);
    }
    for (const r of [0, 1, 3, 4, 6, 7]) {
      expect(endlessFoe(r, 'salt1').bossRung).toBe(false);
    }
  });

  it('EN3 the Nine ride again: tier ladder and cycle numerals', () => {
    expect(tierForRung(0)).toBe('Easy');
    expect(tierForRung(3)).toBe('Medium');
    expect(tierForRung(6)).toBe('Hard');
    expect(tierForRung(9)).toBe('Expert');
    expect(tierForRung(99)).toBe('Expert');
    // cycle 0 rides unnumbered; the second circuit is II
    expect(endlessFoe(0, 's').name).toBe('Shade of Halbrecht');
    expect(endlessFoe(9, 's').name).toBe('Shade of Halbrecht II');
    expect(endlessFoe(18, 's').name).toBe('Shade of Halbrecht III');
    // every magistrate hosts their own rung
    for (const m of sweep(9)) {
      expect(endlessFoe(m, 's').order).toBe(FOLIOS[m].duels[2].order);
    }
    expect(cycleLabel(0)).toBe('');
    expect(cycleLabel(1)).toBe('II');
    expect(cycleLabel(9)).toBe('X');
    expect(cycleLabel(10)).toBe('11'); // past the table, decimal — still lawful
  });

  it('EN4 byte-identical derivation for the same (rung, salt); salt changes the seed', () => {
    const a = endlessFoe(7, 'kettle');
    const b = endlessFoe(7, 'kettle');
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(endlessFoe(7, 'kettle2').seed).not.toBe(a.seed);
    // the profile itself is unchanged by a different salt — only the tablet differs
    expect(JSON.stringify(endlessFoe(7, 'kettle2').profile)).toBe(JSON.stringify(a.profile));
  });

  it('EN5 hostile rungs degrade to the foot of the stair without hanging', () => {
    for (const bad of [NaN, -5, -Infinity, 1.9, '7', null, undefined, {}]) {
      const f = endlessFoe(bad as unknown as number, 's');
      expect(Number.isFinite(f.rung)).toBe(true);
      expect(f.rung).toBeGreaterThanOrEqual(0);
      expect(f.seed).toContain('endless-');
    }
    expect(endlessFoe(1.9, 's').rung).toBe(1);
    // non-finite rungs are GARBAGE — fail-closed to the foot of the stair, never
    // a corruption-fueled teleport to rung 1,000,000
    const top = endlessFoe(Infinity, 's');
    expect(top.rung).toBe(0);
    expect(top.profile.techniques).toBe(0);
    const big = endlessFoe(1e9, 's');
    expect(big.rung).toBe(ENDLESS_MAX_RUNG);
    expect(big.profile.techniques).toBe(3);
    // hostile salts still yield a lawful seed
    for (const salt of ['', '   ', null, undefined, 42, 'x'.repeat(500)]) {
      const f = endlessFoe(0, salt as unknown as string);
      expect(f.seed).toMatch(/^endless-[a-z0-9]+-0$/);
    }
  });

  it('EN6 property sweep r 0..40: curves monotonic, profiles envelope-idempotent', () => {
    let prev: ReturnType<typeof endlessFoe> | null = null;
    for (const r of sweep(41)) {
      const f = endlessFoe(r, 'sweep');
      const c = clampProfile(f.profile);
      expect(f.profile).toEqual(c); // already inside the envelope
      expect(f.profile.placeDelayMs[0]).toBeGreaterThanOrEqual(PROFILE_ENVELOPE.placeDelayMinMs);
      expect(f.profile.placeDelayMs[1]).toBeLessThanOrEqual(PROFILE_ENVELOPE.placeDelayMaxMs);
      expect(f.profile.mistakeRate).toBeLessThanOrEqual(PROFILE_ENVELOPE.mistakeRateMax);
      expect(f.profile.singlesSkill).toBeLessThanOrEqual(PROFILE_ENVELOPE.singlesSkillMax);
      if (prev) {
        expect(f.profile.placeDelayMs[0], `pace lo at r=${r}`).toBeLessThanOrEqual(prev.profile.placeDelayMs[0]);
        expect(f.profile.placeDelayMs[1], `pace hi at r=${r}`).toBeLessThanOrEqual(prev.profile.placeDelayMs[1]);
        expect(f.profile.mistakeRate, `mistakes at r=${r}`).toBeLessThanOrEqual(prev.profile.mistakeRate);
        expect(f.profile.singlesSkill, `skill at r=${r}`).toBeGreaterThanOrEqual(prev.profile.singlesSkill);
        expect(f.profile.aggression, `aggression at r=${r}`).toBeGreaterThanOrEqual(prev.profile.aggression);
        expect(f.profile.techniques!, `techniques at r=${r}`).toBeGreaterThanOrEqual(prev.profile.techniques!);
      }
      prev = f;
    }
    // the climb caps honestly
    expect(endlessFoe(40, 's').profile.techniques).toBe(3);
    expect(endlessFoe(0, 's').profile.techniques).toBe(0);
  });

  it('EN7 names stay under the profile cap; seals follow the boss law', () => {
    for (const r of sweep(41)) {
      const f = endlessFoe(r, 'names');
      expect(f.name.length, `name at r=${r}`).toBeLessThanOrEqual(24); // clampProfile's name cap
      expect(f.seals[1], `seals at r=${r}`).toBe(isBossRung(r) ? 8 : 7);
      expect(f.seals[0]).toBe(7);
    }
  });
});

describe('EN · ladder law: wins ascend, losses reset, best is forever', () => {
  it('EN8 a clean win chain tracks current and best', () => {
    let s = newEndlessState('salt');
    for (const expected of [1, 2, 3, 4, 5]) {
      s = endlessOnWin(s);
      expect(s.current).toBe(expected);
      expect(s.best).toBe(expected);
    }
  });

  it('EN9 a loss returns the Clerk to the foot; best stays written', () => {
    let s = newEndlessState('salt');
    for (let i = 0; i < 4; i++) s = endlessOnWin(s);
    expect(s.best).toBe(4);
    s = endlessOnLoss(s);
    expect(s.current).toBe(0);
    expect(s.best).toBe(4);
    // climb again — best only ever rises
    s = endlessOnWin(s);
    expect(s.current).toBe(1);
    expect(s.best).toBe(4);
  });

  it('EN10 hostile ladder states are sanitized, never trusted', () => {
    for (const bad of [
      null, undefined, 'x', 42, [],
      { current: NaN, best: NaN, salt: 7 },
      { current: -3, best: -1e9, salt: '' },
      { current: Infinity, best: -Infinity, salt: 'ok' },
      { current: 5.9, best: 2.1, salt: 'ok' },
      { current: 1e12, best: 0, salt: 'ok' },
    ]) {
      const s = sanitizeEndless(bad);
      expect(Number.isFinite(s.current)).toBe(true);
      expect(Number.isFinite(s.best)).toBe(true);
      expect(s.current).toBeGreaterThanOrEqual(0);
      expect(s.best).toBeGreaterThanOrEqual(0);
      expect(typeof s.salt).toBe('string');
      expect(s.salt.length).toBeGreaterThan(0);
      expect(s.salt.length).toBeLessThanOrEqual(32);
    }
    expect(sanitizeEndless({ current: 5.9, best: 2.1, salt: 'ok' }).current).toBe(5);
    // non-finite is garbage → the foot of the stair, not the summit
    expect(sanitizeEndless({ current: Infinity, best: 3, salt: 'ok' }).current).toBe(0);
    expect(sanitizeEndless({ current: 2, best: 0, salt: '' }).salt).toBe('novem');
    // progression through hostile states still obeys the law
    expect(endlessOnWin({ current: NaN, best: NaN, salt: 7 }).current).toBe(1);
    expect(endlessOnLoss(null).best).toBe(0);
  });

  it('EN11 the salt never changes through wins or losses', () => {
    const s0 = newEndlessState('my-salt');
    expect(endlessOnWin(s0).salt).toBe('my-salt');
    expect(endlessOnLoss(s0).salt).toBe('my-salt');
    expect(endlessOnWin(endlessOnLoss({ current: 9, best: 9, salt: 'k' })).salt).toBe('k');
  });

  it('EN12 rung Ink bonus climbs, caps, and survives hostile input', () => {
    expect(endlessInkBonus(0)).toBe(5);
    expect(endlessInkBonus(1)).toBe(7);
    expect(endlessInkBonus(100)).toBe(205);
    expect(endlessInkBonus(1e9)).toBe(205); // capped
    for (const bad of [NaN, -3, 'x', null, Infinity, 2.9]) {
      expect(Number.isFinite(endlessInkBonus(bad as unknown as number))).toBe(true);
      expect(endlessInkBonus(bad as unknown as number)).toBeGreaterThanOrEqual(5);
    }
    expect(endlessInkBonus(2.9)).toBe(9); // floored rung 2
  });
});
