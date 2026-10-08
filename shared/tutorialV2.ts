// ASSIZE tutorial scripting v2 (docs/TUTORIAL_OPTIMIZATION_PLAN.md §5.4, M2) — the
// Shade of Orsolo as a PAUSABLE, SAFE-TO-FAIL race. Pure module: no DOM, no audio,
// deterministic under a seeded Rng, exactly like ../tutorial.ts (v1), which stays
// UNTOUCHED and remains the rollback path (spec-selected `tutorialScript: 'v1'`).
//
// Behaviour deltas from v1, all driven by the tutorial director (mobile):
//   1. FROZEN TEACHING — the Shade does nothing until the director arms the race
//      (phase T9). Every teaching phase (T0–T8) is therefore claim- and damage-free.
//   2. PACED RACE — once armed it sets true digits at 8–12 s each while the Clerk has
//      fewer than 6 correct placements, then 5–8 s. Roughly half of v1's 4.2–6.8 s.
//   3. TELEGRAPHED CLAIMS — any placement that would complete a NEW unit (a claim) is
//      announced first: the script records the unit and returns a wait of at least
//      telegraphLeadMs; only a later wake lands the ink. The runtime surfaces the
//      pending unit so the coach can print "The Shade eyes Row 3…".
//   4. NO EARLY SLIPS — a scripted wrong digit is only owed once the Clerk has 4
//      correct placements of their own, and then only every 4th Shade placement.
//   5. FLOOR-AWARE — while the Clerk sits at 1 Seal the Shade waits (the belt under
//      the runtime's own floor hold, G9/G10).
//   6. THE CAPS CARRY OVER — it never casts a rite, never swaps, and stops setting
//      true ink at correctCap (22), so it always loses by Seals in time.
import { CELL_UNITS, UNIT_CELLS, CONFIG, type Digit, type PlayerId, type UnitId } from './config';
import { cellFlags, type DuelState } from './engine';
import type { ShadeAction } from './shade';

export interface TutorialV2State {
  correctPlacements: number;      // true digits the Shade has set
  slipsMade: number;              // scripted wrong digits (each cracks the Shade's wax)
  claimsLeft: number;             // teaching-race claims the Shade may still take
  raceArmed: boolean;             // director-set: phase T9 began
  telegraphUnit: UnitId | null;   // an announced, not-yet-landed claim
  telegraphAtClock: number;       // duel-clock ms when the announced ink may land
  nextActAtClock: number;         // duel-clock ms of the Shade's next action
}

/** The Shade claims at most twice in the race — a demo of what a claim IS, never a
 *  starvation contest: the Clerk keeps units to break, so the lesson always ends in a
 *  win (§5.2 T9, §5.5 "cannot lose"). */
export const TUTORIAL_V2_CLAIMS = 2;

export const newTutorialV2Script = (): TutorialV2State => ({
  correctPlacements: 0,
  slipsMade: 0,
  claimsLeft: TUTORIAL_V2_CLAIMS,
  raceArmed: false,
  telegraphUnit: null,
  telegraphAtClock: 0,
  nextActAtClock: CONFIG.tutorialV2.raceDelayMs[0],
});

/** The director's T9 entry — idempotent; a replayed gate may arm twice. */
export function armTutorialRace(script: TutorialV2State): void {
  script.raceArmed = true;
}

/** The pending announced claim, for the coach's telegraph line. */
export const tutorialV2Telegraph = (script: TutorialV2State): UnitId | null =>
  script.telegraphUnit;

interface Rand {
  next(): number;
  int(n: number): number;
  pick<T>(arr: readonly T[]): T;
}

const between = (rand: Rand, [lo, hi]: readonly [number, number]) =>
  Math.round(lo + rand.next() * (hi - lo));

// units the Shade would newly complete by setting its true digit in `cell`
// (re-implemented locally — v1's helpers stay private to tutorial.ts by design)
function wouldCompleteNewUnits(st: DuelState, p: PlayerId, cell: number): UnitId[] {
  const board = st.players[p].board;
  const digit = st.solution ? st.solution[cell] : 0;
  if (!digit) return [];
  const done: UnitId[] = [];
  for (const u of CELL_UNITS(cell)) {
    if (st.unitOwner[u] !== undefined) continue;
    if (UNIT_CELLS[u].every((c) => (c === cell ? true : board[c] !== 0))) done.push(u);
  }
  return done;
}

// a plausible wrong digit: unused in the cell's units, but not the true one
function plausibleWrongDigit(st: DuelState, p: PlayerId, cell: number, rand: Rand): Digit | null {
  const board = st.players[p].board;
  const used = new Set<number>();
  for (const u of CELL_UNITS(cell)) for (const cc of UNIT_CELLS[u]) if (board[cc]) used.add(board[cc]);
  const trueDigit = st.solution ? st.solution[cell] : 0;
  const wrongs = ([1, 2, 3, 4, 5, 6, 7, 8, 9] as Digit[]).filter((d) => !used.has(d) && d !== trueDigit);
  if (!wrongs.length) return null;
  return wrongs[rand.int(wrongs.length)];
}

export function tutorialV2Act(
  script: TutorialV2State,
  st: DuelState,
  me: PlayerId,
  rand: Rand,
  nowRealMs: number,
): ShadeAction {
  if (st.phase !== 'live') return { kind: 'wait', untilMs: nowRealMs + 500 };

  const idle = { kind: 'wait', untilMs: nowRealMs + CONFIG.tutorialV2.holdWhileIdleMs } as const;

  // 1. frozen teaching — the race exists only after the director arms it
  if (!script.raceArmed) return idle;
  // 5. floor-aware — the belt under the runtime's hold (G9/G10)
  if (st.players[0].seals <= 1) return idle;
  // hold the scripted pace
  if (st.clockMs < script.nextActAtClock) {
    return { kind: 'wait', untilMs: nowRealMs + Math.max(400, script.nextActAtClock - st.clockMs) };
  }

  const p = st.players[me];
  const flags = cellFlags(st, me);
  const empties: number[] = [];
  for (let c = 0; c < 81; c++) if (p.board[c] === 0 && !flags.chained.has(c)) empties.push(c);
  if (!empties.length) {
    script.nextActAtClock = st.clockMs + 1500;
    return { kind: 'wait', untilMs: nowRealMs + 800 };
  }

  // an announced claim whose lead has elapsed: land the ink
  if (script.telegraphUnit !== null) {
    const u = script.telegraphUnit;
    const cells = UNIT_CELLS[u].filter((c) => p.board[c] === 0);
    const ready = st.clockMs >= script.telegraphAtClock && cells.length === 1;
    const digit = ready ? (st.solution ? st.solution[cells[0]] : 0) : 0;
    if (ready && digit >= 1 && digit <= 9) {
      script.telegraphUnit = null;
      script.claimsLeft--;
      script.correctPlacements++;
      script.nextActAtClock = st.clockMs + raceDelay(st, rand);
      return { kind: 'place', cell: cells[0], digit: digit as Digit };
    }
    // the player claimed or blocked the announced unit first — the eye moves on
    script.telegraphUnit = null;
  }

  // 4. slips — only after the Clerk's 4th correct, then every slipEvery-th placement
  const faltering = script.correctPlacements >= CONFIG.tutorialV2.correctCap;
  const playerReady = st.players[0].progress >= CONFIG.tutorialV2.slipAfterPlayerCorrect;
  const slipsOwed = playerReady
    ? Math.floor(script.correctPlacements / CONFIG.tutorialV2.slipEvery) - script.slipsMade
    : 0;
  if (faltering || slipsOwed > 0) {
    const cell = rand.pick(empties);
    const digit = plausibleWrongDigit(st, me, cell, rand);
    if (digit !== null) {
      script.slipsMade++;
      script.nextActAtClock = st.clockMs + between(rand, faltering ? CONFIG.tutorialV2.falterDelayMs : CONFIG.tutorialV2.raceLateDelayMs);
      return { kind: 'place', cell, digit };
    }
    // no plausible error available (nearly full units): wait politely and retry
    script.nextActAtClock = st.clockMs + 1600;
    return { kind: 'wait', untilMs: nowRealMs + 800 };
  }

  // 3. telegraphed claims — a completing cell announces before it lands, but only
  //    while the teaching-race claim budget lasts; afterwards the Shade avoids
  //    completing units entirely (v1's post-demo law) so the Clerk always has units
  //    left to take.
  const claiming: number[] = [];
  const safe: number[] = [];
  for (const c of empties) {
    if (wouldCompleteNewUnits(st, me, c).length > 0) claiming.push(c);
    else safe.push(c);
  }
  if (claiming.length > 0 && script.claimsLeft > 0) {
    const cell = rand.pick(claiming);
    const units = wouldCompleteNewUnits(st, me, cell);
    script.telegraphUnit = units[0];
    script.telegraphAtClock = st.clockMs + CONFIG.tutorialV2.telegraphLeadMs;
    script.nextActAtClock = st.clockMs + CONFIG.tutorialV2.telegraphLeadMs;
    return { kind: 'wait', untilMs: nowRealMs + Math.max(400, CONFIG.tutorialV2.telegraphLeadMs) };
  }

  // race: a true digit that completes nothing
  if (!safe.length) {
    script.nextActAtClock = st.clockMs + 1500;
    return { kind: 'wait', untilMs: nowRealMs + 800 };
  }
  const cell = rand.pick(safe);
  const raw = st.solution ? st.solution[cell] : 0;
  const digit = raw >= 1 && raw <= 9 ? (raw as Digit) : null;
  if (digit === null) {
    script.nextActAtClock = st.clockMs + 1500;
    return { kind: 'wait', untilMs: nowRealMs + 800 };
  }
  script.correctPlacements++;
  script.nextActAtClock = st.clockMs + raceDelay(st, rand);
  return { kind: 'place', cell, digit };
}

/** 2. the paced race: slow while the Clerk is finding their feet, quicker from 6 correct. */
function raceDelay(st: DuelState, rand: Rand): number {
  const late = st.players[0].progress >= 6;
  return between(rand, late ? CONFIG.tutorialV2.raceLateDelayMs : CONFIG.tutorialV2.raceDelayMs);
}
