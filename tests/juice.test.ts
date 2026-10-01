// juice.test.ts — J1/J2 presentation-fx law (src/game/fx.ts).
// The fx core is pure and shared/-untouched: these tests pin the trigger law,
// the fail-closed validation, the self-cleaning cues, and the no-stuck-state
// fuzz contract promised in the TODO.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  floodFromEvent, cellsOfFlood, centroidOfUnit, ownerOfCell,
  tierForEvent, Cue, SHAKE_MS, FLOOD_CELL_MS, FLOOD_ANIM_MS, FLOOD_CLEAR_MS,
  type Flood,
} from '@/game/fx';
import { UNIT_CELLS } from '@shared/config';
import type { DuelEvent } from '@shared/engine';

const ev = (over: Record<string, unknown>): DuelEvent =>
  ({ seq: 7, atMs: 1234, kind: 'claim', player: 0, unit: 'r3', ...over }) as unknown as DuelEvent;

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('J1 — floodFromEvent (fail-closed claim → flood)', () => {
  it('maps a resolved claim to its flood', () => {
    expect(floodFromEvent(ev({ player: 1, unit: 'b4', seq: 42 }))).toEqual({ unit: 'b4', player: 1, seq: 42 });
  });
  it('ignores deferred (quarantine-held) claims — they flood when they resolve', () => {
    expect(floodFromEvent(ev({ deferred: true }))).toBeNull();
  });
  it('rejects every non-claim kind', () => {
    for (const kind of ['placed', 'mistake', 'ink', 'ability', 'status', 'statusEnded', 'negated', 'mirrored', 'forfeit', 'end', 'orderSwap']) {
      expect(floodFromEvent(ev({ kind }))).toBeNull();
    }
  });
  it('rejects a 16-case hostile unit matrix without throwing', () => {
    for (const unit of ['r9', 'c9', 'b9', 'R0', 'r 0', 'x3', '', 'rr3', 'r03', 42, null, undefined, {}, ['r3'], NaN, 'r3;drop table duels']) {
      expect(floodFromEvent(ev({ unit })), `unit=${String(unit)}`).toBeNull();
    }
  });
  it('rejects non-seat players (2, -1, "0", undefined, NaN)', () => {
    for (const player of [2, -1, '0', undefined, NaN, null]) {
      expect(floodFromEvent(ev({ player }))).toBeNull();
    }
  });
  it('rejects non-integer seqs (the A/B retrigger nonce must be exact)', () => {
    for (const seq of [1.5, NaN, Infinity, '7', null, undefined]) {
      expect(floodFromEvent(ev({ seq }))).toBeNull();
    }
  });
  it('accepts all 27 real unit ids across both seats', () => {
    const ids = [...Array(9).keys()].flatMap((i) => [`r${i}`, `c${i}`, `b${i}`]);
    for (const unit of ids) for (const player of [0, 1] as const) {
      expect(floodFromEvent(ev({ unit, player }))).toEqual({ unit, player, seq: 7 });
    }
  });
  it('never mutates the event and never reuses its fields', () => {
    const e = ev({});
    const before = JSON.stringify(e);
    const f: Flood | null = floodFromEvent(e);
    expect(JSON.stringify(e)).toBe(before);
    expect(f).not.toBe(e);
  });
  it('survives total garbage input', () => {
    for (const junk of [null, undefined, 42, 'claim', [], {}, { kind: 'claim' }, { kind: 42 }]) {
      expect(floodFromEvent(junk as unknown as DuelEvent)).toBeNull();
    }
  });
});

describe('J1 — flood geometry helpers', () => {
  it('cellsOfFlood matches UNIT_CELLS for all 27 units, in cascade order', () => {
    for (let i = 0; i < 9; i++) for (const k of ['r', 'c', 'b'] as const) {
      expect(cellsOfFlood(`${k}${i}`)).toEqual(UNIT_CELLS[`${k}${i}` as keyof typeof UNIT_CELLS]);
    }
  });
  it('cellsOfFlood returns a copy — callers cannot poison UNIT_CELLS', () => {
    const cells = cellsOfFlood('r0')!;
    cells[0] = 999;
    expect(UNIT_CELLS.r0[0]).toBe(0);
  });
  it('cellsOfFlood rejects garbage', () => {
    for (const junk of ['r9', 'x0', 42, null, undefined, {}]) expect(cellsOfFlood(junk)).toBeNull();
  });
  it('centroidOfUnit pins rows, columns and boxes', () => {
    const mid = (i: number) => (i + 0.5) / 9;
    expect(centroidOfUnit('r3')).toEqual({ cx: 0.5, cy: mid(3) });
    expect(centroidOfUnit('c4')).toEqual({ cx: mid(4), cy: 0.5 });
    expect(centroidOfUnit('b4')).toEqual({ cx: 0.5, cy: 0.5 });
    expect(centroidOfUnit('b0')).toEqual({ cx: mid(1), cy: mid(1) });
    expect(centroidOfUnit('b8')).toEqual({ cx: mid(7), cy: mid(7) });
  });
  it('centroidOfUnit rejects garbage', () => {
    for (const junk of ['r9', 'bb2', 7, null]) expect(centroidOfUnit(junk)).toBeNull();
  });
  it('ownerOfCell precedence is box > row > col', () => {
    const uo: Record<string, number> = { b4: 1, r4: 0, c4: 1 };
    expect(ownerOfCell(40, uo)).toBe(1); // cell 40 sits in b4, r4, c4 — box wins
    const uo2: Record<string, number> = { r4: 0, c4: 1 };
    expect(ownerOfCell(40, uo2)).toBe(0); // row beats col
    const uo3: Record<string, number> = { c4: 1 };
    expect(ownerOfCell(40, uo3)).toBe(1);
  });
  it('ownerOfCell returns undefined for unclaimed cells and hostile input', () => {
    expect(ownerOfCell(40, {})).toBeUndefined();
    expect(ownerOfCell(40, { r4: 2, c4: 'x', b4: null } as unknown as Record<string, number>)).toBeUndefined();
    for (const cell of [-1, 81, 1.5, NaN, Infinity]) expect(ownerOfCell(cell as number, { b0: 0 })).toBeUndefined();
  });
});

describe('J2 — tierForEvent (the trigger law)', () => {
  it('T2 on any resolved claim, either seat', () => {
    expect(tierForEvent(ev({ player: 0 }))).toBe(2);
    expect(tierForEvent(ev({ player: 1 }))).toBe(2);
  });
  it('deferred claims shake nothing', () => {
    expect(tierForEvent(ev({ deferred: true }))).toBe(0);
  });
  it('T3 on orderSwap and on the duel-ending end event', () => {
    expect(tierForEvent(ev({ kind: 'orderSwap' }))).toBe(3);
    expect(tierForEvent(ev({ kind: 'end', winner: 0, reason: 'seals' }))).toBe(3);
  });
  it('everything else shakes nothing', () => {
    for (const kind of ['placed', 'mistake', 'ink', 'ability', 'status', 'statusEnded', 'negated', 'mirrored', 'forfeit']) {
      expect(tierForEvent(ev({ kind }))).toBe(0);
    }
  });
  it('survives hostile junk without throwing', () => {
    for (const junk of [null, undefined, 0, 'end', {}, { kind: 42 }, { kind: 'claim', deferred: 'yes' }]) {
      expect([0, 2, 3]).toContain(tierForEvent(junk as unknown as DuelEvent));
    }
  });
  it('a truthy garbage deferred flag fails closed — it shakes nothing', () => {
    expect(tierForEvent({ kind: 'claim', deferred: 'yes' } as unknown as DuelEvent)).toBe(0);
    expect(floodFromEvent({ kind: 'claim', deferred: 'yes', player: 0, unit: 'r3', seq: 1 } as unknown as DuelEvent)).toBeNull();
  });
});

describe('J2 — Cue (the self-cleaning state machine)', () => {
  it('fires synchronously and clears exactly at its window', () => {
    const seen: Array<string | null> = [];
    const cue = new Cue<string>(() => 480, (v) => seen.push(v));
    cue.set('a');
    expect(seen).toEqual(['a']);
    vi.advanceTimersByTime(479);
    expect(cue.value).toBe('a');
    vi.advanceTimersByTime(1);
    expect(seen).toEqual(['a', null]);
    expect(cue.value).toBeNull();
  });
  it('a later set replaces the value AND the window (upgrade law)', () => {
    const seen: Array<string | null> = [];
    const cue = new Cue<string>((v) => (v === 'big' ? 700 : 480), (v) => seen.push(v));
    cue.set('small');
    vi.advanceTimersByTime(300);
    cue.set('big'); // replaces mid-flight
    expect(cue.value).toBe('big');
    vi.advanceTimersByTime(480); // the OLD window would have expired here
    expect(cue.value).toBe('big'); // …but the new window holds
    expect(seen).toEqual(['small', 'big']);
    vi.advanceTimersByTime(220);
    expect(seen).toEqual(['small', 'big', null]);
  });
  it('dispose cancels a pending expiry and clears now', () => {
    const seen: Array<string | null> = [];
    const cue = new Cue<string>(() => 480, (v) => seen.push(v));
    cue.set('a');
    cue.dispose();
    expect(cue.value).toBeNull();
    vi.advanceTimersByTime(2000);
    expect(seen).toEqual(['a']); // no late null — dispose cleaned the timer
  });
  it('FUZZ: 1000 rapid shakes never stick — exactly one expiry, last wins', () => {
    const seen: Array<number | null> = [];
    const cue = new Cue<number>((t) => (t === 3 ? 700 : 480), (v) => seen.push(v));
    for (let i = 0; i < 1000; i++) cue.set(i % 2 === 0 ? 2 : 3);
    expect(cue.value).not.toBeNull(); // still active under fire
    expect(seen).length(1000);        // every set announced exactly once — no double-fire mid-storm
    vi.advanceTimersByTime(700);
    expect(cue.value).toBeNull();
    expect(seen).length(1001);        // + EXACTLY ONE expiry null (one timer survived, none leaked)
    expect(seen[seen.length - 1]).toBeNull();
    vi.advanceTimersByTime(60_000);   // nothing else ever fires — no stuck state, no timer leak
    expect(seen).length(1001);
  });
});

describe('juice constants hold the contract together', () => {
  it('T3 outlasts T2', () => expect(SHAKE_MS[3]).toBeGreaterThan(SHAKE_MS[2]));
  it('the flood window covers the whole cascade + animation', () => {
    expect(FLOOD_CLEAR_MS).toBeGreaterThanOrEqual(9 * FLOOD_CELL_MS + FLOOD_ANIM_MS);
  });
});
