// ASSIZE T21 — the Weekly Assize. The Daily's week-long sibling: every Clerk in
// every timezone faces the SAME modified duel each week, derived from pure facts
// (the week index). Where the Endless ladder varies the FOE, the Weekly Assize
// varies the RULES — two named modifiers per week rotate through a fixed pool of
// eight, implemented as a sanitized RuleMods overlay the engine reads directly
// (wrong digits burn more Seals, claims hit harder, wax thickens, shadows lengthen).
//
//   · weeks start Monday 00:00 UTC — weekIndexFor(nowMs) has no local-time traps;
//   · two DISTINCT modifiers per week, drawn by a seeded Rng on the week index;
//   · the foe is a set piece, not a curve: one fixed solid Shade profile wearing
//     one of the eight non-finale Magistrate arcs (Orsolo stays campaign-final);
//   · seed `assize-week-{w}` — the same week is the same duel, byte for byte.
//
// Pure module: no DOM, no timers, no Date.now() — the caller owns the clock.
// Never throws; a hostile week index degrades to week 0.
import { Rng } from './rng';
import { clampProfile, type ShadeProfile } from './shade';
import { BOSS_SCRIPTS, type BossScript } from './phaseScript';
import { FOLIOS } from './orders';
import type { RuleMods } from './engine';
import type { OrderId, Tier } from './config';

export interface WeeklyModDef {
  id: string;
  name: string;      // i18n-ready label (en copy shipped)
  blurb: string;     // one-line engine-true description
  mods: RuleMods;    // the RuleMods overlay ({} where the effect rides duel-shape, e.g. start Seals)
}

// the eight named modifiers. Fragile Seals is duel-shape, not st.rules: both
// duelists open at 6 Seals via the seals field, so its overlay is empty.
export const WEEK_MODS: WeeklyModDef[] = [
  { id: 'oxblood-ink',   name: 'Oxblood Ink',   blurb: 'A wrong digit burns two Seals, not one.',            mods: { wrongSealCost: 2 } },
  { id: 'iron-claims',   name: 'Iron Claims',   blurb: 'Every claim deals two Seals.',                       mods: { claimDamage: 2 } },
  { id: 'gilded-claims', name: 'Gilded Claims', blurb: 'A clean claim deals three Seals.',                   mods: { cleanBonus: 2 } },
  { id: 'thick-wax',     name: 'Thick Wax',     blurb: 'Statuses linger a quarter longer.',                  mods: { statusScale: 1.25 } },
  { id: 'long-shadows',  name: 'Long Shadows',  blurb: 'Every rite recovers a quarter slower.',              mods: { cdScale: 1.25 } },
  { id: 'vengeful-wax',  name: 'Vengeful Wax',  blurb: 'The mercy between statuses is cut in half.',         mods: { statusGapScale: 0.5 } },
  { id: 'hasty-court',   name: 'Hasty Court',   blurb: 'The duel lasts eight minutes, not ten.',             mods: { durationMs: 480_000 } },
  { id: 'fragile-seals', name: 'Fragile Seals', blurb: 'Both duelists open with six Seals.',                 mods: {} },
];

// the Weekly sits on the campaign's first eight Magistrates; the Ninth Seal
// remains the campaign's finale and never answers a weekly summons
const ARC_POOL = [
  'the-grip', 'the-drip', 'the-peal', 'the-lantern',
  'the-map', 'the-forgery', 'the-ledger', 'the-exhumation',
] as const;

const TIERS: Tier[] = ['Medium', 'Hard', 'Expert'];

export interface WeeklyFoe {
  week: number;
  seed: string;
  name: string;
  order: OrderId;
  tier: Tier;
  seals: [number, number];
  profile: ShadeProfile;
  script?: BossScript;
  mods: RuleMods;               // combined overlay (distinct picks → no key collisions)
  modIds: [string, string];     // display order — pick order, stable per week
  bossRung: string;             // the arc id, for the screen's badge
}

// Monday 00:00 UTC weeks: 1970-01-01 was a Thursday, so floor((utcDays + 3) / 7)
// makes Monday 1970-01-05 the start of week 1. Pure UTC — never local midnight.
export const weekIndexFor = (nowMs: number): number => {
  const days = Math.floor(nowMs / 86_400_000);
  return Math.floor((days + 3) / 7);
};

export const weekStartMs = (week: number): number =>
  (Math.floor(week) * 7 - 3) * 86_400_000;

export const weekEndsAtMs = (week: number): number =>
  (Math.floor(week) * 7 + 4) * 86_400_000;

// the first win of the week mints this on top of the standard win economy —
// more than a Daily first win, because the rule changes cut both ways
export const weeklyInkBonus = 120;

// the whole week from one pure fact. Never throws; the same week index is the
// byte-identical duel forever.
export const weeklyForWeek = (week: unknown): WeeklyFoe => {
  const w = typeof week === 'number' && Number.isFinite(week) && week >= 0
    ? Math.floor(week)
    : 0;
  const rng = new Rng(`assize-week-${w}`);
  const n = WEEK_MODS.length;
  // two DISTINCT picks: i uniform over n, j uniform over n-1 then shifted past i
  const i = Math.floor(rng.next() * n) % n;
  let j = Math.floor(rng.next() * (n - 1)) % (n - 1);
  if (j >= i) j++;
  const picks = [WEEK_MODS[i], WEEK_MODS[j]];

  const m = w % ARC_POOL.length;
  const arcId = ARC_POOL[m];
  const boss = FOLIOS[m].duels[2];
  const surname = FOLIOS[m].duels[0].name; // short — the profile name cap is 24
  const tier = TIERS[w % TIERS.length];
  const fragile = picks.some((p) => p.id === 'fragile-seals');

  // the set piece: one fixed solid profile — sharp enough to matter, human enough
  // to beat; the WEEK is the difficulty, not the foe's curve
  const profile = clampProfile({
    name: `Shade of ${surname}`,
    order: boss.order,
    placeDelayMs: [1700, 2900],
    mistakeRate: 0.07,
    abilityCadenceMs: [9000, 16000],
    aggression: 0.62,
    singlesSkill: 0.82,
    techniques: 2,
  });

  return {
    week: w,
    seed: `assize-week-${w}`,
    name: `Shade of ${surname}`,
    order: boss.order,
    tier,
    seals: fragile ? [6, 6] : [7, 7],
    profile,
    script: BOSS_SCRIPTS[arcId],
    mods: { ...picks[0].mods, ...picks[1].mods },
    modIds: [picks[0].id, picks[1].id],
    bossRung: arcId,
  };
};

// display helper for screens: the two WeeklyModDefs a week picked
export const weeklyModDefs = (week: unknown): [WeeklyModDef, WeeklyModDef] => {
  const foe = weeklyForWeek(week);
  const a = WEEK_MODS.find((m) => m.id === foe.modIds[0]) ?? WEEK_MODS[0];
  const b = WEEK_MODS.find((m) => m.id === foe.modIds[1]) ?? WEEK_MODS[1];
  return [a, b];
};
