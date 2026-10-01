// juice.test.ts — J1–J4 presentation-fx law (src/game/fx.ts).
// The fx core is pure and shared/-untouched: these tests pin the trigger law,
// the fail-closed validation, the self-cleaning cues, and the no-stuck-state
// fuzz contract promised in the TODO.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  floodFromEvent, cellsOfFlood, centroidOfUnit, ownerOfCell,
  tierForEvent, hitStopFromEvent, heatFromState, advanceRuns, Cue,
  SHAKE_MS, FLOOD_CELL_MS, FLOOD_ANIM_MS, FLOOD_CLEAR_MS,
  HIT_STOP_MS, SLOW_INK_MS, FLOOD_SLOW,
  HEAT_GAP_STEP, HEAT_GAP_CAP, HEAT_RUN_STEP, HEAT_RUN_CAP, COLD_GAP,
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
  it('J3 — the beat layers: per-claim hold < verdict beat < flood window; slow ink is slower', () => {
    expect(HIT_STOP_MS).toBeLessThan(SLOW_INK_MS);       // the world releases before the verdict beat ends
    expect(SLOW_INK_MS).toBeLessThan(FLOOD_CLEAR_MS);    // the verdict never outlives the final cascade's classes
    expect(FLOOD_SLOW).toBeGreaterThan(1);               // slow ink is actually slower
  });
  it('J4 — full heat is exactly reachable, never exceeded by construction', () => {
    expect(HEAT_GAP_STEP * HEAT_GAP_CAP + HEAT_RUN_STEP * HEAT_RUN_CAP).toBeCloseTo(1);
  });
});

describe('J3 — hitStopFromEvent (the seal-crossing law)', () => {
  it('fires on resolved claims with real damage, both seats', () => {
    expect(hitStopFromEvent(ev({ player: 0, damage: 1 }))).toEqual({ unit: 'r3', player: 0 });
    expect(hitStopFromEvent(ev({ player: 1, unit: 'b4', damage: 2 }))).toEqual({ unit: 'b4', player: 1 });
  });
  it('a fractional positive damage still counts (T21 mods may bend the numbers)', () => {
    expect(hitStopFromEvent(ev({ damage: 0.5 }))).toEqual({ unit: 'r3', player: 0 });
  });
  it('ignores deferred claims — their wax breaks later, and the resolution event hits THEN', () => {
    expect(hitStopFromEvent(ev({ deferred: true, damage: 2 }))).toBeNull();
  });
  it('a claim without real positive damage stops nothing', () => {
    for (const damage of [0, -1, NaN, Infinity, -Infinity, '2', null, undefined, {}]) {
      expect(hitStopFromEvent(ev({ damage })), `damage=${String(damage)}`).toBeNull();
    }
  });
  it('rejects every non-claim kind', () => {
    for (const kind of ['placed', 'mistake', 'ink', 'ability', 'status', 'statusEnded', 'negated', 'mirrored', 'forfeit', 'end', 'orderSwap']) {
      expect(hitStopFromEvent(ev({ kind, damage: 1 }))).toBeNull();
    }
  });
  it('shares the flood acceptance law EXACTLY — the push can never fire without its flood', () => {
    // hostile matrix: units, players, seqs — the two laws must agree on every input
    const units = ['r9', 'c9', 'b9', 'R0', 'x3', '', 42, null, undefined, {}, ['r3'], NaN, 'r3;drop table duels', 'r3', 'b8', 'c0'];
    const players = [0, 1, 2, -1, '0', undefined, NaN, null];
    const seqs = [7, 1.5, NaN, Infinity, '7', null, undefined];
    for (const unit of units) for (const player of players) for (const seq of seqs) {
      const e = ev({ unit, player, seq, damage: 1 });
      const flood = floodFromEvent(e);
      const hit = hitStopFromEvent(e);
      expect(hit !== null, `unit=${String(unit)} player=${String(player)} seq=${String(seq)}`).toBe(flood !== null);
    }
    // and every real unit × seat × positive damage fires BOTH
    const ids = [...Array(9).keys()].flatMap((i) => [`r${i}`, `c${i}`, `b${i}`]);
    for (const unit of ids) for (const player of [0, 1] as const) {
      const e = ev({ unit, player, damage: 1 });
      expect(hitStopFromEvent(e)).not.toBeNull();
      expect(floodFromEvent(e)).not.toBeNull();
    }
  });
  it('never mutates the event and survives total garbage', () => {
    const e = ev({ damage: 2 });
    const before = JSON.stringify(e);
    hitStopFromEvent(e);
    expect(JSON.stringify(e)).toBe(before);
    for (const junk of [null, undefined, 42, 'claim', [], {}, { kind: 'claim' }]) {
      expect(hitStopFromEvent(junk as unknown as DuelEvent)).toBeNull();
    }
  });
  it('FUZZ: 1000 rapid claims drive flood + hit-stop + shake together — nothing sticks, no leaks', () => {
    const seenFlood: Array<Flood | null> = [];
    const seenHit: Array<unknown | null> = [];
    const seenShake: Array<unknown | null> = [];
    const floodCue = new Cue<Flood>(() => FLOOD_CLEAR_MS, (v) => seenFlood.push(v));
    const hitCue = new Cue<{ unit: string; player: 0 | 1; nonce: number }>(() => HIT_STOP_MS, (v) => seenHit.push(v));
    const shakeCue = new Cue<{ tier: 2 | 3; nonce: number }>((s) => SHAKE_MS[s.tier], (v) => seenShake.push(v));
    for (let i = 0; i < 1000; i++) {
      const e = ev({ seq: i, unit: `r${i % 9}`, player: (i % 2) as 0 | 1, damage: 1 });
      const f = floodFromEvent(e);
      if (f) floodCue.set(f);
      const h = hitStopFromEvent(e);
      if (h) hitCue.set({ ...h, nonce: i });
      const tier = tierForEvent(e);
      if (tier) shakeCue.set({ tier, nonce: i });
    }
    expect(seenFlood).length(1000);
    expect(seenHit).length(1000);
    expect(seenShake).length(1000);
    expect(floodCue.value).not.toBeNull();
    expect(hitCue.value).not.toBeNull();
    expect(shakeCue.value).not.toBeNull();
    vi.advanceTimersByTime(FLOOD_CLEAR_MS);
    expect(floodCue.value).toBeNull();
    expect(hitCue.value).toBeNull();
    expect(shakeCue.value).toBeNull();
    expect(seenFlood.filter((v) => v === null)).length(1); // exactly one expiry each — one timer survived, none leaked
    expect(seenHit.filter((v) => v === null)).length(1);
    expect(seenShake.filter((v) => v === null)).length(1);
    vi.advanceTimersByTime(60_000);
    expect(seenFlood).length(1001);
    expect(seenHit).length(1001);
    expect(seenShake).length(1001);
    floodCue.dispose(); hitCue.dispose(); shakeCue.dispose();
  });
});

describe('J4 — heatFromState (the public-state law)', () => {
  it('an even opening position is a calm room', () => {
    expect(heatFromState([7, 7], [0, 0])).toEqual({ heat: 0, cold: false });
  });
  it('heat rises monotonically with the seals gap (either direction) and caps at 5', () => {
    const calm = heatFromState([7, 7], [0, 0]).heat;
    expect(heatFromState([7, 6], [0, 0]).heat).toBeGreaterThan(calm);
    expect(heatFromState([7, 5], [0, 0]).heat).toBeGreaterThan(heatFromState([7, 6], [0, 0]).heat);
    expect(heatFromState([2, 7], [0, 0]).heat).toBeCloseTo(heatFromState([7, 2], [0, 0]).heat); // symmetric room…
    expect(heatFromState([7, 2], [0, 0]).heat).toBeCloseTo(heatFromState([7, 0], [0, 0]).heat); // …capped at 5 Seals
    expect(heatFromState([99, 0], [0, 0]).heat).toBeCloseTo(5 * HEAT_GAP_STEP);
  });
  it('heat rises with the longest current run and caps at 4 claims', () => {
    expect(heatFromState([7, 6], [1, 0]).heat).toBeGreaterThan(heatFromState([7, 6], [0, 0]).heat);
    expect(heatFromState([7, 6], [3, 0]).heat).toBeGreaterThan(heatFromState([7, 6], [2, 0]).heat);
    expect(heatFromState([7, 6], [9, 0]).heat).toBeCloseTo(heatFromState([7, 6], [4, 0]).heat); // capped
    expect(heatFromState([7, 6], [0, 2]).heat).toBeCloseTo(heatFromState([7, 6], [2, 0]).heat); // either seat's run stokes the room
  });
  it('maximum heat is exactly 1', () => {
    expect(heatFromState([7, 0], [9, 0]).heat).toBeCloseTo(1);
  });
  it('COLD_GAP: behind by 3 Seals the viewer\u2019s ink goes cold — 2 does not, ahead never', () => {
    expect(heatFromState([4, 7], [0, 0]).cold).toBe(true);
    expect(COLD_GAP).toBe(3);
    expect(heatFromState([5, 7], [0, 0]).cold).toBe(false);
    expect(heatFromState([7, 4], [0, 0]).cold).toBe(false); // ahead — the cold seat is the other one
    expect(heatFromState([3, 7], [0, 0]).cold).toBe(true);
    expect(heatFromState([4, 8], [0, 0]).cold).toBe(true);  // Magistrates open at 8 Seals
  });
  it('fail-closed: hostile seals yield heat 0 and never throw; garbage runs are no run', () => {
    for (const seals of [[NaN, 7], [7, NaN], [-1, 7], [7, -1], [Infinity, 7], [7, Infinity], ['7', 7], [null, 7], [undefined, 7], [{}, 7]]) {
      expect(heatFromState(seals as [unknown, unknown], [0, 0]), `seals=${JSON.stringify(seals)}`).toEqual({ heat: 0, cold: false });
    }
    // garbage runs are NO run: only a real positive finite number counts (floored)
    for (const runs of [[NaN, 0], ['3', 0], [null, null], [{}, {}], [-2, 0]]) {
      expect(heatFromState([7, 6], runs as unknown as [unknown, unknown]).heat).toBeCloseTo(HEAT_GAP_STEP);
    }
    expect(heatFromState([7, 6], [1.9, 0] as unknown as [unknown, unknown]).heat).toBeCloseTo(HEAT_GAP_STEP + HEAT_RUN_STEP);
  });
  it('parity by construction: same public inputs, same heat — no clocks, no randomness', () => {
    const a = heatFromState([5, 7], [2, 0]);
    const b = heatFromState([5, 7], [2, 0]);
    expect(a).toEqual(b);
    const c = heatFromState([7, 6], [0, 1]);
    expect(c.heat).toBeCloseTo(heatFromState([6, 7], [0, 1]).heat); // the ROOM feels the same gap…
    expect(c.cold).toBe(false);                                     // …but only the seat-0 viewer behind by 3 goes cold
    expect(heatFromState([4, 7], [0, 0]).cold).toBe(true);
  });
  it('a comeback claim snaps the cold off and drops the heat', () => {
    const behind = heatFromState([4, 7], [2, 0]);
    expect(behind.cold).toBe(true);
    expect(behind.heat).toBeCloseTo(3 * HEAT_GAP_STEP + 2 * HEAT_RUN_STEP);
    const after = heatFromState([5, 7], [1, 0]);
    expect(after.cold).toBe(false);
    expect(after.heat).toBeCloseTo(2 * HEAT_GAP_STEP + 1 * HEAT_RUN_STEP);
    expect(after.heat).toBeLessThan(behind.heat);
  });
});

describe('J4 — advanceRuns (the claim-run law)', () => {
  it('a seat\u2019s run extends while it keeps claiming', () => {
    expect(advanceRuns([0, 0], -1, 0)).toEqual({ runs: [1, 0], lastClaimer: 0 });
    expect(advanceRuns([1, 0], 0, 0)).toEqual({ runs: [2, 0], lastClaimer: 0 });
    expect(advanceRuns([0, 2], 1, 1)).toEqual({ runs: [0, 3], lastClaimer: 1 });
  });
  it('any other seat\u2019s claim resets the run and starts their own at 1', () => {
    expect(advanceRuns([3, 0], 0, 1)).toEqual({ runs: [0, 1], lastClaimer: 1 });
    expect(advanceRuns([0, 4], 1, 0)).toEqual({ runs: [1, 0], lastClaimer: 0 });
  });
  it('a hostile prev or lastClaimer never poisons the next run', () => {
    expect(advanceRuns([Number.NaN, 5], 7, 0)).toEqual({ runs: [1, 0], lastClaimer: 0 });
    expect(advanceRuns([2.9, 0], 0, 0)).toEqual({ runs: [3, 0], lastClaimer: 0 }); // fractional runs floor
    expect(advanceRuns([-3, 0], 0, 1)).toEqual({ runs: [0, 1], lastClaimer: 1 });
  });
});
