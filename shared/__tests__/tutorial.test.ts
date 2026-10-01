// Tutorial scripting tests (TODO T3): the Shade of Orsolo must duel to lose,
// deterministically, for every seed — never winning by race, claim, or rite.
import { describe, it, expect } from 'vitest';
import { generatePuzzle } from '../sudoku';
import { createDuel, place, tick, type DuelState } from '../engine';
import { Rng } from '../rng';
import { tutorialAct, newTutorialScript, TUTORIAL_CORRECT_CAP, type TutorialScriptState } from '../tutorial';
import type { Digit } from '../config';

interface Harness {
  st: DuelState;
  script: TutorialScriptState;
  rand: Rng;
  acts: Array<{ kind: string; atClock: number }>;
}

const newHarness = (seed: string): Harness => {
  const puz = generatePuzzle(seed, 'Easy');
  const st = createDuel({
    seed,
    givens: Uint8Array.from(puz.givens),
    solution: Uint8Array.from(puz.solution),
    names: ['You', 'Shade of Orsolo'],
    orders: ['scholar', 'executioner'],
  });
  return { st, script: newTutorialScript(), rand: new Rng(`${seed}-script`), acts: [] };
};

// the Clerk plays honestly: one correct digit every ~5.5s of duel clock
function humanStep(h: Harness) {
  const st = h.st;
  const p = st.players[0];
  for (let c = 0; c < 81; c++) {
    if (p.board[c] === 0) {
      place(st, 0, c, st.solution![c] as Digit);
      return;
    }
  }
}

function advance(h: Harness, realNow: { v: number }, untilClock: number) {
  const st = h.st;
  while (st.phase === 'live' && st.clockMs < untilClock) {
    tick(st, 250);
    realNow.v += 250;
    const act = tutorialAct(h.script, st, 1, st.players[0].progress, h.rand, realNow.v);
    if (act.kind === 'place') {
      place(st, 1, act.cell, act.digit);
      h.acts.push({ kind: 'slip-or-ink', atClock: st.clockMs });
    } else if (act.kind === 'ability') {
      h.acts.push({ kind: 'ability', atClock: st.clockMs });
    }
  }
}

describe('tutorial scripting (T3)', () => {
  it('holds its hand until the Clerk places a first correct digit', () => {
    const h = newHarness('tutorial-orsolo');
    const now = { v: 0 };
    // 30 simulated seconds of idle Clerk: the Shade must not touch the Tablet
    advance(h, now, 30_000);
    expect(h.st.players[1].progress).toBe(0);
    expect(h.st.players[1].claimed.length).toBe(0);
    // one honest placement wakes the race
    humanStep(h);
    advance(h, now, 40_000);
    expect(h.st.players[1].progress).toBeGreaterThan(0);
  });

  it('never casts a rite', () => {
    const h = newHarness('tutorial-orsolo');
    const now = { v: 0 };
    humanStep(h);
    advance(h, now, 600_000); // full duel
    for (const a of h.acts) expect(a.kind).not.toBe('ability');
    expect(h.st.events.some((e) => e.kind === 'ability' && e.player === 1)).toBe(false);
  });

  it('takes at most one teaching claim', () => {
    const h = newHarness('tutorial-orsolo');
    const now = { v: 0 };
    humanStep(h);
    advance(h, now, 600_000);
    expect(h.st.players[1].claimed.length).toBeLessThanOrEqual(1);
  });

  it('caps its correct ink and never completes the Tablet', () => {
    const h = newHarness('tutorial-orsolo');
    const now = { v: 0 };
    humanStep(h);
    advance(h, now, 600_000);
    expect(h.st.players[1].progress).toBeLessThanOrEqual(TUTORIAL_CORRECT_CAP + 1);
    expect(h.st.players[1].board.every((v) => v !== 0)).toBe(false);
    if (h.st.phase === 'ended') {
      expect(h.st.winReason).not.toBe('reckoning');
    }
  });

  it('loses the duel by Seals against an honest Clerk, well before Sudden Judgment', () => {
    for (const seed of ['tutorial-orsolo', 'tutorial-b', 'tutorial-c', 'tutorial-d']) {
      const h = newHarness(seed);
      const now = { v: 0 };
      humanStep(h);
      advance(h, now, 600_000);
      expect(h.st.phase).toBe('ended');
      expect(h.st.winner).toBe(0);
      expect(h.st.winReason).toBe('seals');
      // the Shade must slip on its own hand (scripted wrong digits)
      expect(h.script.slipsMade).toBeGreaterThanOrEqual(2);
    }
  });

  it('is deterministic for a given seed', () => {
    const run = () => {
      const h = newHarness('tutorial-orsolo');
      const now = { v: 0 };
      const humanCells: number[] = [];
      // scripted Clerk: first-empty-cell honest play on a fixed cadence
      while (h.st.phase === 'live' && h.st.clockMs < 600_000) {
        tick(h.st, 250);
        now.v += 250;
        if (Math.floor(h.st.clockMs / 5500) > humanCells.length) {
          const p = h.st.players[0];
          for (let c = 0; c < 81; c++) if (p.board[c] === 0) { place(h.st, 0, c, h.st.solution![c] as Digit); humanCells.push(c); break; }
        }
        const act = tutorialAct(h.script, h.st, 1, h.st.players[0].progress, h.rand, now.v);
        if (act.kind === 'place') place(h.st, 1, act.cell, act.digit);
      }
      return {
        winner: h.st.winner,
        reason: h.st.winReason,
        shadeProgress: h.st.players[1].progress,
        shadeSeals: h.st.players[1].seals,
        slips: h.script.slipsMade,
        demo: h.st.players[1].claimed.length,
        humanBoard: Array.from(h.st.players[0].board),
      };
    };
    const a = run();
    const b = run();
    expect(b).toEqual(a);
    expect(a.winner).toBe(0);
  });

  it('the Clerk can still lose by their own hand (seven honest mistakes)', () => {
    const h = newHarness('tutorial-orsolo');
    const now = { v: 0 };
    // the Clerk spams a wrong digit seven times: Marginalia forgives the first only
    const p = h.st.players[0];
    const wrongCell = (() => {
      for (let c = 0; c < 81; c++) if (p.board[c] === 0) return c;
      return -1;
    })();
    const wrongDigit = (() => {
      const trueD = h.st.solution![wrongCell];
      return trueD === 9 ? 1 : 9;
    })();
    for (let i = 0; i < 7; i++) place(h.st, 0, wrongCell, wrongDigit as 1);
    advance(h, now, 600_000);
    expect(h.st.phase).toBe('ended');
    expect(h.st.winner).toBe(1);
  });
});
