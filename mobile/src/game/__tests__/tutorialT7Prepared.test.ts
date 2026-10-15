// The prepared-unit pin (t7 deadlock class, P2.1 follow-up).
//
// T7's gate is a real claim, so T7's entry board must contain a real one-away
// unit — otherwise the glowing cell completes nothing and no obedient move can
// advance (silent deadlock; only Skip saved the player). The tutorial seed is
// selected for exactly this property, and this suite re-proves it on every run:
//
//   PREP-1  at natural t7 entry, no unit is owned (clean lesson beats) and at
//           least one unowned unit is one-away.
//   PREP-2  the spotlighted (latched) cell completes Row 5 — the unit the
//           banner names, so copy and board can never disagree.
//   PREP-3  filling the glowing cell with its true digit advances to t8.
//
// If this file goes red after a seed change, the seed is wrong — pick another
// prepared seed, do not relax the gate.
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { LocalDuel } from '@/game/localDuel';
import { CELL_UNITS, UNIT_CELLS, type Digit } from '@shared/config';

// The app's tutorial puzzle (mobile + web specFromUi). Change it here and in
// both specs together — never alone.
const APP_TUTORIAL_SEED = 'novem-lesson-21';

beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', () => 1);
  vi.stubGlobal('cancelAnimationFrame', () => {});
});
afterEach(() => { vi.unstubAllGlobals(); });

const solution = (d: LocalDuel, c: number): Digit => d.state.solution![c] as Digit;

function walkToT7(duel: LocalDuel) {
  duel.tutorialAdvance('prologueDone');
  duel.tutorialAdvance('continue');
  duel.tutorialAdvance('tryIt');
  const t3 = duel.tutorialTarget() as { kind: 'cell'; cell: number };
  duel.select(t3.cell);
  const t4 = duel.tutorialTarget() as { kind: 'digit'; digit: Digit };
  duel.place(duel.selected!, t4.digit);
  const t5 = duel.tutorialTarget() as { kind: 'cell'; cell: number };
  duel.place(t5.cell, ((solution(duel, t5.cell) % 9) + 1) as Digit);
  duel.togglePencil();
  const t6 = duel.tutorialTarget() as { kind: 'cell'; cell: number };
  duel.toggleNote(t6.cell, 3);
  duel.toggleNote(t6.cell, 7);
  duel.setNotes(t6.cell, []);
}

function completableUnits(duel: LocalDuel, cell: number): string[] {
  const board = duel.state.players[0].board;
  if (board[cell] !== 0) return [];
  return CELL_UNITS(cell).filter(
    (u) =>
      duel.state.unitOwner[u] === undefined &&
      UNIT_CELLS[u].every((c) => (c === cell ? true : board[c] !== 0)),
  );
}

describe('t7 prepared unit (deadlock pin)', () => {
  it('PREP-1 clean beats and a real one-away unit at t7 entry', () => {
    const duel = new LocalDuel({
      mode: 'tutorial', seed: APP_TUTORIAL_SEED, tier: 'Easy',
      orders: ['scholar', 'executioner'], names: ['You', 'Shade of Orsolo'],
      tutorialScript: 'v2',
    });
    walkToT7(duel);
    expect(duel.tutorialPhase()).toBe('t7');
    expect(Object.keys(duel.state.unitOwner)).toEqual([]);
    const claimable: number[] = [];
    for (let c = 0; c < 81; c++) if (completableUnits(duel, c).length) claimable.push(c);
    expect(claimable.length, 't7 entry must hold a completable unit').toBeGreaterThan(0);
  });

  it('PREP-2 the glowing cell completes Row 5, the banner’s unit', () => {
    const duel = new LocalDuel({
      mode: 'tutorial', seed: APP_TUTORIAL_SEED, tier: 'Easy',
      orders: ['scholar', 'executioner'], names: ['You', 'Shade of Orsolo'],
      tutorialScript: 'v2',
    });
    walkToT7(duel);
    const target = duel.tutorialTarget() as { kind: 'cell'; cell: number };
    expect(completableUnits(duel, target.cell)).toContain('r4');
  });

  it('PREP-3 the obedient fill advances to t8', () => {
    const duel = new LocalDuel({
      mode: 'tutorial', seed: APP_TUTORIAL_SEED, tier: 'Easy',
      orders: ['scholar', 'executioner'], names: ['You', 'Shade of Orsolo'],
      tutorialScript: 'v2',
    });
    walkToT7(duel);
    const target = duel.tutorialTarget() as { kind: 'cell'; cell: number };
    duel.select(target.cell);
    duel.place(target.cell, solution(duel, target.cell));
    expect(duel.tutorialPhase()).toBe('t8');
  });
});
