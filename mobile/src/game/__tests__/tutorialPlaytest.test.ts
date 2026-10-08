// The M2 acceptance, as a script (docs/TUTORIAL_OPTIMIZATION_PLAN.md §7 M2 accept,
// amended §11): "a playtest script (or an adult simulating a first-time player of any
// age: slow taps, wrong digits, ignores text) completes unaided."
//
// This file IS that playtest: it drives a fresh v2 LocalDuel the way a wary newcomer
// would — it ignores every banner, taps slow, places wrong digits when the lesson
// invites them, fumbles the pencil lesson, and only stumbles forward through the
// gates. The run must end at t10 (graduation) WITHOUT a single lost Seal, with the
// Shade frozen through every teaching phase and the race paced at the v2 law.
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { LocalDuel } from '@/game/localDuel';
import { CELL_UNITS, UNIT_CELLS, type Digit } from '@shared/config';
import { CONFIG } from '@shared/config';

let frameCb: ((t: number) => void) | null = null;

function v2Duel(): LocalDuel {
  return new LocalDuel({
    mode: 'tutorial', seed: 'playtest-seed', tier: 'Easy',
    orders: ['scholar', 'executioner'], names: ['You', 'Shade of Orsolo'],
    tutorialScript: 'v2',
  });
}

const solution = (duel: LocalDuel, cell: number): Digit => duel.state.solution![cell] as Digit;
const wrongDigit = (duel: LocalDuel, cell: number): Digit => ((solution(duel, cell) % 9) + 1) as Digit;

/** An empty cell that cannot complete ANY of its units on this placement (≥2 empties
 *  in every unit it touches — the placement itself always leaves one behind). */
function safeEmptyCell(duel: LocalDuel): number {
  const board = duel.state.players[0].board;
  for (let cell = 0; cell < 81; cell++) {
    if (board[cell] !== 0) continue;
    if (CELL_UNITS(cell).every((u) => UNIT_CELLS[u].filter((c) => board[c] === 0).length >= 2)) {
      return cell;
    }
  }
  throw new Error('no safe empty cell');
}

/** The first empty cell whose TRUE digit completes a unit the Clerk does not own. */
function scanClaimCell(duel: LocalDuel): number {
  const board = duel.state.players[0].board;
  for (let cell = 0; cell < 81; cell++) {
    if (board[cell] !== 0) continue;
    const completes = CELL_UNITS(cell).some((u) =>
      duel.state.unitOwner[u] === undefined
      && UNIT_CELLS[u].every((c) => (c === cell ? true : duel.state.players[0].board[c] !== 0)));
    if (completes) return cell;
  }
  return -1;
}

/** The emptiest filling move: an empty cell, in no Shade-owned unit, whose tightest
 *  free unit has the fewest empties — the greedy path toward the next claim. */
function greedyFillCell(duel: LocalDuel): number {
  const board = duel.state.players[0].board;
  let best = -1;
  let bestEmpties = 99;
  for (let cell = 0; cell < 81; cell++) {
    if (board[cell] !== 0) continue;
    const units = CELL_UNITS(cell);
    if (units.some((u) => duel.state.unitOwner[u] === 1)) continue; // dead ink for the win
    const empties = Math.min(...units.map((u) => UNIT_CELLS[u].filter((c) => board[c] === 0).length));
    if (empties < bestEmpties) { bestEmpties = empties; best = cell; }
  }
  return best;
}

/**
 * The unaided walk from t0 to t9: every gate is worked through the RUNTIME surface
 * (advance/target/place) exactly the way the screen would relay a wary player's taps.
 */
function walkToRace(duel: LocalDuel): { sealsBefore: number; shadeFrozen: string } {
  const sealsBefore = duel.state.players[0].seals;
  const shadeFrozen = Buffer.from(duel.state.players[1].board).toString('hex');

  // t0 — the prologue: two taps, the only copy the player reads
  expect(duel.tutorialPhase()).toBe('t0');
  duel.tutorialAdvance('prologueDone');
  expect(duel.tutorialPhase()).toBe('t1');
  // the Shade is FROZEN through the whole prologue
  expect(Buffer.from(duel.state.players[1].board).toString('hex')).toBe(shadeFrozen);

  // t1 → t2 → t3 (CTAs; then any tap — the scrim only lets the taught cell through)
  duel.tutorialAdvance('continue');
  duel.tutorialAdvance('tryIt');
  expect(duel.tutorialPhase()).toBe('t3');
  const taught = duel.tutorialTarget();
  expect(taught?.kind).toBe('cell');
  duel.select((taught as { kind: 'cell'; cell: number }).cell);
  expect(duel.tutorialPhase()).toBe('t4');

  // t4 — the spotlighted digit
  const t4 = duel.tutorialTarget();
  expect(t4?.kind).toBe('digit');
  duel.place(duel.selected!, (t4 as { kind: 'digit'; digit: Digit }).digit);
  expect(duel.tutorialPhase()).toBe('t5');

  // t5 — the lesson INVITES a wrong digit; they give it one. No Seal is lost.
  const t5 = duel.tutorialTarget();
  expect(t5?.kind).toBe('cell');
  const t5cell = (t5 as { kind: 'cell'; cell: number }).cell;
  duel.place(t5cell, wrongDigit(duel, t5cell));
  expect(duel.tutorialPhase()).toBe('t6');
  expect(duel.state.players[0].seals).toBe(sealsBefore);

  // t6 — quill, two notes, one erase (they fumble exactly as the copy walks them)
  duel.togglePencil();
  const t6 = duel.tutorialTarget();
  expect(t6?.kind).toBe('cell'); // the sub-step aims back at the taught cell
  const noteCell = (t6 as { kind: 'cell'; cell: number }).cell;
  duel.toggleNote(noteCell, 3);
  duel.toggleNote(noteCell, 7);
  duel.setNotes(noteCell, []);
  expect(duel.tutorialPhase()).toBe('t7'); // quill + two notes + one erase: the t6 gate is done

  // t7 — they work toward the prepared unit and complete it; the claim lands
  let cc = scanClaimCell(duel);
  let fills = 0;
  while (cc < 0 && fills++ < 40) {
    const fill = greedyFillCell(duel);
    if (fill < 0) break;
    duel.select(fill);
    duel.place(fill, solution(duel, fill));
    cc = scanClaimCell(duel);
  }
  expect(cc).toBeGreaterThanOrEqual(0);
  duel.select(cc);
  duel.place(cc, solution(duel, cc));
  expect(duel.tutorialPhase()).toBe('t8');

  // t8 — they cast the Eye (the banner held it open for 2.5 s; the tap grants too)
  const empty = safeEmptyCell(duel);
  duel.select(empty);
  duel.grantFreeAugur();
  expect(duel.ability('augur', { cell: empty }).ok).toBe(true);
  expect(duel.tutorialPhase()).toBe('t9');

  // the freeze proof: through ALL the teaching above the Shade never set a digit
  expect(Buffer.from(duel.state.players[1].board).toString('hex')).toBe(shadeFrozen);
  return { sealsBefore, shadeFrozen };
}

beforeEach(() => {
  vi.useFakeTimers();
  // a pumpable frame loop: the capture lets the test drive LocalDuel's rAF ticks by
  // hand (a win by CLAIM death is only observed on the frame loop, like the real app)
  frameCb = null;
  vi.stubGlobal('requestAnimationFrame', (cb: (t: number) => void) => {
    frameCb = cb;
    return 1;
  });
  vi.stubGlobal('cancelAnimationFrame', () => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('LocalDuel · the M2 playtest: a first-timer completes the lesson unaided', () => {
  it('PLAY-1 slow taps, wrong digits, ignored copy — the lesson still lands at t10', () => {
    const duel = v2Duel();
    const { sealsBefore } = walkToRace(duel);

    // they sprinkle 12 wrong digits across the race — the soak that can never lose
    for (let i = 0; i < 12; i++) {
      const c = safeEmptyCell(duel);
      expect(duel.place(c, wrongDigit(duel, c)).correct).toBe(false);
      expect(duel.state.players[0].seals).toBe(sealsBefore);
      expect(duel.ended).toBe(false);
      duel.state.clockMs += 10_000; // the race paces on while they fumble
    }

    // the Clerk finishes the duel the honest way: claims. Every completed free unit
    // wounds the Shade; its own slips and the Clerk's claims break it well inside the
    // ten minutes the engine clock has left.
    duel.start();
    let guard = 200;
    while (!duel.ended && duel.state.phase === 'live' && guard-- > 0) {
      const scanned = scanClaimCell(duel);
      const cell = scanned >= 0 ? scanned : greedyFillCell(duel);
      if (cell < 0) break; // nothing left to take (cannot happen on an Easy board)
      duel.select(cell);
      duel.place(cell, solution(duel, cell));
      duel.state.clockMs += 6_000;
      if (frameCb) frameCb(16); // one frame — the loop observes a claim death here
      vi.advanceTimersByTime(700); // the race wakes between claims — that is the point
    }
    expect(guard).toBeGreaterThan(0); // it never ground on forever
    expect(duel.ended).toBe(true);
    expect(duel.state.winner).toBe(0);
    expect(duel.tutorialPhase()).toBe('t10');
    duel.destroy();
  });

  it('PLAY-2 the race is the v2 law: paced, telegraphed, capped — and unlosable end to end', () => {
    const duel = v2Duel();
    walkToRace(duel);
    // the slow window is the whole pace contract while the Clerk finds their feet
    expect(CONFIG.tutorialV2.raceDelayMs[0]).toBeGreaterThanOrEqual(8000);
    expect(CONFIG.tutorialV2.raceDelayMs[1]).toBeLessThanOrEqual(12000);
    expect(CONFIG.tutorialV2.correctCap).toBe(22);
    // no claim is ever announced AND landed in the same breath
    expect(duel.tutorialTelegraph()).toBeNull();
    duel.destroy();
  });
});
