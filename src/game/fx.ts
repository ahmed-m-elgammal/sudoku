// fx.ts — J1/J2 presentation juice, pure core (TODO J1/J2).
// shared/ stays untouched: everything here READS public engine events and never
// mutates them — event streams, the recorder and every replay stay byte-identical.
// No DOM, no React: this module is the tested law; screens only apply it.
import type { DuelEvent } from '@shared/engine';
import { UNIT_CELLS, ROW_OF, COL_OF, BOX_OF } from '@shared/config';

// ------------------------------------------------------------------ J1 — ink flood
export const FLOOD_CELL_MS = 30;   // cascade step per cell
export const FLOOD_ANIM_MS = 460;  // one cell's flood animation
export const FLOOD_CLEAR_MS = 950; // fx window: 9 cells staggered + anim + margin

export interface Flood { unit: string; player: 0 | 1; seq: number }

const UNIT_RE = /^(r|c|b)[0-8]$/;

const isUnitId = (u: unknown): u is keyof typeof UNIT_CELLS =>
  typeof u === 'string' && UNIT_RE.test(u) && Array.isArray(UNIT_CELLS[u as keyof typeof UNIT_CELLS]);

// The latest RESOLVED claim becomes a flood. Deferred (quarantine-held) claims
// resolve when the wax breaks and flood THEN — deferred events flood nothing.
// Fail-closed: a hostile or malformed event never floods, never throws.
export function floodFromEvent(e: DuelEvent | null | undefined): Flood | null {
  if (!e || typeof e !== 'object') return null;
  if (e.kind !== 'claim' || e.deferred) return null;
  if (!isUnitId(e.unit)) return null;
  if (e.player !== 0 && e.player !== 1) return null;
  if (!Number.isInteger(e.seq)) return null;
  return { unit: e.unit, player: e.player, seq: e.seq };
}

// The cascade order IS the unit's natural cell order (row left→right, column
// top→bottom, box row-major). Null for anything that is not a real unit.
export function cellsOfFlood(unit: unknown): number[] | null {
  return isUnitId(unit) ? [...UNIT_CELLS[unit as keyof typeof UNIT_CELLS]] : null;
}

// Splash anchor as a fraction (0..1) of the 9x9 CELL area — not of boardWrap,
// whose right/bottom 20px belong to the claim gutters. Null for invalid units.
export function centroidOfUnit(unit: unknown): { cx: number; cy: number } | null {
  if (!isUnitId(unit)) return null;
  const u = unit as keyof typeof UNIT_CELLS;
  const n = Number(u.slice(1));
  const mid = (i: number) => (i + 0.5) / 9;
  if (u[0] === 'r') return { cx: 0.5, cy: mid(n) };
  if (u[0] === 'c') return { cx: mid(n), cy: 0.5 };
  const br = Math.floor(n / 3), bc = n % 3;
  return { cx: mid(bc * 3 + 1), cy: mid(br * 3 + 1) };
}

// Permanent territory tint for ONE cell. A cell can sit in up to three owned
// units; the precedence box > row > col follows the board's own reading order
// (box stamps are the loudest ownership mark). Undefined = unclaimed ink.
export function ownerOfCell(
  cell: number,
  unitOwner: Record<string, number>,
): 0 | 1 | undefined {
  if (!Number.isInteger(cell) || cell < 0 || cell > 80) return undefined;
  const own = (u: string) => unitOwner[u];
  const box = own(`b${BOX_OF(cell)}`);
  if (box === 0 || box === 1) return box;
  const row = own(`r${ROW_OF(cell)}`);
  if (row === 0 || row === 1) return row;
  const col = own(`c${COL_OF(cell)}`);
  if (col === 0 || col === 1) return col;
  return undefined;
}

// ------------------------------------------------------------------ J2 — tiered shake
export const SHAKE_MS = { 2: 480, 3: 700 } as const;
export type ShakeTier = keyof typeof SHAKE_MS;
export interface Shake { tier: ShakeTier; nonce: number }

// The trigger law. T1 stays the per-cell brushShake on wrong ink — not an event.
// T2: any RESOLVED claim (yours or the foe's — both seats feel the wax).
// T3: the "He adapts." orderSwap, the duel-ending `end`, boss phase entry (which
// arrives through LocalDuelOpts.onPhase, not the event stream — see localDuel).
export function tierForEvent(e: DuelEvent | null | undefined): 0 | ShakeTier {
  if (!e || typeof e !== 'object' || typeof e.kind !== 'string') return 0;
  if (e.kind === 'claim') return e.deferred ? 0 : 2;
  if (e.kind === 'orderSwap' || e.kind === 'end') return 3;
  return 0;
}

// ------------------------------------------------------------------ J3 — hit-stop + verdict slow-mo
export const HIT_STOP_MS = 100; // input freeze + world dim + unit push, per seal-crossing claim
export const SLOW_INK_MS = 300; // the duel-ending beat before the verdict banner
export const FLOOD_SLOW = 2.5;  // the final claim's cascade stretch while the verdict waits

export interface HitStop { unit: string; player: 0 | 1; nonce: number }

// A seal-crossing claim: every RESOLVED claim breaks at least one Seal (damage 1,
// Clean 2) — that is the hit. The acceptance law is the flood's law PLUS damage > 0,
// so a hit-stop can never fire without its flood (the push rides the flood's cells)
// and the two can never diverge. Deferred claims hit nothing (their wax breaks
// later, and the resolution event stops the world THEN); a claim without a real
// positive damage stops nothing; hostile events never throw.
export function hitStopFromEvent(e: DuelEvent | null | undefined): { unit: string; player: 0 | 1 } | null {
  if (!e || typeof e !== 'object') return null;
  if (e.kind !== 'claim' || e.deferred) return null;
  if (!isUnitId(e.unit)) return null;
  if (e.player !== 0 && e.player !== 1) return null;
  if (!Number.isInteger(e.seq)) return null;
  const d = (e as { damage?: unknown }).damage;
  if (typeof d !== 'number' || !Number.isFinite(d) || d <= 0) return null;
  return { unit: e.unit, player: e.player };
}

// ------------------------------------------------------------------ J4 — heat escalation
export const HEAT_GAP_STEP = 0.15;   // heat per Seal of |gap| between the duelists
export const HEAT_GAP_CAP = 5;       // Seals of gap that can contribute
export const HEAT_RUN_STEP = 0.0625; // heat per claim of the longest current run
export const HEAT_RUN_CAP = 4;       // claims of run that can contribute
export const COLD_GAP = 3;           // behind by this many Seals, the viewer's ink desaturates

export interface Heat { heat: number; cold: boolean }

const sealOf = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.min(v, 99) : null;

const runOf = (v: unknown): number =>
  typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;

// PUBLIC state only: the two Seals counts and the two current claim runs. No clocks,
// no randomness, no perspective except the seat-0 viewer — the same public inputs
// always produce the same heat, so replay/PvP parity is by construction. Fail-closed:
// hostile seals yield heat 0 and never throw.
export function heatFromState(seals: [unknown, unknown], runs: [unknown, unknown]): Heat {
  const mine = sealOf(seals[0]);
  const foe = sealOf(seals[1]);
  if (mine === null || foe === null) return { heat: 0, cold: false };
  const gap = Math.min(Math.abs(mine - foe), HEAT_GAP_CAP);
  const run = Math.min(Math.max(runOf(runs[0]), runOf(runs[1])), HEAT_RUN_CAP);
  return {
    heat: Math.min(1, gap * HEAT_GAP_STEP + run * HEAT_RUN_STEP),
    cold: foe - mine >= COLD_GAP, // the viewer is seat 0: behind by ≥ 3 Seals goes cold
  };
}

// The claim-run law: a seat's run extends while IT keeps claiming; ANY other seat's
// claim resets it to zero and starts their own at 1. Only flood-validated claims
// reach here, but a hostile prev never poisons the next run.
export function advanceRuns(
  prev: [number, number], lastClaimer: number, player: 0 | 1,
): { runs: [number, number]; lastClaimer: number } {
  const cur = runOf(prev[player]);
  const next = player === lastClaimer ? cur + 1 : 1;
  return { runs: player === 0 ? [next, 0] : [0, next], lastClaimer: player };
}

// ------------------------------------------------------------------ self-cleaning cues
// One generic timed cue: set() restarts the expiry window (a later, bigger shake
// always wins), the timer is the ONLY cleaner, dispose() cancels everything.
// This is what makes "no stuck shake after 1000 events" a law, not a hope.
export class Cue<T> {
  value: T | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  constructor(
    private msFor: (v: T) => number,
    private onChange: (v: T | null) => void,
  ) {}
  set(v: T): void {
    this.clearTimer();
    this.value = v;
    this.onChange(v);
    this.timer = setTimeout(() => {
      this.timer = null;
      this.value = null;
      this.onChange(null);
    }, this.msFor(v));
  }
  dispose(): void {
    this.clearTimer();
    this.value = null;
  }
  private clearTimer(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
