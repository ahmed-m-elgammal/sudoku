// T7 — Replay Shades: adversarial suite. The recorder, the validator and the driver
// all face hostile input here: a stored echo is UNTRUSTED DATA that comes back from
// IndexedDB or a sync payload, so every malformed shape must fail CLOSED (null),
// never throw, never leak by reference, and never crash the duel runtime.
import { describe, it, expect } from 'vitest';
import {
  validateReplay, newReplayRecorder, recordAction, buildReplay, ReplayDriver,
  nextEchoKey, echoesToEvict, describeEcho, REPLAY_MAX_ACTIONS,
  type DuelReplay,
} from '../replay';
import { serializeDuel, tick } from '../engine';
import { LocalDuel } from '../../src/game/localDuel';
import type { Digit } from '../config';

const VALID_META = {
  seed: 'echo-seed-1',
  tier: 'Easy' as const,
  orders: ['scholar', 'executioner'] as ['scholar', 'executioner'],
  names: ['You', 'Foe'] as [string, string],
  durationMs: 600_000,
};

const baseReplay = (): DuelReplay => ({
  v: 1,
  seed: 'echo-seed-1',
  tier: 'Easy',
  orders: ['scholar', 'executioner'],
  names: ['You', 'Foe'],
  durationMs: 600_000,
  actions: [{ t: 1200, kind: 'place', cell: 5, digit: 3 }],
  outcome: { winner: 0, reason: 'seals' },
});

const mutate = (over: (r: Record<string, unknown>) => void): unknown => {
  const r = JSON.parse(JSON.stringify(baseReplay())) as Record<string, unknown>;
  over(r);
  return r;
};

// ================================================================== validation
describe('R · validateReplay is fail-closed against hostile payloads', () => {
  it('R1 accepts a well-formed replay and never returns the input by reference', () => {
    const raw = baseReplay();
    const out = validateReplay(raw);
    expect(out).not.toBeNull();
    expect(out!.actions[0]).toEqual({ t: 1200, kind: 'place', cell: 5, digit: 3 });
    out!.actions.push({ t: 999_999, kind: 'resign' });
    expect((raw as DuelReplay).actions).toHaveLength(1); // caller's object untouched
  });

  it('R2 rejects non-object roots and wrong versions', () => {
    for (const bad of [null, undefined, 42, 'x', [], true]) {
      expect(validateReplay(bad)).toBeNull();
    }
    expect(validateReplay(mutate((r) => { r.v = 2; }))).toBeNull();
    expect(validateReplay(mutate((r) => { delete r.v; }))).toBeNull();
  });

  it('R3 rejects hostile seeds, tiers, orders, names and seals', () => {
    expect(validateReplay(mutate((r) => { r.seed = ''; }))).toBeNull();
    expect(validateReplay(mutate((r) => { r.seed = 'x'.repeat(129); }))).toBeNull();
    expect(validateReplay(mutate((r) => { r.seed = 123; }))).toBeNull();
    expect(validateReplay(mutate((r) => { r.tier = 'Impossible'; }))).toBeNull();
    expect(validateReplay(mutate((r) => { r.orders = ['scholar']; }))).toBeNull();
    expect(validateReplay(mutate((r) => { r.orders = ['scholar', 'blaster']; }))).toBeNull();
    expect(validateReplay(mutate((r) => { r.orders = 'scholar'; }))).toBeNull();
    expect(validateReplay(mutate((r) => { r.names = ['a'.repeat(25), 'b']; }))).toBeNull();
    expect(validateReplay(mutate((r) => { r.names = 'You'; }))).toBeNull();
    expect(validateReplay(mutate((r) => { r.seals = [0, 7]; }))).toBeNull();
    expect(validateReplay(mutate((r) => { r.seals = [7, 99]; }))).toBeNull();
    expect(validateReplay(mutate((r) => { r.seals = [7.5, 7]; }))).toBeNull();
    expect(validateReplay(mutate((r) => { r.seals = [7]; }))).toBeNull();
  });

  it('R4 rejects hostile durationMs and action logs', () => {
    expect(validateReplay(mutate((r) => { r.durationMs = 1000; }))).toBeNull();          // too short
    expect(validateReplay(mutate((r) => { r.durationMs = 3_600_001; }))).toBeNull();     // too long
    expect(validateReplay(mutate((r) => { r.durationMs = NaN; }))).toBeNull();           // JSON can't carry NaN, but the API accepts objects
    expect(validateReplay(mutate((r) => { r.actions = 'nope'; }))).toBeNull();
    expect(validateReplay(mutate((r) => { r.actions = [null]; }))).toBeNull();
    expect(validateReplay(mutate((r) => { r.actions = [42]; }))).toBeNull();
    expect(validateReplay(mutate((r) => { r.actions = [{ t: 1, kind: 'explode' }]; }))).toBeNull();
  });

  it('R5 rejects hostile place actions (cell, digit, extra keys)', () => {
    for (const cell of [-1, 81, 4.5, '5', NaN]) {
      expect(validateReplay(mutate((r) => { (r.actions as unknown[])[0] = { t: 100, kind: 'place', cell, digit: 5 }; })), `cell ${cell}`).toBeNull();
    }
    for (const digit of [0, 10, -3, 2.5, '7']) {
      expect(validateReplay(mutate((r) => { (r.actions as unknown[])[0] = { t: 100, kind: 'place', cell: 5, digit }; })), `digit ${digit}`).toBeNull();
    }
    expect(validateReplay(mutate((r) => { (r.actions as unknown[])[0] = { t: 100, kind: 'place', cell: 5, digit: 5, force: true }; }))).toBeNull();
  });

  it('R6 rejects hostile ability actions (id, cell, unit, key sets)', () => {
    expect(validateReplay(mutate((r) => { (r.actions as unknown[])[0] = { t: 100, kind: 'ability', id: 'fireball' }; }))).toBeNull();
    expect(validateReplay(mutate((r) => { (r.actions as unknown[])[0] = { t: 100, kind: 'ability', id: 'augur', cell: 81 }; }))).toBeNull();
    expect(validateReplay(mutate((r) => { (r.actions as unknown[])[0] = { t: 100, kind: 'ability', id: 'augur', cell: NaN }; }))).toBeNull();
    expect(validateReplay(mutate((r) => { (r.actions as unknown[])[0] = { t: 100, kind: 'ability', id: 'quarantine', unit: 'r99' }; }))).toBeNull();
    expect(validateReplay(mutate((r) => { (r.actions as unknown[])[0] = { t: 100, kind: 'ability', id: 'quarantine', unit: 7 }; }))).toBeNull();
    expect(validateReplay(mutate((r) => { (r.actions as unknown[])[0] = { t: 100, kind: 'ability', id: 'hush', cheat: 1 }; }))).toBeNull();
  });

  it('R7 rejects hostile resign actions and out-of-window timestamps', () => {
    expect(validateReplay(mutate((r) => { (r.actions as unknown[])[0] = { t: 100, kind: 'resign', cell: 1 }; }))).toBeNull();
    expect(validateReplay(mutate((r) => { (r.actions as unknown[])[0] = { t: -1, kind: 'place', cell: 1, digit: 2 }; }))).toBeNull();
    expect(validateReplay(mutate((r) => { (r.actions as unknown[])[0] = { t: 1.5, kind: 'place', cell: 1, digit: 2 }; }))).toBeNull();
    expect(validateReplay(mutate((r) => { (r.actions as unknown[])[0] = { t: 600_000 + 60_001, kind: 'resign' }; }))).toBeNull();
    // inside the grace window is fine
    expect(validateReplay(mutate((r) => { (r.actions as unknown[])[0] = { t: 600_000 + 60_000, kind: 'resign' }; }))).not.toBeNull();
  });

  it('R8 rejects time-travelling logs (t must be non-decreasing)', () => {
    const r = baseReplay();
    r.actions = [
      { t: 5000, kind: 'place', cell: 1, digit: 2 },
      { t: 4999, kind: 'place', cell: 2, digit: 3 },
    ];
    expect(validateReplay(r)).toBeNull();
    const ok = baseReplay();
    ok.actions = [
      { t: 5000, kind: 'place', cell: 1, digit: 2 },
      { t: 5000, kind: 'ability', id: 'hush' },
    ];
    expect(validateReplay(ok)).not.toBeNull(); // equal t allowed (same tick)
  });

  it('R9 rejects oversized logs and hostile outcomes', () => {
    const many = Array.from({ length: REPLAY_MAX_ACTIONS + 1 }, (_, i) => ({ t: i, kind: 'resign' }));
    expect(validateReplay(mutate((r) => { r.actions = many; }))).toBeNull();
    expect(validateReplay(mutate((r) => { r.outcome = { winner: 2, reason: 'seals' }; }))).toBeNull();
    expect(validateReplay(mutate((r) => { r.outcome = { winner: 0, reason: 'x'.repeat(33) }; }))).toBeNull();
    expect(validateReplay(mutate((r) => { r.outcome = { winner: 0 }; }))).toBeNull();
    expect(validateReplay(mutate((r) => { r.outcome = 'won'; }))).toBeNull();
  });

  it('R10 prototype pollution rides nowhere: __proto__ payloads are dropped', () => {
    const evil = JSON.parse('{"v":1,"seed":"s","tier":"Easy","orders":["scholar","executioner"],"names":["a","b"],"durationMs":600000,"actions":[],"__proto__":{"polluted":1}}');
    const out = validateReplay(evil);
    expect(out).not.toBeNull();
    expect((out as unknown as Record<string, unknown>).polluted).toBeUndefined();
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});

// ================================================================== recorder + driver
describe('R · recorder and driver primitives', () => {
  it('R11 the recorder caps at the action limit and can be sealed', () => {
    const rec = newReplayRecorder();
    for (let i = 0; i < REPLAY_MAX_ACTIONS + 50; i++) recordAction(rec, { t: i, kind: 'resign' });
    expect(rec.actions).toHaveLength(REPLAY_MAX_ACTIONS);
    rec.sealed = true;
    recordAction(rec, { t: 9999, kind: 'resign' });
    expect(rec.actions).toHaveLength(REPLAY_MAX_ACTIONS);
  });

  it('R12 buildReplay self-validates: a poisoned recorder yields null, not a bad echo', () => {
    const rec = newReplayRecorder();
    recordAction(rec, { t: 1200, kind: 'place', cell: 5, digit: 3 });
    expect(buildReplay(rec, VALID_META)).not.toBeNull();
    rec.actions.push({ t: 1100, kind: 'resign' }); // out of order
    expect(buildReplay(rec, VALID_META)).toBeNull();
  });

  it('R13 the driver releases actions exactly once, in clock order, and stops at duel end', () => {
    const r = baseReplay();
    r.actions = [
      { t: 1000, kind: 'place', cell: 1, digit: 2 },
      { t: 2500, kind: 'ability', id: 'hush' },
      { t: 9000, kind: 'place', cell: 2, digit: 3 },
      { t: 600_000, kind: 'resign' },
    ];
    const d = new ReplayDriver(r, 1);
    const st = { phase: 'live', clockMs: 0 } as unknown as Parameters<ReplayDriver['due']>[0];
    expect(d.due(st)).toHaveLength(0);
    st.clockMs = 1000;
    expect(d.due(st)).toHaveLength(1);
    expect(d.due(st)).toHaveLength(0); // never twice
    st.clockMs = 3000;
    expect(d.due(st)).toHaveLength(1);
    expect(d.nextT()).toBe(9000);
    expect(d.remaining).toBe(2);
    st.phase = 'ended';
    expect(d.due(st)).toHaveLength(0); // silence after death
    expect(d.nextT()).toBe(9000);      // cursor unchanged
  });
});

// ================================================================== LocalDuel integration (headless)
type Wake = { shadeWake(): void };

// drives a duel headlessly: engine ticks + human script + echo/shade wakes at 500ms cadence
const drive = (
  duel: LocalDuel,
  human: Array<{ at: number; do: (d: LocalDuel) => void }>,
  untilClock: number,
): void => {
  const wake = duel as unknown as Wake;
  let h = 0;
  while (duel.state.phase === 'live' && duel.state.clockMs < untilClock) {
    tick(duel.state, 500);
    while (h < human.length && human[h].at <= duel.state.clockMs) { human[h].do(duel); h++; }
    wake.shadeWake();
  }
};

const firstEmptyOf = (duel: LocalDuel): number => {
  for (let c = 0; c < 81; c++) if (duel.state.players[0].board[c] === 0) return c;
  return -1;
};

// a pacified foe (the practice "Tablet") so the scripted human survives to act
const PACIFIED = {
  name: 'The Tablet', order: 'executioner' as const,
  placeDelayMs: [99999, 100000] as [number, number],
  mistakeRate: 0, abilityCadenceMs: [999999, 1000000] as [number, number],
  aggression: 0, singlesSkill: 0,
};

describe('R · LocalDuel records and replays echoes (deterministic, hostile-proof)', () => {
  it('R14 a scripted duel records a valid, ordered, self-consistent replay', () => {
    const duel = new LocalDuel({
      mode: 'practice', seed: 'rec-seed', tier: 'Easy',
      orders: ['scholar', 'executioner'], names: ['You', 'Foe'],
      foeProfile: PACIFIED,
    });
    const human: Array<{ at: number; do: (d: LocalDuel) => void }> = [];
    for (let i = 0; i < 6; i++) {
      human.push({
        at: 3000 + i * 5000,
        do: (d) => {
          const c = firstEmptyOf(d);
          d.place(c, d.state.solution![c] as Digit);
        },
      });
    }
    human.push({ at: 32_000, do: (d) => d.ability('augur', { cell: firstEmptyOf(d) }) });
    human.push({ at: 40_000, do: (d) => d.concede() });
    drive(duel, human, 60_000);
    expect(duel.state.phase).toBe('ended'); // conceded
    const rec = duel.toReplay({ winner: 1, reason: 'forfeit' });
    expect(rec).not.toBeNull();
    expect(rec!.actions).toHaveLength(8); // 6 places + 1 ability + 1 resign
    expect(rec!.actions.filter((a) => a.kind === 'place')).toHaveLength(6);
    expect(rec!.actions[rec!.actions.length - 1].kind).toBe('resign');
    for (let i = 1; i < rec!.actions.length; i++) expect(rec!.actions[i].t).toBeGreaterThanOrEqual(rec!.actions[i - 1].t);
    expect(rec!.outcome).toEqual({ winner: 1, reason: 'forfeit' });
    expect(validateReplay(rec)).not.toBeNull();
    // posthumous ink is refused
    expect(duel.place(firstEmptyOf(duel), 5 as Digit).ok).toBe(false);
    expect(rec!.actions).toHaveLength(8);
  });

  it('R15 the echo replays the recorded ink faithfully and the run is deterministic', () => {
    // 1) record a duel whose human plays a fixed script
    const makeHuman = (): Array<{ at: number; do: (d: LocalDuel) => void }> => {
      const cells: number[] = [];
      const human: Array<{ at: number; do: (d: LocalDuel) => void }> = [];
      for (let i = 0; i < 8; i++) {
        human.push({
          at: 2500 + i * 5000,
          do: (d) => {
            const c = firstEmptyOf(d);
            cells.push(c);
            d.place(c, d.state.solution![c] as Digit);
          },
        });
      }
      human.push({ at: 20_000, do: (d) => d.ability('augur', { cell: firstEmptyOf(d) }) });
      return human;
    };
    const recordDuel = new LocalDuel({
      mode: 'practice', seed: 'echo-determinism', tier: 'Easy',
      orders: ['scholar', 'executioner'], names: ['You', 'Foe'],
      foeProfile: PACIFIED,
    });
    drive(recordDuel, makeHuman(), 45_000);
    const rec = recordDuel.toReplay({ winner: 0, reason: 'seals' });
    expect(rec).not.toBeNull();
    expect(rec!.actions.filter((a) => a.kind === 'place')).toHaveLength(8);

    // 2) replay it twice against the same fixed human script
    const runEcho = (): LocalDuel => {
      const duel = new LocalDuel({
        mode: 'replay', seed: 'echo-determinism', tier: 'Easy',
        orders: ['scholar', 'executioner'], names: ['You', rec!.names[0]],
        replay: rec!,
      });
      expect(duel.replayDegraded).toBe(false);
      drive(duel, makeHuman(), 45_000);
      return duel;
    };
    const b = runEcho();
    const c = runEcho();
    expect(serializeDuel(c.state)).toBe(serializeDuel(b.state));

    // 3) faithfulness: the echo's tablet carries exactly the recorded ink
    expect(Array.from(b.state.players[1].board)).toEqual(Array.from(recordDuel.state.players[0].board));
    expect(b.state.players[1].progress).toBe(recordDuel.state.players[0].progress);
    // the echo never casts anything the recording did not contain
    expect(b.state.events.some((e) => e.kind === 'ability' && e.player === 1)).toBe(false);
  });

  it('R16 a corrupted echo degrades visibly to a normal Shade, never crashes', () => {
    const corrupt = {
      ...baseReplay(),
      actions: [{ t: 1000, kind: 'place', cell: 999, digit: 3 }], // cell out of range
    };
    const duel = new LocalDuel({
      mode: 'replay', seed: 'corrupt-echo', tier: 'Easy',
      orders: ['scholar', 'executioner'], names: ['You', 'Ghost'],
      replay: corrupt as DuelReplay,
    });
    expect(duel.replayDegraded).toBe(true);
    drive(duel, [], 40_000); // the fallback Shade duels on
    expect(duel.state.players[1].progress).toBeGreaterThan(0);
    // whatever happened, it happened through the duel engine, not a crash
    expect(['live', 'ended']).toContain(duel.state.phase);
    if (duel.state.phase === 'ended') expect(['seals', 'reckoning', 'suddenJudgment']).toContain(duel.state.winReason as never);
  });

  it('R17 an echo that resigns ends the duel for seat 0', () => {
    const r = baseReplay();
    r.actions = [{ t: 3000, kind: 'resign' }];
    const duel = new LocalDuel({
      mode: 'replay', seed: 'echo-resign', tier: 'Easy',
      orders: ['scholar', 'executioner'], names: ['You', 'Coward'],
      replay: r,
    });
    drive(duel, [], 10_000);
    expect(duel.state.phase).toBe('ended');
    expect(duel.state.winner).toBe(0);
    expect(duel.state.winReason).toBe('forfeit');
  });

  it('R18 echo actions past the buzzer never land (the duel judges first)', () => {
    const r = baseReplay();
    r.actions = [
      { t: 610_000, kind: 'place', cell: 0, digit: 5 }, // past duration (600s), inside the 60s grace
      { t: 620_000, kind: 'resign' },
    ];
    const duel = new LocalDuel({
      mode: 'replay', seed: 'echo-late', tier: 'Easy',
      orders: ['scholar', 'executioner'], names: ['You', 'Late'],
      replay: r,
    });
    drive(duel, [], 700_000); // through Sudden Judgment
    expect(duel.state.phase).toBe('ended');
    expect(duel.state.winReason).toBe('suddenJudgment');
    expect(duel.state.players[1].progress).toBe(0); // the late ink never landed
    expect(duel.state.events.some((e) => e.kind === 'forfeit')).toBe(false); // the late resign never landed
  });

  it("R19 the echo board is the echo's own: the live player's ink cannot leak onto it", () => {
    const r = baseReplay();
    r.actions = [{ t: 4000, kind: 'place', cell: 0, digit: 5 }]; // may be wrong or right — its own tablet
    const duel = new LocalDuel({
      mode: 'replay', seed: 'echo-solo', tier: 'Easy',
      orders: ['scholar', 'executioner'], names: ['You', 'Echo'],
      replay: r,
    });
    drive(duel, [], 8000);
    const echoBoard = duel.state.players[1].board;
    const liveBoard = duel.state.players[0].board;
    // seat boards only ever share the givens
    for (let c = 0; c < 81; c++) {
      if (duel.state.givens[c] !== 0) continue;
      if (echoBoard[c] !== 0) expect(liveBoard[c]).toBe(0); // the echo placed alone
    }
  });
});

// ================================================================== echo storage helpers
describe('R · echo storage helpers (pure parts)', () => {
  it('R23 fractional rAF clocks still record integer-ms echoes (regression: browser E2E found this)', () => {
    const duel = new LocalDuel({
      mode: 'practice', seed: 'frac-clock', tier: 'Easy',
      orders: ['scholar', 'executioner'], names: ['You', 'Foe'],
      foeProfile: PACIFIED,
    });
    // rAF-style frame deltas: 16.7ms with jitter — the real client clock is continuous
    const human: Array<{ at: number; do: (d: LocalDuel) => void }> = [{
      at: 2000, do: (d) => { const c = firstEmptyOf(d); d.place(c, d.state.solution![c] as Digit); },
    }, {
      at: 4000, do: (d) => { const c = firstEmptyOf(d); d.place(c, d.state.solution![c] as Digit); },
    }];
    const wake = duel as unknown as Wake;
    let h = 0;
    let clock = 0;
    while (duel.state.phase === 'live' && clock < 6000) {
      const dt = 16 + (clock % 3) * 0.35 + 0.7; // fractional, irregular
      tick(duel.state, dt);
      clock += dt;
      while (h < human.length && human[h].at <= duel.state.clockMs) { human[h].do(duel); h++; }
      wake.shadeWake();
    }
    const rec = duel.toReplay({ winner: 0, reason: 'seals' });
    expect(rec).not.toBeNull(); // the validator used to reject fractional t outright
    for (const a of rec!.actions) expect(Number.isInteger(a.t)).toBe(true);
  });

  it('R20 eviction keeps the newest cap and breaks ties toward the later key', () => {
    const entries = Array.from({ length: 15 }, (_, i) => ({ key: `echo-${i}`, t: i * 1000 }));
    const evict = echoesToEvict(entries, 12);
    expect(evict).toEqual(['echo-0', 'echo-1', 'echo-2']);
    const ties = [{ key: 'a', t: 5 }, { key: 'b', t: 5 }, { key: 'c', t: 5 }];
    expect(echoesToEvict(ties, 1)).toEqual(['a', 'b']); // 'c' (latest key) survives
    expect(echoesToEvict([], 12)).toEqual([]);
    expect(echoesToEvict(entries.slice(0, 5), 12)).toEqual([]);
  });

  it('R21 echo keys are unique under a salted clock', () => {
    const a = nextEchoKey(1_700_000_000_000, 1);
    const b = nextEchoKey(1_700_000_000_000, 2);
    const c = nextEchoKey(1_700_000_000_001, 1);
    expect(new Set([a, b, c]).size).toBe(3);
    expect(a.startsWith('echo-')).toBe(true);
  });

  it('R22 describeEcho renders the honest one-liner', () => {
    const r = baseReplay();
    r.actions = [
      { t: 100, kind: 'place', cell: 1, digit: 2 },
      { t: 200, kind: 'place', cell: 2, digit: 3 },
      { t: 300, kind: 'ability', id: 'hush' },
    ];
    expect(describeEcho(r)).toBe('Easy · 2 ink · won');
    delete (r as { outcome?: unknown }).outcome;
    expect(describeEcho(r)).toBe('Easy · 2 ink · unfinished');
  });
});
