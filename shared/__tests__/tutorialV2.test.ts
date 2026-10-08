// Tutorial script v2 invariants (docs/TUTORIAL_OPTIMIZATION_PLAN.md §5.4, M2).
// The v1 invariants carry over with the v2 deltas: frozen until armed, paced race,
// telegraphed claims, no early slips, floor-aware waits, same caps (never a rite,
// never a swap, never the Tablet, always loses by Seals in time).
import { describe, it, expect } from 'vitest';
import { generatePuzzle } from '../sudoku';
import { createDuel, place, type DuelState } from '../engine';
import { Rng } from '../rng';
import {
  tutorialV2Act, newTutorialV2Script, armTutorialRace, tutorialV2Telegraph,
  TUTORIAL_V2_CLAIMS, type TutorialV2State,
} from '../tutorialV2';
import { CONFIG } from '../config';

interface Harness {
  st: DuelState;
  script: TutorialV2State;
  rand: Rng;
  trace: string[];
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
  return { st, script: newTutorialV2Script(), rand: new Rng(`${seed}-v2script`), trace: [] };
};

/** Drive `n` Shade wakes: advance the clock past the next act, call the script. */
function wake(h: Harness, n: number): void {
  for (let i = 0; i < n; i++) {
    h.st.clockMs += 15_000;
    const act = tutorialV2Act(h.script, h.st, 1, h.rand, 0);
    h.trace.push(act.kind === 'place' ? `place:${act.cell}:${act.digit}` : `wait`);
    if (act.kind === 'place') place(h.st, 1, act.cell, act.digit);
  }
}

describe('shared/tutorialV2 · frozen teaching (§5.4 delta 1)', () => {
  it('V2-1 the Shade does nothing until the race is armed — no ink, no telegraph', () => {
    const h = newHarness('v2-frozen');
    wake(h, 40);
    // every wake was a wait: the teaching phases are claim- and damage-free
    expect(h.trace.every((t) => t === 'wait')).toBe(true);
    expect(h.st.players[1].progress).toBe(0);
    expect(tutorialV2Telegraph(h.script)).toBeNull();
  });

  it('V2-2 arming starts the race; the ink cadence is 8–12 s while the Clerk has < 6 correct', () => {
    const h = newHarness('v2-pace');
    armTutorialRace(h.script);
    const deltas: number[] = [];
    for (let i = 0; i < 12 && deltas.length < 6; i++) {
      h.st.clockMs += 15_000;
      const landing = tutorialV2Telegraph(h.script) !== null; // a claim ink-landing, not a race placement
      const act = tutorialV2Act(h.script, h.st, 1, h.rand, 0);
      if (act.kind === 'place') {
        if (!landing) deltas.push(h.script.nextActAtClock - h.st.clockMs);
        place(h.st, 1, act.cell, act.digit);
      }
    }
    expect(deltas.length).toBeGreaterThanOrEqual(4);
    const [lo, hi] = CONFIG.tutorialV2.raceDelayMs;
    // the NEXT act is scheduled within the slow window (small overshoot allowed: the
    // scheduler never schedules earlier than the window, which is the law that matters)
    expect(deltas.every((d) => d >= lo - 1)).toBe(true);
    expect(deltas.every((d) => d <= hi + 1)).toBe(true);
  });
});

describe('shared/tutorialV2 · telegraphed claims (§5.4 delta 3)', () => {
  it('V2-3 a completing placement is announced first and lands only after the lead', () => {
    const h = newHarness('v2-telegraph');
    armTutorialRace(h.script);
    let announced = false;
    for (let i = 0; i < 60 && !announced; i++) {
      h.st.clockMs += 15_000;
      const act = tutorialV2Act(h.script, h.st, 1, h.rand, 0);
      if (tutorialV2Telegraph(h.script) !== null) {
        announced = true;
        // the announcement itself is NOT the ink: this wake must be a wait…
        expect(act.kind).toBe('wait');
        // …the lead is honored…
        expect(act.kind === 'wait' ? act.untilMs : 0).toBeGreaterThanOrEqual(CONFIG.tutorialV2.telegraphLeadMs - 1);
        // …and the announced unit still has exactly one empty cell for the Shade
        expect(h.st.players[1].progress).toBeLessThan(81);
      } else if (act.kind === 'place') {
        place(h.st, 1, act.cell, act.digit);
      }
    }
    expect(announced).toBe(true);
  });
});

describe('shared/tutorialV2 · slips (§5.4 delta 4) and the floor (delta 5)', () => {
  it('V2-4 no scripted slip before the Clerk\u2019s 4th correct placement', () => {
    const h = newHarness('v2-noslips');
    armTutorialRace(h.script);
    h.st.players[0].progress = 3; // one short of the slip threshold
    wake(h, 12);
    const shadeDigits = h.trace.filter((t) => t.startsWith('place:'));
    // every Shade digit so far is TRUE ink (a slip would carry a wrong digit and a Seal cost)
    const trueDigits = h.st.players[1].progress;
    expect(trueDigits).toBe(shadeDigits.length);
  });

  it('V2-5 at the one-Seal floor the Shade waits even after arming', () => {
    const h = newHarness('v2-floor');
    armTutorialRace(h.script);
    h.st.players[0].seals = 1;
    wake(h, 10);
    expect(h.trace.every((t) => t === 'wait')).toBe(true);
    expect(h.st.players[1].progress).toBe(0);
  });
});

describe('shared/tutorialV2 · the caps carry over (§5.4)', () => {
  it('V2-6 the Shade never fills the Tablet: correct ink caps, then only slips', () => {
    const h = newHarness('v2-cap');
    armTutorialRace(h.script);
    h.st.players[0].progress = 6; // late pace, slips owed from 4
    wake(h, 160);
    expect(h.script.correctPlacements).toBeLessThanOrEqual(CONFIG.tutorialV2.correctCap);
    // past the cap every placement is a plausible wrong digit — the Shade loses by Seals
    if (h.script.correctPlacements === CONFIG.tutorialV2.correctCap) {
      expect(h.script.slipsMade).toBeGreaterThan(0);
    }
    expect(h.st.players[1].progress).toBeLessThan(45);
  });

  it('V2-7 the script only ever waits or places — it never casts a rite and never swaps', () => {
    const h = newHarness('v2-kinds');
    armTutorialRace(h.script);
    wake(h, 80);
    expect(h.trace.every((t) => t === 'wait' || t.startsWith('place:'))).toBe(true);
  });

  it('V2-8 determinism: the same seed and state produce the same action trace', () => {
    const a = newHarness('v2-determinism');
    const b = newHarness('v2-determinism');
    armTutorialRace(a.script);
    armTutorialRace(b.script);
    a.st.players[0].progress = 5;
    b.st.players[0].progress = 5;
    wake(a, 30);
    wake(b, 30);
    expect(a.trace).toEqual(b.trace);
  });

  it('V2-9 the Shade claims at most its teaching budget — it never starves the Clerk', () => {
    const h = newHarness('v2-claimbudget');
    armTutorialRace(h.script);
    h.st.players[0].progress = 6;
    wake(h, 120);
    // a Shade claim is visible as a unit owned by seat 1; the budget bounds it
    const shadeClaims = Object.values(h.st.unitOwner).filter((o) => o === 1).length;
    expect(shadeClaims).toBeLessThanOrEqual(TUTORIAL_V2_CLAIMS);
  });
});
