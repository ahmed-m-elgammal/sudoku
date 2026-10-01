// ASSIZE T18 — the Endless Assize. The campaign's Nine Folios become a circuit
// that never closes: rung r is a fully deterministic duel derived from pure
// facts (r, the save's salt), so the same save always meets the same foe on the
// same tablet — the ladder is a place, not a slot machine.
//
//   · Magistrate m = r % 9, circuit c = ⌊r/9⌋ (displayed as a Roman numeral
//     from the second circuit on) — the Nine ride again, forever;
//   · tier Easy → Expert across the first circuit, Expert after;
//   · every 3rd rung (r % 3 === 2) is a Magistrate's duel: 8 Seals and the
//     magistrate's own PhaseScript (T18 boss arcs);
//   · pace, mistakes, skill, aggression and the deduction tier tighten with r,
//     all inside the hard profile envelope;
//   · seed `endless-{salt}-{rung}` — stable per save, personal per save.
//
// Ladder law: a win ascends (current + 1, best tracks), a loss resets the
// streak to the foot of the stair while `best` stays permanent. Pure module:
// no clock, no rng — the save owns the salt.
import { FOLIOS } from './orders';
import { clampProfile, type ShadeProfile } from './shade';
import { BOSS_SCRIPTS, type BossScript } from './phaseScript';
import type { OrderId, Tier } from './config';

export interface EndlessState {
  current: number;   // 0-based rung the Clerk faces next (= consecutive wins)
  best: number;      // highest rung ever cleared (0 = none)
  salt: string;      // per-save seed salt, persisted once
}

export const newEndlessState = (salt: string): EndlessState => ({ current: 0, best: 0, salt });

export const ENDLESS_MAX_RUNG = 1_000_000;   // the stair is long, not infinite-precision

const finiteInt = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

// hostile-state sanitizer: any garbage in, a lawful ladder state out
export const sanitizeEndless = (s: unknown): EndlessState => {
  const o = (s && typeof s === 'object' ? s : {}) as Partial<Record<'current' | 'best' | 'salt', unknown>>;
  const rung = (v: unknown) =>
    Math.max(0, Math.min(ENDLESS_MAX_RUNG, finiteInt(v) ? Math.floor(v) : 0));
  let salt = typeof o.salt === 'string' ? o.salt.slice(0, 32) : '';
  if (!salt) salt = 'novem';
  return { current: rung(o.current), best: rung(o.best), salt };
};

export const endlessOnWin = (s: unknown): EndlessState => {
  const cur = sanitizeEndless(s);
  const next = Math.min(ENDLESS_MAX_RUNG, cur.current + 1);
  return { current: next, best: Math.max(cur.best, next), salt: cur.salt };
};

export const endlessOnLoss = (s: unknown): EndlessState => {
  const cur = sanitizeEndless(s);
  return { current: 0, best: cur.best, salt: cur.salt };
};

// rung-scaled Ink bonus on top of the standard win economy (clamped so a
// hostile rung cannot mint a fortune)
export const endlessInkBonus = (rung: unknown): number => {
  const r = Math.max(0, Math.min(ENDLESS_MAX_RUNG, finiteInt(rung) ? Math.floor(rung) : 0));
  return 5 + 2 * Math.min(r, 100);
};

// ---------------------------------------------------------------- derivation
const ROMAN = ['', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'] as const;

// circuit label: the first circuit rides unnumbered, then II, III, …
export const cycleLabel = (c: number): string => {
  const n = finiteInt(c) && c > 0 ? Math.floor(c) : 0;
  if (n === 0) return '';
  return n < ROMAN.length ? ROMAN[n] : String(n + 1);
};

export const tierForRung = (r: number): Tier =>
  r < 3 ? 'Easy' : r < 6 ? 'Medium' : r < 9 ? 'Hard' : 'Expert';

export const isBossRung = (r: number): boolean =>
  finiteInt(r) && r >= 0 && r % 3 === 2;

export interface EndlessFoe {
  rung: number;
  seed: string;
  name: string;
  order: OrderId;
  tier: Tier;
  seals: [number, number];
  profile: ShadeProfile;
  script?: BossScript;     // Magistrate's duels only (T18 arcs)
  bossRung: boolean;
  cycle: number;
}

// the whole foe from two pure facts. Never throws; a hostile rung or salt
// degrades to a lawful duel at the foot of the stair.
export const endlessFoe = (rung: unknown, salt: unknown): EndlessFoe => {
  const r = Math.max(0, Math.min(ENDLESS_MAX_RUNG, finiteInt(rung) ? Math.floor(rung) : 0));
  const m = r % 9;
  const c = Math.floor(r / 9);
  const boss = FOLIOS[m].duels[2];
  const surname = FOLIOS[m].duels[0].name;      // short name — the profile name cap is 24
  const label = cycleLabel(c);
  const name = label ? `Shade of ${surname} ${label}` : `Shade of ${surname}`;
  const key = typeof salt === 'string' && salt.trim() ? salt.trim().slice(0, 32) : 'novem';
  const seed = `endless-${key}-${r}`;

  const tier = tierForRung(r);
  const bossRung = isBossRung(r);

  // the ladder tightens — every curve monotonic in r, all envelope-clamped.
  // The deduction tier is PURELY the rung curve: a boss rung's extra teeth are
  // its 8 Seals and its PhaseScript arc, never a +1 that would make the rung
  // AFTER it a gentler duel (a monotonicity dip the property sweep caught).
  const paceLo = Math.max(1150, 3400 - 160 * r);
  const paceHi = Math.max(1900, 5600 - 240 * r);
  const mistakeRate = Math.max(0.03, 0.16 - 0.008 * r);
  const singlesSkill = Math.min(0.96, 0.58 + 0.026 * r);
  const aggression = Math.min(0.88, 0.5 + 0.026 * r);
  const cadLo = Math.max(7000, 14000 - 500 * r);
  const cadHi = Math.max(11000, 26000 - 900 * r);
  const tech = Math.min(3, Math.floor((r + 2) / 5));

  const profile = clampProfile({
    name,
    order: boss.order,
    placeDelayMs: [paceLo, paceHi],
    mistakeRate,
    abilityCadenceMs: [cadLo, cadHi],
    aggression,
    singlesSkill,
    techniques: tech as 0 | 1 | 2 | 3,
  });

  const scriptId = bossRung ? boss.script : undefined;
  const script = scriptId ? BOSS_SCRIPTS[scriptId] : undefined;

  return {
    rung: r,
    seed,
    name,
    order: boss.order,
    tier,
    seals: [7, bossRung ? 8 : 7],
    profile,
    script,
    bossRung,
    cycle: c,
  };
};
