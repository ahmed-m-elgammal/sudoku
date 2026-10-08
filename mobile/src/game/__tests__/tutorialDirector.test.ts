// Pins the M2 phase machine (docs/TUTORIAL_OPTIMIZATION_PLAN.md §5.1–5.2, §6.1).
// The director's ONE law is monotony: the lesson never walks backwards. Each phase's
// gate, the t6 sub-gates, the skip-prologue entry and the step counter are pinned here.
import { describe, it, expect } from 'vitest';
import {
  advanceDirector, newTutorialDirector, phaseStep, t6SubStep, TUTORIAL_PHASES,
  type TutorialDirectorState,
} from '../tutorialDirector';

const dir = (skipPrologue = false): TutorialDirectorState => newTutorialDirector(skipPrologue);
const phase = (s: TutorialDirectorState) => s.phase;

describe('tutorialDirector · the forward-only lesson (M2 §5.1)', () => {
  it('DIR-1 a fresh save starts at the prologue; a graduated replay enters at t1', () => {
    expect(phase(dir(false))).toBe('t0');
    expect(phase(dir(true))).toBe('t1');
  });

  it('DIR-2 the whole happy path walks t0→t10 through one gate/event each', () => {
    const s = dir();
    advanceDirector(s, { kind: 'gate', gate: 'prologueDone' });
    expect(phase(s)).toBe('t1');
    advanceDirector(s, { kind: 'gate', gate: 'continue' });
    expect(phase(s)).toBe('t2');
    advanceDirector(s, { kind: 'gate', gate: 'tryIt' });
    expect(phase(s)).toBe('t3');
    advanceDirector(s, { kind: 'select', cell: 5 });
    expect(phase(s)).toBe('t4');
    advanceDirector(s, { kind: 'place', correct: true, claimed: false });
    expect(phase(s)).toBe('t5');
    advanceDirector(s, { kind: 'place', correct: false, claimed: false });
    expect(phase(s)).toBe('t6');
    advanceDirector(s, { kind: 'pencil', on: true });
    advanceDirector(s, { kind: 'notes', count: 1 });
    advanceDirector(s, { kind: 'notes', count: 2 });
    advanceDirector(s, { kind: 'notes', count: 1 }); // the erase — the t6 gate completes
    expect(phase(s)).toBe('t7');
    advanceDirector(s, { kind: 'place', correct: true, claimed: true });
    expect(phase(s)).toBe('t8');
    advanceDirector(s, { kind: 'ability', id: 'augur', ok: true });
    expect(phase(s)).toBe('t9');
    advanceDirector(s, { kind: 'duelEnd', winner: 0 });
    expect(phase(s)).toBe('t10');
  });

  it('DIR-3 monotony: stale events from earlier phases never pull the lesson back', () => {
    const s = dir();
    advanceDirector(s, { kind: 'gate', gate: 'prologueDone' });
    advanceDirector(s, { kind: 'gate', gate: 'continue' });
    advanceDirector(s, { kind: 'gate', gate: 'tryIt' });
    advanceDirector(s, { kind: 'select', cell: 5 });
    advanceDirector(s, { kind: 'place', correct: true, claimed: false }); // → t5
    // a re-run of every earlier gate: all ignored
    advanceDirector(s, { kind: 'gate', gate: 'prologueDone' });
    advanceDirector(s, { kind: 'gate', gate: 'continue' });
    advanceDirector(s, { kind: 'gate', gate: 'tryIt' });
    advanceDirector(s, { kind: 'select', cell: 9 });
    expect(phase(s)).toBe('t5');
    // and a t4-shaped correct placement (unclaimed) cannot jump t5's gate either
    advanceDirector(s, { kind: 'place', correct: true, claimed: false });
    expect(phase(s)).toBe('t6');
  });

  it('DIR-4 t5 cannot stall the lesson: a CORRECT deliberate placement also advances', () => {
    const s = dir(true);
    for (const e of [
      { kind: 'gate', gate: 'continue' },
      { kind: 'gate', gate: 'tryIt' },
      { kind: 'select', cell: 5 },
      { kind: 'place', correct: true, claimed: false },
    ] as const) {
      advanceDirector(s, e as never);
    }
    expect(phase(s)).toBe('t5');
    advanceDirector(s, { kind: 'place', correct: true, claimed: false });
    expect(phase(s)).toBe('t6');
  });

  it('DIR-5 t6 sub-gates: quill → two notes → one erase, and no early exit', () => {
    const s = dir(true);
    for (const e of [
      { kind: 'gate', gate: 'continue' },
      { kind: 'gate', gate: 'tryIt' },
      { kind: 'select', cell: 5 },
      { kind: 'place', correct: true, claimed: false },
      { kind: 'place', correct: false, claimed: false },
    ] as const) {
      advanceDirector(s, e as never);
    }
    expect(phase(s)).toBe('t6');
    expect(t6SubStep(s)).toBe('quill');
    // notes before the quill: nothing moves
    advanceDirector(s, { kind: 'notes', count: 2 });
    expect(t6SubStep(s)).toBe('quill');
    advanceDirector(s, { kind: 'pencil', on: true });
    expect(t6SubStep(s)).toBe('notes');
    advanceDirector(s, { kind: 'notes', count: 1 });
    expect(t6SubStep(s)).toBe('notes'); // peak < 2: keep penciling
    advanceDirector(s, { kind: 'notes', count: 2 });
    expect(t6SubStep(s)).toBe('erase'); // two notes are up — now strike one
    advanceDirector(s, { kind: 'notes', count: 3 });
    expect(t6SubStep(s)).toBe('erase'); // still nothing off the board
    advanceDirector(s, { kind: 'notes', count: 2 });
    expect(phase(s)).toBe('t7'); // a note came OFF — the gate opens
  });

  it('DIR-6 t8 requires the augur; a failed cast or another rite does not advance', () => {
    const s = dir(true);
    const walk = [
      { kind: 'gate', gate: 'continue' },
      { kind: 'gate', gate: 'tryIt' },
      { kind: 'select', cell: 5 },
      { kind: 'place', correct: true, claimed: false },
      { kind: 'place', correct: false, claimed: false },
      { kind: 'pencil', on: true },
      { kind: 'notes', count: 2 },
      { kind: 'notes', count: 1 },
      { kind: 'place', correct: true, claimed: true },
      { kind: 'place', correct: true, claimed: true },
    ] as const;
    for (const e of walk) advanceDirector(s, e as never);
    expect(phase(s)).toBe('t8');
    advanceDirector(s, { kind: 'ability', id: 'augur', ok: false });
    expect(phase(s)).toBe('t8');
    advanceDirector(s, { kind: 'ability', id: 'unseal', ok: true });
    expect(phase(s)).toBe('t8');
    advanceDirector(s, { kind: 'ability', id: 'augur', ok: true });
    expect(phase(s)).toBe('t9');
  });

  it('DIR-7 t9 only graduates on a WIN; a loss leaves the phase (G10 reroutes instead)', () => {
    const s = dir(true);
    const walk = [
      { kind: 'gate', gate: 'continue' },
      { kind: 'gate', gate: 'tryIt' },
      { kind: 'select', cell: 5 },
      { kind: 'place', correct: true, claimed: false },
      { kind: 'place', correct: false, claimed: false },
      { kind: 'pencil', on: true },
      { kind: 'notes', count: 2 },
      { kind: 'notes', count: 1 },
      { kind: 'place', correct: true, claimed: true },
      { kind: 'place', correct: true, claimed: true },
      { kind: 'ability', id: 'augur', ok: true },
    ] as const;
    for (const e of walk) advanceDirector(s, e as never);
    expect(phase(s)).toBe('t9');
    advanceDirector(s, { kind: 'duelEnd', winner: 1 });
    expect(phase(s)).toBe('t9');
    advanceDirector(s, { kind: 'duelEnd', winner: 0 });
    expect(phase(s)).toBe('t10');
  });

  it('DIR-8 the phase list is ordered and the step counter reads t1..t9 as 1..9', () => {
    expect(TUTORIAL_PHASES[0]).toBe('t0');
    expect(TUTORIAL_PHASES[TUTORIAL_PHASES.length - 1]).toBe('t10');
    expect(phaseStep('t0')).toBe(0);
    expect(phaseStep('t1')).toBe(1);
    expect(phaseStep('t9')).toBe(9);
    expect(phaseStep('t10')).toBe(0);
  });
});
