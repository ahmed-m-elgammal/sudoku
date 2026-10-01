// ASSIZE tutorial scripting (spec M0, TODO T3) — the Shade of Orsolo duels to lose,
// deterministically. Pure module: no DOM, no audio. LocalDuel drives it with a seeded Rng
// and applies the returned actions through the shared engine, so the lesson always plays
// out the same way for a given seed:
//   1. the Shade holds its hand until the Clerk places a first correct digit;
//   2. it then races slowly (4.2–6.8s a digit), slips once every third placement
//      (a plausible wrong digit — a cracked wax Seal), and takes exactly ONE teaching
//      claim so the Clerk feels a claim land on their own Tablet;
//   3. after CORRECT_CAP placements it falters: no more correct ink, only slips —
//      the Clerk's claims and the Shade's slips always break its Seals in time.
// The Shade never casts a rite and never completes the Tablet (a 9x9 needs ~45 ink;
// the cap is far below), so the tutorial cannot be lost to the race — only to the
// Clerk's own hand.
import { CELL_UNITS, UNIT_CELLS, type Digit, type PlayerId, type UnitId } from './config';
import { cellFlags, type DuelState } from './engine';
import type { ShadeAction } from './shade';
export interface TutorialScriptState {
  correctPlacements: number;   // correct digits the Shade has set
  slipsMade: number;           // scripted wrong digits (each costs the Shade a Seal)
  demoClaimsLeft: number;      // teaching claims the Shade may still take
  nextActAtClock: number;      // duel-clock ms of the Shade's next action
}

export const newTutorialScript = (): TutorialScriptState => ({
  correctPlacements: 0,
  slipsMade: 0,
  demoClaimsLeft: 1,
  nextActAtClock: 4200,
});

export const TUTORIAL_CORRECT_CAP = 22; // the Shade never fills the Tablet
const SLIP_EVERY = 3;                   // every Nth race placement is a scripted slip
const RACE_DELAY_MS: [number, number] = [4200, 6800];
const SLIP_DELAY_MS: [number, number] = [5200, 7000];
const FALTER_DELAY_MS: [number, number] = [7800, 9600];
const HOLD_WHILE_IDLE_MS = 700;         // re-check cadence while waiting on the Clerk

interface Rand {
  next(): number;
  int(n: number): number;
  pick<T>(arr: readonly T[]): T;
}

const between = (rand: Rand, [lo, hi]: [number, number]) =>
  Math.round(lo + rand.next() * (hi - lo));

// units the Shade would newly complete by setting its true digit in `cell`
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

export function tutorialAct(
  script: TutorialScriptState,
  st: DuelState,
  me: PlayerId,
  humanProgress: number,
  rand: Rand,
  nowRealMs: number,
): ShadeAction {
  if (st.phase !== 'live') return { kind: 'wait', untilMs: nowRealMs + 500 };

  // the lesson starts when the Clerk sets their first true digit
  if (humanProgress === 0) return { kind: 'wait', untilMs: nowRealMs + HOLD_WHILE_IDLE_MS };

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

  // a slip is owed after every SLIP_EVERY correct placements, and forever once faltering
  const faltering = script.correctPlacements >= TUTORIAL_CORRECT_CAP;
  const slipsOwed = Math.floor(script.correctPlacements / SLIP_EVERY) - script.slipsMade;
  if (faltering || slipsOwed > 0) {
    const cell = rand.pick(empties);
    const digit = plausibleWrongDigit(st, me, cell, rand);
    if (digit !== null) {
      script.slipsMade++;
      script.nextActAtClock = st.clockMs + between(rand, faltering ? FALTER_DELAY_MS : SLIP_DELAY_MS);
      return { kind: 'place', cell, digit };
    }
    // no plausible error available (nearly full units): wait politely and retry
    script.nextActAtClock = st.clockMs + 1600;
    return { kind: 'wait', untilMs: nowRealMs + 800 };
  }

  // race: pick the next true digit. Cells that would complete a NEW unit are only
  // touched while the teaching claim is owed — and exactly once (demoClaimsLeft).
  const safe: number[] = [];
  const demo: number[] = [];
  for (const c of empties) {
    const completes = wouldCompleteNewUnits(st, me, c);
    if (completes.length === 0) safe.push(c);
    else if (script.demoClaimsLeft > 0) demo.push(c);
  }
  const pool = demo.length > 0 && script.correctPlacements >= 1 ? demo : safe;
  if (!pool.length) {
    script.nextActAtClock = st.clockMs + 1500;
    return { kind: 'wait', untilMs: nowRealMs + 800 };
  }
  const cell = rand.pick(pool);
  const raw = st.solution ? st.solution[cell] : 0;
  const digit = raw >= 1 && raw <= 9 ? (raw as Digit) : null;
  if (digit === null) {
    script.nextActAtClock = st.clockMs + 1500;
    return { kind: 'wait', untilMs: nowRealMs + 800 };
  }
  if (wouldCompleteNewUnits(st, me, cell).length > 0) script.demoClaimsLeft--;
  script.correctPlacements++;
  script.nextActAtClock = st.clockMs + between(rand, RACE_DELAY_MS);
  return { kind: 'place', cell, digit };
}
