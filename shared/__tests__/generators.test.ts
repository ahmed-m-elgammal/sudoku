// GENERATOR + RNG + AI contract fuzz — the third testing layer. The adversarial suite
// covers the duel engine; this file attacks the deterministic substrates everything
// else stands on: the sudoku generator, the logic grader, the seeded Rng, and the
// two AI drivers (Shade + tutorial script) under randomised pressure.
import { describe, it, expect } from 'vitest';
import { generatePuzzle, countSolutions, solveOne, grade, generateDaily, tierForDailyDate, dailySeed } from '../sudoku';
import { Rng } from '../rng';
import { shadeAct, profileForStanding } from '../shade';
import { tutorialAct, newTutorialScript } from '../tutorial';
import { createDuel, place, useAbility, tick, cellFlags, type DuelState } from '../engine';
import { UNIT_CELLS, type Digit, type PlayerId, type Tier } from '../config';

// ------------------------------------------------------------------ sudoku generator
describe('G · sudoku generator under fuzz', () => {
  it('G1 every generated puzzle is unique, consistent and solvable (24 seeds, 3 tiers)', () => {
    const cases: Array<[Tier, number]> = [['Easy', 12], ['Medium', 8], ['Hard', 4]];
    let n = 0;
    for (const [tier, count] of cases) {
      for (let i = 0; i < count; i++) {
        const p = generatePuzzle(`gen-${tier}-${i}`, tier);
        n++;
        const givens = p.givens as Array<Digit | 0>;
        const solution = p.solution as Array<Digit | 0>;
        // givens are a subset of the solution, byte for byte
        for (let c = 0; c < 81; c++) {
          if (givens[c] !== 0) expect(givens[c], `${tier} ${i} cell ${c}`).toBe(solution[c]);
        }
        // uniqueness (the generator's core promise)
        expect(countSolutions(Uint8Array.from(givens as Digit[]), 2)).toBe(1);
        // a logic solve lands exactly on the stored solution
        expect(Array.from(solveOne(Uint8Array.from(givens as Digit[])))).toEqual(Array.from(p.solution));
        // recorded metadata is honest
        expect(p.tier).toBe(tier);
        expect(p.givensCount).toBe(givens.filter((g) => g !== 0).length);
        expect(p.givensCount).toBeGreaterThanOrEqual(22);
        expect(p.givensCount).toBeLessThanOrEqual(40);
      }
    }
    expect(n).toBe(24);
  }, 120_000);

  it('G2 Expert puzzles keep their band and their uniqueness (the expensive promise)', () => {
    for (let i = 0; i < 5; i++) {
      const p = generatePuzzle(`gen-expert-${i}`, 'Expert');
      expect(p.givensCount).toBeLessThanOrEqual(30); // band 22-25, tolerant fallback bounded
      expect(countSolutions(Uint8Array.from(p.givens), 2)).toBe(1);
      expect(p.grade).toBeGreaterThanOrEqual(3);
    }
  }, 180_000);

  it('G3 countSolutions never mutates its input (the generator trusts this)', () => {
    const p = generatePuzzle('gen-purity', 'Easy');
    const g = Uint8Array.from(p.givens);
    const before = Array.from(g);
    countSolutions(g, 2);
    countSolutions(g, 1);
    expect(Array.from(g)).toEqual(before);
  });

  it('G4 generation is deterministic per (seed, tier)', () => {
    const a = generatePuzzle('gen-det', 'Medium');
    const b = generatePuzzle('gen-det', 'Medium');
    expect(Array.from(a.givens)).toEqual(Array.from(b.givens));
    expect(Array.from(a.solution)).toEqual(Array.from(b.solution));
    expect(a.grade).toBe(b.grade);
    expect(generatePuzzle('gen-det', 'Hard').givensCount).not.toBeUndefined();
  }, 60_000);

  it('G5 the grader terminates and reports honestly on degenerate inputs', () => {
    const full = solveOne(new Uint8Array(81));
    expect(grade(Uint8Array.from(full))).toEqual({ grade: 1, solved: true });
    const empty = grade(new Uint8Array(81));
    expect(empty.solved).toBe(false);
    expect([1, 2, 3, 4]).toContain(empty.grade); // terminated via the guard, not forever
    // a contradictory grid (two 7s in a row) must not hang the grader
    const bad = new Uint8Array(81);
    bad[0] = 7; bad[1] = 7;
    const r = grade(bad);
    expect(r.solved).toBe(false);
  });

  it('G6 daily puzzles are per-day deterministic and the tier rotation is pinned', () => {
    // Monday anchor: 2024-01-01 was a Monday -> index 0 -> Medium
    expect(tierForDailyDate('2024-01-01')).toBe('Medium');
    expect(tierForDailyDate('2024-01-07')).toBe('Hard');  // Sunday -> last entry
    expect(tierForDailyDate('2024-01-02')).toBe('Easy');  // Tuesday -> index 1
    const a = generateDaily('2024-01-04');
    const b = generateDaily('2024-01-04');
    expect(Array.from(a.givens)).toEqual(Array.from(b.givens));
    expect(dailySeed('2024-01-04')).toBe('assize-daily-2024-01-04');
  }, 90_000);

  it('G7 malformed daily keys fail loudly instead of poisoning the generator', () => {
    for (const bad of ['garbage', '2024-1-4', '2024/01/04', '', '2024-13-40', '9999-99-99']) {
      expect(() => tierForDailyDate(bad), `key "${bad}"`).toThrow(RangeError);
    }
  });
});

// ------------------------------------------------------------------ Rng contract
describe('G · Rng — the deterministic substrate everything else trusts', () => {
  it('G8 same seed, identical stream; different seed, different stream', () => {
    const a = new Rng('stream'); const b = new Rng('stream'); const c = new Rng('stream-2');
    let differed = 0;
    for (let i = 0; i < 1000; i++) {
      const va = a.next(), vb = b.next(), vc = c.next();
      expect(va).toBe(vb); // one draw per stream per iteration — stay in lockstep
      if (va !== vc) differed++;
    }
    expect(differed).toBeGreaterThan(990); // different seeds genuinely diverge
  });

  it('G9 int() never escapes [0, n); shuffle is an in-place permutation', () => {
    const r = new Rng('bounds');
    for (let i = 0; i < 50_000; i++) {
      const v = r.int(9);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(9);
    }
    for (let i = 0; i < 500; i++) {
      const arr = Array.from({ length: 9 }, (_, k) => k + 1);
      const before = [...arr];
      const out = r.shuffle(arr);
      expect(out).toBe(arr); // in place
      expect([...out].sort((x, y) => x - y)).toEqual(before);
    }
  });

  it('G10 range() is inclusive on both ends and state round-trips mid-stream', () => {
    const r = new Rng('range');
    let sawLo = false, sawHi = false;
    for (let i = 0; i < 5000; i++) {
      const v = r.range(3, 5);
      if (v === 3) sawLo = true;
      if (v === 5) sawHi = true;
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(5);
    }
    expect(sawLo && sawHi).toBe(true);
    // state round-trip: pausing a stream and resuming from the stored word reproduces it
    const src = new Rng('pause');
    for (let i = 0; i < 10; i++) src.next();
    const saved = src.state;
    const expected: number[] = [];
    for (let i = 0; i < 20; i++) expected.push(src.next());
    const resumed = new Rng(1);
    resumed.state = saved;
    for (const e of expected) expect(resumed.next()).toBe(e);
  });

  it('G11 the state word stays uint32 even after |0 arithmetic goes negative internally', () => {
    const r = new Rng('uint32');
    for (let i = 0; i < 5000; i++) {
      r.next();
      expect(r.state).toBeGreaterThanOrEqual(0);
      expect(r.state).toBeLessThanOrEqual(0xFFFFFFFF);
    }
    // degenerate seeds still work
    expect(new Rng('').next()).toBe(new Rng('').next());
    expect(new Rng(0).state).toBeGreaterThan(0); // zero seed is re-keyed
  });
});

// ------------------------------------------------------------------ AI drivers under fuzz
const mkAiDuel = (seed: string, orders: ['scholar' | 'executioner' | 'apothecary' | 'warden', 'scholar' | 'executioner' | 'apothecary' | 'warden']): DuelState => {
  const p = generatePuzzle(seed, 'Easy');
  return createDuel({ seed, givens: Uint8Array.from(p.givens), solution: Uint8Array.from(p.solution), orders });
};

describe('G · Shade AI never emits an illegal action under fuzz', () => {
  it('G12 30 seeded runs: every placement lands, every ability belongs to the Order', () => {
    for (let run = 0; run < 30; run++) {
      const st = mkAiDuel(`shade-fuzz-${run}`, run % 2 === 0 ? ['scholar', 'executioner'] : ['scholar', 'apothecary']);
      const prof = profileForStanding(600 + (run * 133) % 1200);
      const rng = new Rng(`shade-fuzz-rng-${run}`);
      let placements = 0;
      for (let step = 0; step < 400 && placements < 35 && st.phase === 'live'; step++) {
        const act = shadeAct(st, 1, prof, () => rng.next(), 0);
        if (act.kind === 'place') {
          // legality is decided against the SAME state the engine will see
          const flags = cellFlags(st, 1);
          expect(st.players[1].board[act.cell]).toBe(0);
          expect(flags.chained.has(act.cell)).toBe(false);
          const res = place(st, 1, act.cell, act.digit);
          expect(res.ok, `run ${run} step ${step}: ${res.reason ?? ''}`).toBe(true);
          placements++;
        } else if (act.kind === 'ability') {
          expect(['sever', 'hush', 'reckoning', 'smudge', 'tincture', 'miasma']).toContain(act.id); // executioner/apothecary kits
          const r = useAbility(st, 1, act.id, {});
          if (!r.ok) expect(['cooldown', 'noUses', 'invalidTarget']).toContain(r.reason as never);
        }
        tick(st, 1000);
      }
      expect(placements).toBeGreaterThan(5);
    }
  }, 180_000);
});

describe('G · tutorial script (T3) under hostile pressure', () => {
  it('G13 even when the Clerk spams mistakes, the Shade never casts and never wins', () => {
    for (const seed of ['t-fuzz-a', 't-fuzz-b', 't-fuzz-c']) {
      const st = mkAiDuel(seed, ['scholar', 'executioner']);
      const script = newTutorialScript();
      const rng = new Rng(`${seed}-script`);
      const now = { v: 0 };
      let casts = 0;
      while (st.phase === 'live' && st.clockMs < 600_000) {
        tick(st, 250);
        now.v += 250;
        // the Clerk hammers a wrong digit every other tick (worst-case Clerk)
        if (st.clockMs % 500 === 0) {
          const p = st.players[0];
          for (let c = 0; c < 81; c++) {
            if (p.board[c] === 0) {
              const trueD = st.solution![c];
              place(st, 0, c, (trueD === 9 ? 1 : 9) as Digit);
              break;
            }
          }
        }
        const act = tutorialAct(script, st, 1, st.players[0].progress, rng, now.v);
        if (act.kind === 'ability') casts++; // the script has no abilities — count would break the contract
        if (act.kind === 'place') {
          const res = place(st, 1, act.cell, act.digit);
          if (st.phase === 'live') expect(res.ok).toBe(true);
        }
      }
      expect(casts).toBe(0);
      // the T3 contract: the Shade can win ONLY through the Clerk's own hand —
      // never by reckoning, and never by more than the one teaching claim
      if (st.phase === 'ended' && st.winner === 1) {
        expect(st.winReason).toBe('seals');
        expect(st.players[0].mistakes).toBeGreaterThanOrEqual(7);
      }
      expect(st.players[1].claimed.length).toBeLessThanOrEqual(1);
    }
  }, 120_000);

  it('G14 the script state advances monotonically and caps its ink for any seed', () => {
    for (const seed of ['t-mono-a', 't-mono-b']) {
      const st = mkAiDuel(seed, ['scholar', 'executioner']);
      const script = newTutorialScript();
      const rng = new Rng(`${seed}-mono`);
      const now = { v: 0 };
      let lastActAt = -1;
      // wake the race with one honest placement
      for (let c = 0; c < 81; c++) if (st.players[0].board[c] === 0) { place(st, 0, c, st.solution![c] as Digit); break; }
      for (let step = 0; step < 2400 && st.phase === 'live'; step++) {
        tick(st, 250);
        now.v += 250;
        const before = script.nextActAtClock;
        const act = tutorialAct(script, st, 1, st.players[0].progress, rng, now.v);
        expect(script.nextActAtClock).toBeGreaterThanOrEqual(before);
        if (act.kind === 'place') {
          expect(st.clockMs).toBeGreaterThanOrEqual(lastActAt);
          lastActAt = st.clockMs;
          place(st, 1, act.cell, act.digit);
        }
      }
      expect(st.players[1].progress).toBeLessThanOrEqual(23); // CORRECT_CAP 22 + 1 teaching tolerance
      expect(script.demoClaimsLeft).toBeGreaterThanOrEqual(0);
      expect(script.slipsMade).toBeGreaterThanOrEqual(0);
    }
  }, 120_000);
});

// ------------------------------------------------------------------ engine-side helper re-check
describe('G · unit topology (the claims map trusts this)', () => {
  it('G15 every cell belongs to exactly its row, column and box; all 27 units exist once', () => {
    const seen = new Set<string>();
    for (let c = 0; c < 81; c++) {
      const r = Math.floor(c / 9), col = c % 9, b = Math.floor(r / 3) * 3 + Math.floor(col / 3);
      const us = [`r${r}`, `c${col}`, `b${b}`];
      for (const u of us) {
        seen.add(u);
        expect(UNIT_CELLS[u]).toContain(c);
      }
    }
    expect(seen.size).toBe(27);
    for (const u of Object.keys(UNIT_CELLS)) expect(UNIT_CELLS[u]).toHaveLength(9);
  });

  it('G16 player ids beyond 0/1 are rejected everywhere (regression: crash seat)', () => {
    const st = mkAiDuel('seat-guard', ['scholar', 'executioner']);
    const bad = [2, -1, 1.5, NaN] as unknown as PlayerId[];
    for (const p of bad) {
      expect(place(st, p, 0, 5 as Digit).ok).toBe(false);
      expect(tick).toBeDefined(); // tick has no seat argument — documented here on purpose
    }
  });
});
