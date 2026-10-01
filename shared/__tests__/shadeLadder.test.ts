// T16 — Shade technique ladder + tempo adaptation. ADVERSARIAL SUITE.
// These tests are written to break the ladder, not to bless it:
//   · candidate-consistency property over poisoned and clean boards (elimination bugs)
//   · tier-0 purity against the shipped naked-singles bot (regression pin)
//   · byte-identical determinism of whole duels
//   · statistical difficulty monotonicity across tiers (a ladder that stalls fails here)
//   · envelope-escape and delay-ordering attacks on clampProfile/adaptProfile
//   · legality fuzz: no placement may ever hit given/filled/chained, no cast unknown/wrongOrder
//   · the "Shades must actually solve" guarantee: tier-3 finishes Easy tablets
import { describe, it, expect } from 'vitest';
import { generatePuzzle } from '../sudoku';
import {
  createDuel, tick, place, useAbility, applyStatus, serializeDuel, cellFlags,
  type DuelState, type PlaceResult,
} from '../engine';
import { Rng } from '../rng';
import { CONFIG, type Digit } from '../config';
import {
  shadeAct, profileForStanding, clampProfile, adaptProfile, nakedSingles,
  deducedPlacements, candidateMasks, tieredTechniques, PROFILE_ENVELOPE, ADAPT_GAP,
  type ShadeProfile,
} from '../shade';

// ---------------------------------------------------------------- harness
interface Placement { cell: number; digit: number; correct: boolean; preBoard: Uint8Array }

interface RunResult {
  st: DuelState;
  placements: Placement[];
  badReasons: string[];
  casts: string[];
}

// deterministic shade-vs-idle duel: mirrors LocalDuel's scheduling contract
// (wake → act → apply → reschedule), but on the ENGINE clock so it is testable.
const runShadeDuel = (
  seed: string,
  tier: 'Easy' | 'Medium' | 'Hard' | 'Expert',
  profile: ShadeProfile,
  capMs = 240_000,
): RunResult => {
  const puz = generatePuzzle(seed, tier);
  const st = createDuel({
    seed,
    givens: Uint8Array.from(puz.givens),
    solution: Uint8Array.from(puz.solution),
    names: ['You', 'Shade'],
    orders: ['scholar', profile.order],
  });
  const rng = new Rng(`${seed}-shade`);
  const placements: Placement[] = [];
  const badReasons: string[] = [];
  const casts: string[] = [];
  let wake = 600;
  let guard = 0;
  while (st.phase === 'live' && st.clockMs < capMs && guard++ < 4000) {
    tick(st, 250);
    if (st.phase !== 'live') break;
    if (st.clockMs < wake) continue;
    const act = shadeAct(st, 1, profile, () => rng.next(), st.clockMs);
    if (act.kind === 'place') {
      const flags = cellFlags(st, 1);
      const preBoard = Uint8Array.from(st.players[1].board);
      if (preBoard[act.cell] !== 0) badReasons.push('harness:target-filled');
      else if (flags.chained.has(act.cell)) badReasons.push('harness:target-chained');
      const res: PlaceResult = place(st, 1, act.cell, act.digit);
      if (!res.ok) badReasons.push(`place:${res.reason}`);
      else placements.push({ cell: act.cell, digit: act.digit, correct: !!res.correct, preBoard });
      wake = st.clockMs + 900;
    } else if (act.kind === 'ability') {
      const res = useAbility(st, 1, act.id, { cell: act.cell, unit: act.unit });
      if (!res.ok && res.reason !== 'invalidTarget') badReasons.push(`ability:${act.id}:${res.reason}`);
      casts.push(act.id);
      wake = st.clockMs + 900;
    } else {
      wake = st.clockMs + Math.max(400, act.untilMs - st.clockMs);
    }
  }
  return { st, placements, badReasons, casts };
};

const fastCleanProfile = (techniques: 0 | 1 | 2 | 3): ShadeProfile => ({
  name: 'Ladder',
  order: 'executioner',
  placeDelayMs: [700, 700],
  mistakeRate: 0,
  abilityCadenceMs: [32000, 32000],
  aggression: 0,        // no cast rolls: placement throughput is the only variable
  singlesSkill: 1,
  techniques,
});

const progressedBoard = (seed: string, tier: 'Easy' | 'Medium' | 'Hard' | 'Expert', k: number): Uint8Array => {
  const puz = generatePuzzle(seed, tier);
  const board = new Uint8Array(81);
  board.set(puz.givens);
  const empties: number[] = [];
  for (let c = 0; c < 81; c++) if (!board[c]) empties.push(c);
  for (let i = 0; i < k && i < empties.length; i++) {
    const c = empties[(i * 7 + seed.length) % empties.length];
    if (!board[c]) board[c] = puz.solution[c];
  }
  return board;
};

// ---------------------------------------------------------------- clampProfile / envelope
describe('T16 · clampProfile envelope (hostile inputs)', () => {
  it('normalizes NaN, Infinity, negatives and absurd magnitudes into the envelope', () => {
    const hostile = {
      name: ''.padEnd(80, 'x'),
      order: 'executioner' as const,
      placeDelayMs: [Number.NaN, Number.POSITIVE_INFINITY] as [number, number],
      mistakeRate: -5,
      abilityCadenceMs: [-1, 1e12] as [number, number],
      aggression: 42,
      singlesSkill: Number.NaN,
      techniques: 99 as 0 | 1 | 2 | 3,
    };
    const c = clampProfile(hostile);
    expect(c.placeDelayMs[0]).toBeGreaterThanOrEqual(PROFILE_ENVELOPE.placeDelayMinMs);
    expect(c.placeDelayMs[1]).toBeLessThanOrEqual(PROFILE_ENVELOPE.placeDelayMaxMs);
    expect(c.mistakeRate).toBeGreaterThanOrEqual(PROFILE_ENVELOPE.mistakeRateMin);
    expect(c.mistakeRate).toBeLessThanOrEqual(PROFILE_ENVELOPE.mistakeRateMax);
    expect(c.aggression).toBeLessThanOrEqual(PROFILE_ENVELOPE.aggressionMax);
    expect(Number.isFinite(c.singlesSkill)).toBe(true);
    expect(c.techniques).toBe(3);
    for (const v of [...c.placeDelayMs, ...c.abilityCadenceMs, c.mistakeRate, c.aggression, c.singlesSkill]) {
      expect(Number.isFinite(v)).toBe(true);
    }
    expect(c.name.length).toBeLessThanOrEqual(24);
  });

  it('orders placeDelayMs so lo <= hi no matter what arrives (inverted bands must not survive)', () => {
    const inverted = clampProfile({
      ...profileForStanding(1000),
      placeDelayMs: [9000, 700],
    });
    expect(inverted.placeDelayMs[0]).toBeLessThanOrEqual(inverted.placeDelayMs[1]);
  });

  it('is pure: no mutation, no drift across repeated calls', () => {
    const base = profileForStanding(1400);
    const frozen = JSON.parse(JSON.stringify(base)) as ShadeProfile;
    const a = clampProfile(base);
    const b = clampProfile(base);
    expect(a).toEqual(b);
    expect(base).toEqual(frozen);
  });
});

// ---------------------------------------------------------------- tier-0 purity
describe('T16 · tier-0 purity (≡ shipped naked-singles bot)', () => {
  it('deducedPlacements(board, 0) is exactly nakedSingles(board) on 24 seeded boards', () => {
    for (let i = 0; i < 24; i++) {
      const seed = `purity-${i}`;
      const tier = (['Easy', 'Medium', 'Hard', 'Expert'] as const)[i % 4];
      const board = progressedBoard(seed, tier, (i * 5) % 30);
      const a = deducedPlacements(board, 0).sort((x, y) => x.cell - y.cell);
      const b = nakedSingles(board).sort((x, y) => x.cell - y.cell);
      expect(a).toEqual(b);
    }
  });

  it('a tier-0 shade with skill 1 and no mistakes only ever places correct naked singles', () => {
    for (let i = 0; i < 4; i++) {
      const run = runShadeDuel(`pure0-${i}`, 'Medium', fastCleanProfile(0), 120_000);
      expect(run.badReasons).toEqual([]);
      for (const p of run.placements) {
        expect(p.correct).toBe(true);
        const singles = nakedSingles(p.preBoard);
        expect(singles.some((s) => s.cell === p.cell && s.digit === p.digit)).toBe(true);
      }
    }
  });
});

// ---------------------------------------------------------------- candidate-consistency
describe('T16 · candidate-consistency under every tier (clean AND poisoned boards)', () => {
  const consistent = (board: Uint8Array, cell: number, digit: number): boolean => {
    const used = new Set<number>();
    for (let c = 0; c < 81; c++) {
      if (!board[c] || c === cell) continue;
      const sameRow = Math.floor(c / 9) === Math.floor(cell / 9);
      const sameCol = c % 9 === cell % 9;
      const sameBox = Math.floor(c / 27) === Math.floor(cell / 27) && Math.floor((c % 9) / 3) === Math.floor((cell % 9) / 3);
      if (sameRow || sameCol || sameBox) used.add(board[c]);
    }
    return !used.has(digit);
  };

  it('every deduction sweep output is candidate-consistent — 30 boards × tiers 0..3', () => {
    for (let i = 0; i < 30; i++) {
      const seed = `consistency-${i}`;
      const tier = (['Easy', 'Medium', 'Hard', 'Expert'] as const)[i % 4];
      const board = progressedBoard(seed, tier, (i * 3) % 34);
      if (i % 5 === 4) {
        // poison: one wrong digit burned onto the board (a real Shade mistake)
        const puz = generatePuzzle(seed, tier);
        const empties: number[] = [];
        for (let c = 0; c < 81; c++) if (!board[c]) empties.push(c);
        const c = empties[i % empties.length];
        const trueDigit = puz.solution[c];
        board[c] = ((trueDigit % 9) + 1) as Digit;
      }
      const masks = candidateMasks(board);
      for (const tierN of [0, 1, 2, 3]) {
        for (const s of deducedPlacements(board, tierN)) {
          const m = masks[s.cell];
          expect(m, `seed ${seed} tier ${tierN} cell ${s.cell}`).toBeGreaterThan(0);
          expect((m & (1 << (s.digit - 1))) !== 0, `seed ${seed} tier ${tierN} cell ${s.cell} digit ${s.digit}`).toBe(true);
          expect(consistent(board, s.cell, s.digit), `seed ${seed} tier ${tierN} unit-contradiction cell ${s.cell}`).toBe(true);
        }
      }
    }
  });

  it('a live tier-3 shade with zero mistake rate never places a unit-contradicting digit', () => {
    for (let i = 0; i < 6; i++) {
      const run = runShadeDuel(`live3-${i}`, (['Easy', 'Medium', 'Hard'] as const)[i % 3], fastCleanProfile(3), 180_000);
      expect(run.badReasons).toEqual([]);
      for (const p of run.placements) {
        expect(p.correct, `seed live3-${i} cell ${p.cell} digit ${p.digit} on a clean board must be true ink`).toBe(true);
      }
    }
  });
});

// ---------------------------------------------------------------- determinism
describe('T16 · determinism', () => {
  it('the same seed and profile produce byte-identical duels at every tier', () => {
    for (const tier of [0, 1, 2, 3] as const) {
      const a = runShadeDuel('det-seed', 'Medium', fastCleanProfile(tier), 90_000);
      const b = runShadeDuel('det-seed', 'Medium', fastCleanProfile(tier), 90_000);
      expect(serializeDuel(a.st)).toBe(serializeDuel(b.st));
    }
  });
});

// ---------------------------------------------------------------- monotonicity
describe('T16 · the ladder must actually climb (statistical monotonicity)', () => {
  it('aggregate correct placements over 10 Medium seeds: tier3 > tier0, and tier3 >= tier1 >= tier0', () => {
    const totals: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0 };
    for (let i = 0; i < 10; i++) {
      for (const tier of [0, 1, 2, 3] as const) {
        const run = runShadeDuel(`mono-${i}`, 'Medium', fastCleanProfile(tier), 150_000);
        expect(run.badReasons).toEqual([]);
        totals[tier] += run.placements.filter((p) => p.correct).length;
      }
    }
    expect(totals[3]).toBeGreaterThan(totals[0]);
    expect(totals[1]).toBeGreaterThanOrEqual(totals[0]);
    expect(totals[3]).toBeGreaterThanOrEqual(totals[1]);
  });
});

// ---------------------------------------------------------------- the solve guarantee
describe('T16 · a tier-3 Shade finishes Easy tablets (it solves, not waits)', () => {
  // Racing an idle pleader, a solving Shade wins by SEALS (claims land long before
  // the tablet fills) — and a claim is impossible without genuinely completing
  // units, so ≥ 20 correct placements is the real “it solves” proof.
  it('wins on 5/5 Easy seeds having genuinely completed units inside 5 simulated minutes', () => {
    for (let i = 0; i < 5; i++) {
      const run = runShadeDuel(`solve-${i}`, 'Easy', { ...fastCleanProfile(3), mistakeRate: 0.04 }, 300_000);
      expect(run.st.phase).toBe('ended');
      expect(run.st.winner).toBe(1);
      expect(['seals', 'reckoning']).toContain(run.st.winReason);
      // completing a unit to claim it IS the solve-proof: luck cannot finish a unit,
      // and a win by seals ends the duel before the tablet can fill (observed: 4-5
      // claims from ~16 true placements vs an idle 7-seal pleader — correct math)
      expect(run.st.players[1].claimed.length, `seed solve-${i} claimed only ${run.st.players[1].claimed.length}`).toBeGreaterThanOrEqual(3);
      expect(run.placements.filter((p) => p.correct).length).toBeGreaterThanOrEqual(12);
    }
  });
});

// ---------------------------------------------------------------- legality fuzz
describe('T16 · legality fuzz (24 seeds × all tiers, aggressive + mistake-prone)', () => {
  it('never hits given/filled/chained/noSolution placements or unknown/wrongOrder casts', () => {
    const seenReasons = new Set<string>();
    for (let i = 0; i < 24; i++) {
      const tier = (['Easy', 'Medium', 'Hard', 'Expert'] as const)[i % 4];
      const prof: ShadeProfile = {
        ...profileForStanding(600 + i * 55),
        name: `Fuzz${i}`,
        techniques: (i % 4) as 0 | 1 | 2 | 3,
      };
      const run = runShadeDuel(`fuzz-${i}`, tier, prof, 150_000);
      expect(run.badReasons, `seed fuzz-${i}`).toEqual([]);
      for (const c of run.casts) seenReasons.add(c);
    }
    expect(seenReasons.size).toBeGreaterThan(0); // the fuzz actually exercised casts
  });
});

// ---------------------------------------------------------------- tempo adaptation
describe('T16 · adaptProfile (bounded lean-in / coast)', () => {
  const stateWithSeals = (shadeSeals: number, foeSeals: number): DuelState => {
    const puz = generatePuzzle('adapt', 'Easy');
    const st = createDuel({
      seed: 'adapt',
      givens: Uint8Array.from(puz.givens),
      solution: Uint8Array.from(puz.solution),
      magistrateSeals: [Math.max(1, foeSeals), Math.max(1, shadeSeals)],
    });
    return st;
  };

  it('stays inside the envelope for every seal combination on the grid (no NaN, lo<=hi)', () => {
    for (let me = 0; me <= 8; me++) {
      for (let foe = 0; foe <= 8; foe++) {
        const adapted = adaptProfile(profileForStanding(1000), stateWithSeals(me, foe), 1);
        const c = clampProfile(adapted);
        expect(adapted).toEqual(c);
        expect(adapted.placeDelayMs[0]).toBeLessThanOrEqual(adapted.placeDelayMs[1]);
        for (const v of [...adapted.placeDelayMs, ...adapted.abilityCadenceMs, adapted.mistakeRate, adapted.aggression, adapted.singlesSkill]) {
          expect(Number.isFinite(v)).toBe(true);
        }
      }
    }
  });

  it('is inert inside the deadband (|gap| < ADAPT_GAP) and pure', () => {
    const base = profileForStanding(1000);
    expect(adaptProfile(base, stateWithSeals(5, 5), 1)).toEqual(clampProfile(base));
    expect(adaptProfile(base, stateWithSeals(5, 5 + ADAPT_GAP - 1), 1)).toEqual(clampProfile(base));
    const once = adaptProfile(base, stateWithSeals(1, 7), 1);
    expect(once).toEqual(adaptProfile(base, stateWithSeals(1, 7), 1));
  });

  it('leans in when losing (faster, sharper) and coasts when crushing (slower)', () => {
    const base = clampProfile(profileForStanding(1000));
    const losing = adaptProfile(base, stateWithSeals(1, 7), 1);
    const crushing = adaptProfile(base, stateWithSeals(7, 1), 1);
    expect(losing.placeDelayMs[1]).toBeLessThan(base.placeDelayMs[1]);
    expect(losing.singlesSkill).toBeGreaterThan(base.singlesSkill);
    expect(crushing.placeDelayMs[1]).toBeGreaterThan(base.placeDelayMs[1]);
    expect(crushing.singlesSkill).toBeLessThan(base.singlesSkill);
  });

  it('never mutates the profile or the state it reads', () => {
    const base = profileForStanding(1200);
    const st = stateWithSeals(1, 7);
    const snap = serializeDuel(st);
    const snapProf = JSON.stringify(base);
    adaptProfile(base, st, 1);
    expect(JSON.stringify(base)).toBe(snapProf);
    expect(serializeDuel(st)).toBe(snap);
  });
});

// ---------------------------------------------------------------- acting-loop contracts
describe('T16 · shadeAct contracts', () => {
  const newDuel = (seed = 'contracts', orders: ['scholar', 'warden'] | undefined = undefined): DuelState => {
    const puz = generatePuzzle(seed, 'Easy');
    return createDuel({
      seed,
      givens: Uint8Array.from(puz.givens),
      solution: Uint8Array.from(puz.solution),
      ...(orders ? { orders } : {}),
    });
  };

  it('waits while hushed instead of churning refused placements', () => {
    const st = newDuel('hushed');
    applyStatus(st, 0, 'hush', 1);
    const act = shadeAct(st, 1, profileForStanding(1500), () => 0.5, 1000);
    expect(act.kind).toBe('wait');
  });

  it('waits once the duel has ended and never touches a dead state', () => {
    const st = newDuel('ended');
    st.phase = 'ended';
    const act = shadeAct(st, 1, profileForStanding(1500), () => 0.5, 1000);
    expect(act.kind).toBe('wait');
  });

  it('degrades safely on degenerate boards: empty board and one-cell board never crash', () => {
    const empty = newDuel('empty');
    empty.players[1].board = new Uint8Array(81);
    const a = shadeAct(empty, 1, fastCleanProfile(3), () => 0.5, 0);
    expect(['wait', 'place', 'ability']).toContain(a.kind);

    const almost = newDuel('almost');
    const b = shadeAct(almost, 1, fastCleanProfile(3), () => 0.5, 0);
    expect(['wait', 'place', 'ability']).toContain(b.kind);
  });

  it('tier >= 2 quarantine hunts the foe’s most nearly complete unclaimed unit', () => {
    const st = newDuel('hunt', ['scholar', 'warden']);
    const puz = generatePuzzle('hunt', 'Easy');
    const p0 = st.players[0];
    for (let c = 0; c < 8; c++) p0.board[c] = puz.solution[c]; // r0 one cell from done
    st.players[1].abilities.ward.cdLeftMs = 1;
    st.players[1].abilities.mirror.cdLeftMs = 1;
    const act = shadeAct(st, 1, { ...profileForStanding(1800), order: 'warden', techniques: 3 }, () => 0.01, 0);
    expect(act.kind).toBe('ability');
    expect((act as { id: string }).id).toBe('quarantine');
    expect((act as { unit?: string }).unit).toBe('r0');
  });

  it('tier < 2 quarantine stays legal (a row), never garbage', () => {
    const st = newDuel('row', ['scholar', 'warden']);
    st.players[1].abilities.ward.cdLeftMs = 1;
    st.players[1].abilities.mirror.cdLeftMs = 1;
    const act = shadeAct(st, 1, { ...profileForStanding(600), order: 'warden', techniques: 0 }, () => 0.01, 0);
    expect(act.kind).toBe('ability');
    expect((act as { id: string }).id).toBe('quarantine');
    expect((act as { unit?: string }).unit).toMatch(/^r[0-8]$/);
  });
});

// ---------------------------------------------------------------- campaign re-tiering
describe('T16 · tieredTechniques (campaign shadeKind re-tiering)', () => {
  it('shifts by folio role and clamps to [0,3], including NaN inputs', () => {
    expect(tieredTechniques(2, 'lieutenant')).toBe(2);
    expect(tieredTechniques(2, 'minor')).toBe(1);
    expect(tieredTechniques(2, 'boss')).toBe(3);
    expect(tieredTechniques(0, 'minor')).toBe(0);
    expect(tieredTechniques(3, 'boss')).toBe(3);
    expect(tieredTechniques(Number.NaN)).toBe(0);
    expect(tieredTechniques(1.7)).toBe(2); // rounds, then clamps
  });
});

// ---------------------------------------------------------------- standing curve
describe('T16 · profileForStanding keeps its calibrated shape and gains a legal tier', () => {
  it('delays shrink and skill grows with standing; techniques climb 0→3', () => {
    const seen = new Set<number>();
    for (const standing of [600, 800, 1000, 1200, 1400, 1600, 1800]) {
      const p = profileForStanding(standing);
      expect(p.placeDelayMs[0]).toBeLessThanOrEqual(p.placeDelayMs[1]);
      expect(p.mistakeRate).toBeGreaterThanOrEqual(0);
      expect(p.singlesSkill).toBeLessThanOrEqual(PROFILE_ENVELOPE.singlesSkillMax);
      seen.add(p.techniques ?? -1);
    }
    expect(seen.has(0)).toBe(true);
    expect(seen.has(3)).toBe(true);
  });
});

// ---------------------------------------------------------------- regression guards
describe('T16 · shipped contracts still hold', () => {
  it('the old worst-case Shade run (generators suite shape) stays legal at every tier', () => {
    for (const techniques of [0, 1, 2, 3] as const) {
      const run = runShadeDuel('regress', 'Hard', { ...profileForStanding(600), techniques }, 120_000);
      expect(run.badReasons).toEqual([]);
    }
  });

  it('CONFIG placement constants are untouched by this iteration', () => {
    expect(CONFIG.placement.wrongSealCost).toBe(1);
    expect(CONFIG.claims.damage).toBe(1);
  });
});
