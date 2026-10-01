// ADVERSARIAL ENGINE SUITE — tests written to BREAK the engine, not to pass.
// Every block here starts from a probe that demonstrably broke or distorted the
// engine (see scripts/probe-engine.ts for the original evidence). Preconditions
// are set EXPLICITLY — no test may pass because of an unrelated seeded side effect.
//
// Contracts pinned here:
//   H  — hostile inputs are rejected with a result or a precise throw, never a crash
//   I  — engine invariants hold after EVERY step of seeded random duels
//   D  — identical (seed, script) => identical final state, byte for byte
//   S  — status interaction matrix is fully pinned (bulwark/ward/mirror/gap/immunity)
//   C  — clock, flinch, momentum and Sudden Judgment behave at boundaries
//   A  — every ability obeys its contract with explicitly-built preconditions
//   W  — swap (T4 primitives) cannot corrupt state or resurrect spent defenses
import { describe, it, expect } from 'vitest';
import {
  createDuel, place, useAbility, tick, resign, swapOrder, applyStatus,
  serializeDuel, deserializeDuel, cellFlags,
  type DuelState, type PlaceResult,
} from '../engine';
import { generatePuzzle, type Puzzle } from '../sudoku';
import { Rng } from '../rng';
import {
  CONFIG, ORDER_ABILITIES, UNIT_CELLS, CELL_UNITS,
  type AbilityId, type Digit, type OrderId, type PlayerId, type UnitId,
} from '../config';

// ------------------------------------------------------------------ fixtures
const PUZZLES: Puzzle[] = [
  generatePuzzle('adv-easy-a', 'Easy'),
  generatePuzzle('adv-easy-b', 'Easy'),
  generatePuzzle('adv-med-a', 'Medium'),
  generatePuzzle('adv-med-b', 'Medium'),
  generatePuzzle('adv-hard-a', 'Hard'),
];

const mkDuel = (over: Partial<Parameters<typeof createDuel>[0]> = {}, puzzleIdx = 0): DuelState => {
  const p = PUZZLES[puzzleIdx % PUZZLES.length];
  return createDuel({
    seed: 'adv',
    givens: Uint8Array.from(p.givens),
    solution: Uint8Array.from(p.solution),
    ...over,
  });
};

const firstEmpty = (st: DuelState, player: PlayerId = 0): number => {
  for (let c = 0; c < 81; c++) if (st.players[player].board[c] === 0) return c;
  return -1;
};
const wrongDigitFor = (st: DuelState, cell: number): Digit =>
  (st.solution![cell] === 9 ? 1 : st.solution![cell] + 1) as Digit;
const allUnits = (): UnitId[] => Object.keys(UNIT_CELLS);
const STATUS_TYPES = ['chain', 'smudge', 'hush', 'miasma', 'quarantine'] as const;

// ================================================================== H. hostile inputs
describe('H · hostile inputs are rejected, never crash, never corrupt', () => {
  it('H1 invalid seat index is refused by every mutation entry point (was: TypeError crash)', () => {
    const st = mkDuel();
    const c = firstEmpty(st);
    expect((place(st, 2 as unknown as PlayerId, c, 5 as unknown as Digit)).ok).toBe(false);
    expect((place(st, -1 as unknown as PlayerId, c, 5 as unknown as Digit)).ok).toBe(false);
    expect((useAbility(st, 7 as unknown as PlayerId, 'unseal')).ok).toBe(false);
    expect(resign(st, 3 as unknown as PlayerId)).toBeUndefined();
    expect(st.phase).toBe('live');
    expect(st.events.some((e) => e.kind === 'forfeit')).toBe(false);
    // and the duel keeps working afterwards
    expect(place(st, 0, c, st.solution![c] as Digit).ok).toBe(true);
  });

  it('H2 cellFlags for an invalid seat returns empty flags, not a crash', () => {
    const st = mkDuel();
    useAbility(st, 1, 'hush');
    const f = cellFlags(st, 9 as unknown as PlayerId);
    expect(f.chained.size).toBe(0);
    expect(f.smudged.size).toBe(0);
    expect(f.hushed).toBe(false);
    expect(f.quarantinedUnits.size).toBe(0);
  });

  it('H3 fractional digits are refused without burning a Seal (was: accepted as a mistake)', () => {
    for (const bad of [2.5, 1.0000001, 0.9999999, -3.5]) {
      const st = mkDuel({ orders: ['executioner', 'scholar'] }); // no forgiveness
      const c = firstEmpty(st);
      const sealsBefore = st.players[0].seals;
      const mistakesBefore = st.players[0].mistakes;
      const r = place(st, 0, c, bad as unknown as Digit);
      expect(r.ok, `digit ${bad} must be refused`).toBe(false);
      expect(r.reason).toBe('invalidTarget');
      expect(st.players[0].seals).toBe(sealsBefore);
      expect(st.players[0].mistakes).toBe(mistakesBefore);
      expect(st.players[0].board[c]).toBe(0);
      expect(st.events.some((e) => e.kind === 'mistake')).toBe(false);
    }
  });

  it('H4 NaN / Infinity digits are refused (NaN < 1 and NaN > 9 are both false — the old hole)', () => {
    for (const bad of [NaN, Infinity, -Infinity]) {
      const st = mkDuel({ orders: ['executioner', 'scholar'] });
      const c = firstEmpty(st);
      const r = place(st, 0, c, bad as unknown as Digit);
      expect(r.ok).toBe(false);
      expect(r.reason).toBe('invalidTarget');
      expect(st.players[0].mistakes).toBe(0);
    }
  });

  it('H5 out-of-range integers 0 and 10 are refused without state change', () => {
    for (const bad of [0, 10, -1]) {
      const st = mkDuel();
      const c = firstEmpty(st);
      const r = place(st, 0, c, bad as unknown as Digit);
      expect(r.ok).toBe(false);
      expect(st.players[0].board[c]).toBe(0);
      expect(st.players[0].progress).toBe(0);
    }
  });

  it('H6 tick(NaN) cannot brick the duel (was: permanent soft-lock, clock stuck at NaN)', () => {
    const st = mkDuel();
    tick(st, NaN);
    expect(st.clockMs).toBe(0);
    tick(st, undefined as unknown as number);
    expect(st.clockMs).toBe(0);
    tick(st, 1000);
    expect(st.clockMs).toBe(1000);
    // the duel is still fully alive: statuses expire, judgment still arrives
    useAbility(st, 1, 'hush');
    tick(st, 3000);
    expect(st.players[0].statuses.length).toBe(0);
    tick(st, CONFIG.duel.durationMs);
    expect(st.phase).toBe('ended');
    expect(st.winReason).toBe('suddenJudgment');
  });

  it('H7 tick(Infinity) cannot insta-end a duel through a transport bug', () => {
    const st = mkDuel();
    tick(st, Infinity);
    expect(st.phase).toBe('live');
    tick(st, 1000);
    expect(st.clockMs).toBe(1000);
  });

  it('H8 tick(-1) cannot rewind the clock, re-arm statuses, or extend immunity', () => {
    const st = mkDuel({ orders: ['scholar', 'executioner'] });
    useAbility(st, 1, 'hush');
    tick(st, 2500);
    expect(st.players[0].statuses.some((s) => s.type === 'hush')).toBe(false);
    const clock = st.clockMs;
    const immune = st.players[0].immuneUntil.hush;
    tick(st, -5000);
    tick(st, -1e9);
    expect(st.clockMs).toBe(clock);
    expect(st.players[0].immuneUntil.hush).toBe(immune);
  });

  it('H9 fairCopy with a hostile cell is refused and burns no cooldown (was: TypeError on UNIT_CELLS["bNaN"])', () => {
    for (const bad of [NaN, Infinity, -1, 81, 4.5, 1e21]) {
      const st = mkDuel({ orders: ['scholar', 'executioner'] });
      const r = useAbility(st, 0, 'fairCopy', { cell: bad });
      expect(r.ok, `fairCopy cell ${bad}`).toBe(false);
      expect(r.reason).toBe('invalidTarget');
      expect(st.players[0].abilities.fairCopy.cdLeftMs).toBe(0);
      expect(st.players[0].abilities.fairCopy.usedOnce).toBe(false);
    }
    // a filled cell is also refused (the old engine accepted the wasted cast)
    const st = mkDuel({ orders: ['scholar', 'executioner'] });
    const given = st.givens.findIndex((g) => g !== 0);
    const r = useAbility(st, 0, 'fairCopy', { cell: given });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('invalidTarget');
    expect(st.players[0].abilities.fairCopy.usedOnce).toBe(false);
  });

  it('H10 augur with hostile or filled cells is refused and burns no cooldown', () => {
    for (const bad of [NaN, -1, 81, 4.5]) {
      const st = mkDuel({ orders: ['scholar', 'executioner'] });
      const r = useAbility(st, 0, 'augur', { cell: bad });
      expect(r.ok).toBe(false);
      expect(st.players[0].abilities.augur.cdLeftMs).toBe(0);
    }
    const st = mkDuel({ orders: ['scholar', 'executioner'] });
    const given = st.givens.findIndex((g) => g !== 0);
    expect(useAbility(st, 0, 'augur', { cell: given }).ok).toBe(false);
    expect(st.players[0].abilities.augur.usedOnce).toBe(false);
  });

  it('H11 quarantine refuses unit ids that do not exist on the tablet (was: stored garbage silently)', () => {
    const st = mkDuel({ orders: ['warden', 'executioner'] });
    for (const bad of ['r9', 'c-1', 'x0', 'bNaN', '', 'r0.5']) {
      const r = useAbility(st, 0, 'quarantine', { unit: bad });
      expect(r.ok, `unit "${bad}"`).toBe(false);
      expect(r.reason).toBe('invalidTarget');
    }
    expect(st.players[1].statuses.length).toBe(0);
    expect(st.players[0].abilities.quarantine.usedOnce).toBe(false);
    // a real unit still works
    expect(useAbility(st, 0, 'quarantine', { unit: 'r0' }).ok).toBe(true);
  });

  it('H12 abilities of a foreign Order are refused with wrongOrder; unknown ids report unknown', () => {
    const st = mkDuel({ orders: ['scholar', 'executioner'] });
    expect(useAbility(st, 0, 'sever').reason).toBe('wrongOrder');
    expect(useAbility(st, 0, 'tincture').reason).toBe('wrongOrder');
    expect(useAbility(st, 0, 'ward').reason).toBe('wrongOrder');
    expect(useAbility(st, 0, 'blast' as unknown as AbilityId).reason).toBe('unknown');
    expect(useAbility(st, 0, 'blast' as unknown as AbilityId).ok).toBe(false);
  });

  it('H13 createDuel fails fast on impossible Seals (was: duels began with dead or immortal players)', () => {
    for (const seals of [[-5, 100], [0, 7], [7, 0], [7.5, 7], [NaN, 7], [Infinity, 7], [-1, -1]]) {
      expect(() => mkDuel({ magistrateSeals: seals as [number, number] }), `seals ${JSON.stringify(seals)}`)
        .toThrow(RangeError);
    }
    // legitimate campaign values still construct
    expect(() => mkDuel({ magistrateSeals: [7, 8] })).not.toThrow();
  });

  it('H14 swapOrder refuses unknown Order ids without emitting an event (was: TypeError on ORDER_ABILITIES[bad])', () => {
    const st = mkDuel();
    const before = st.events.length;
    expect(swapOrder(st, 0, 'blast' as unknown as OrderId)).toBe(false);
    expect(swapOrder(st, 2 as unknown as PlayerId, 'warden')).toBe(false);
    expect(st.events.length).toBe(before);
    expect(st.players[0].order).toBe('scholar');
  });

  it('H15 malformed snapshots throw a precise error instead of silently corrupting', () => {
    const st = mkDuel();
    const good = serializeDuel(st);
    expect(() => deserializeDuel(good)).not.toThrow();
    const garbage: string[] = [
      '{}',
      'null',
      '"a string"',
      '{"players":null,"givens":[]}',
      '{"players":[],"givens":[]}',
      '{"players":[{"id":0,"board":[0,1]}],"givens":[1]}',                       // short boards
      '{"players":[{"id":0},{"id":1}],"givens":"not an array"}',
      '{"players":[{"id":0},{"id":1}],"givens":[0], "solution":[1,2]}',          // short solution
      '{"players":[{"id":0},{"id":1}],"givens":[0,0],"solution":123}',
      '{"players":[{"id":0},{"id":1}],"givens":[0,0],"events":"nope"}',
      '{"players":[{"id":0,"board":' + JSON.stringify(Array(81).fill(300)) + '},{"id":1,"board":' + JSON.stringify(Array(81).fill(0)) + '}],"givens":' + JSON.stringify(Array(81).fill(0)) + '}', // byte overflow
    ];
    for (const g of garbage) {
      expect(() => deserializeDuel(g as string), g.slice(0, 40)).toThrow(/malformed/i);
    }
  });

  it('H16 applyStatus primitive rejects unknown status types and garbage cells without corrupting', () => {
    const st = mkDuel();
    expect(applyStatus(st, 0, 'curse' as never, 1).applied).toBe(false);
    expect(applyStatus(st, 0, 'chain', 1, { cell: 4.5 }).applied).toBe(false);
    expect(applyStatus(st, 0, 'chain', 1, { cell: 99 }).applied).toBe(false);
    expect(applyStatus(st, 0, 'smudge', 1, { cells: [200, -3] }).applied).toBe(false);
    expect(st.players[1].statuses.length).toBe(0);
    // a valid one still lands
    expect(applyStatus(st, 0, 'chain', 1, { cell: 3 }).applied).toBe(true);
  });
});

// ================================================================== I + D. fuzz harness
interface FuzzStep {
  op: 'place' | 'placeBad' | 'ability' | 'abilityBad' | 'tick' | 'swap' | 'resign' | 'applyStatus';
  seat: PlayerId;
  cellJitter: number;      // 0 = sensible cell, 1 = hostile cell
  digitJitter: number;     // 0 = true digit, 1 = wrong digit, 2 = non-digit
  abilityIdx: number;      // index into the seat's order abilities (hostile when out of range)
  unitIdx: number;         // index into all units (hostile when out of range)
  dt: number;
  orderIdx: number;
  statusIdx: number;
}

const buildScript = (rng: Rng, steps: number): FuzzStep[] => {
  const out: FuzzStep[] = [];
  for (let i = 0; i < steps; i++) {
    const roll = rng.next();
    const op: FuzzStep['op'] =
      roll < 0.30 ? 'place' :
      roll < 0.38 ? 'placeBad' :
      roll < 0.60 ? 'ability' :
      roll < 0.68 ? 'abilityBad' :
      roll < 0.90 ? 'tick' :
      roll < 0.94 ? 'swap' :
      roll < 0.96 ? 'resign' : 'applyStatus';
    out.push({
      op,
      seat: rng.next() < 0.5 ? 0 : 1,
      cellJitter: rng.next() < 0.15 ? 1 : 0,
      digitJitter: Math.floor(rng.next() * 3),
      abilityIdx: Math.floor(rng.next() * 5),       // 0..2 valid, 3-4 hostile
      unitIdx: Math.floor(rng.next() * 34),         // 0..26 valid, 27+ hostile
      dt: rng.next() < 0.05 ? 0 : Math.floor(100 + rng.next() * 5900),
      orderIdx: Math.floor(rng.next() * 5),         // 0..3 valid, 4 hostile
      statusIdx: Math.floor(rng.next() * 6),        // 0..4 valid, 5 hostile
    });
  }
  return out;
};

// execution reads live state for targets — deterministic functions of state, so
// the same script run twice must produce byte-identical states.
const execStep = (st: DuelState, s: FuzzStep, rng: Rng, all: UnitId[]): void => {
  const seat = s.seat;
  const p = st.players[seat];
  switch (s.op) {
    case 'place': {
      let cell = -1;
      for (let c = 0; c < 81; c++) if (p.board[c] === 0) { cell = c; break; }
      if (s.cellJitter === 1) cell = rng.next() < 0.5 ? -1 : 90;
      if (cell >= 0 && cell <= 80 && p.board[cell] === 0 && st.solution) {
        const digit = s.digitJitter === 1 ? wrongDigitFor(st, cell) : st.solution[cell];
        place(st, seat, cell, digit as Digit);
      } else if (cell >= 0) {
        place(st, seat, cell, (s.digitJitter + 1) as Digit); // may be refused or wrong
      }
      break;
    }
    case 'placeBad': {
      const c = firstEmpty(st, seat);
      const digit = s.digitJitter === 2 ? (2.5 as unknown as Digit) : wrongDigitFor(st, Math.max(0, c));
      if (c >= 0) place(st, seat, s.cellJitter === 1 ? 81 : c, digit);
      break;
    }
    case 'ability':
    case 'abilityBad': {
      const own = ORDER_ABILITIES[p.order];
      const id = s.abilityIdx < own.length ? own[s.abilityIdx] : ('blast' as unknown as AbilityId);
      const arg: { cell?: number; unit?: UnitId } = {};
      if (id === 'augur' || id === 'fairCopy') {
        const empties: number[] = [];
        for (let c = 0; c < 81; c++) if (p.board[c] === 0) empties.push(c);
        arg.cell = s.cellJitter === 1 || !empties.length ? (s.cellJitter === 1 ? NaN : -1) : empties[Math.floor(rng.next() * empties.length)];
      }
      if (id === 'quarantine') {
        arg.unit = s.unitIdx < all.length ? all[s.unitIdx] : 'r99';
      }
      useAbility(st, seat, id, arg);
      break;
    }
    case 'tick':
      tick(st, s.dt);
      break;
    case 'swap': {
      const orders: OrderId[] = ['scholar', 'executioner', 'apothecary', 'warden'];
      const to = s.orderIdx < 4 ? orders[s.orderIdx] : ('blast' as unknown as OrderId);
      swapOrder(st, seat, to);
      break;
    }
    case 'resign':
      if (rng.next() < 0.15) resign(st, seat);
      break;
    case 'applyStatus': {
      const types = [...STATUS_TYPES];
      const type = s.statusIdx < types.length ? types[s.statusIdx] : ('curse' as never);
      applyStatus(st, seat, type, seat === 0 ? 1 : 0, { cell: s.cellJitter ? 99 : Math.floor(rng.next() * 81) });
      break;
    }
  }
};

const checkInvariants = (st: DuelState, initial: { seals: [number, number]; givensCount: number }) => {
  // clock
  expect(st.clockMs).toBeGreaterThanOrEqual(0);
  expect(Number.isFinite(st.clockMs)).toBe(true);
  expect(Number.isInteger(st.rngState)).toBe(true);
  expect(st.rngState).toBeGreaterThanOrEqual(0);
  expect(st.rngState).toBeLessThanOrEqual(0xFFFFFFFF);

  for (let i = 0; i < 2; i++) {
    const p = st.players[i];
    // boards stay a subset of the solution; givens immutable
    if (st.solution) {
      for (let c = 0; c < 81; c++) {
        if (st.givens[c] !== 0) expect(p.board[c], `given ${c}`).toBe(st.givens[c]);
        if (p.board[c] !== 0) expect(p.board[c], `cell ${c} seat ${i}`).toBe(st.solution[c]);
      }
    }
    // progress bookkeeping
    let placed = 0;
    for (let c = 0; c < 81; c++) if (p.board[c] !== 0) placed++;
    expect(p.progress).toBe(placed - initial.givensCount);
    // seals bounded
    expect(p.seals).toBeGreaterThanOrEqual(0);
    expect(p.seals).toBeLessThanOrEqual(Math.max(CONFIG.seals.start, initial.seals[i]));
    expect(Number.isInteger(p.seals)).toBe(true);
    // mistakes ledger: three units are marked per mistake
    const unitSum = Object.values(p.mistakesByUnit).reduce((a, b) => a + b, 0);
    expect(unitSum).toBe(p.mistakes * 3);
    // claims ↔ unitOwner
    expect(new Set(p.claimed).size).toBe(p.claimed.length);
    for (const u of p.claimed) expect(st.unitOwner[u]).toBe(i);
    const mine = allUnits().filter((u) => st.unitOwner[u] === i).length;
    expect(p.claimed.length).toBe(mine);
    // abilities
    for (const rt of Object.values(p.abilities)) {
      expect(rt.cdLeftMs).toBeGreaterThanOrEqual(0);
      if (rt.usesLeft !== null) expect(rt.usesLeft).toBeGreaterThanOrEqual(0);
    }
    // statuses: type-unique, well-formed
    const seen = new Set<string>();
    for (const s of p.statuses) {
      expect(seen.has(s.type)).toBe(false);
      seen.add(s.type);
      expect(Number.isInteger(s.endsAtMs)).toBe(true);
      expect(s.endsAtMs).toBeGreaterThan(0);
      expect(s.uid).toBeGreaterThanOrEqual(1);
      expect(s.uid).toBeLessThan(st.statusUid);
      if (s.cells) for (const c of s.cells) { expect(c).toBeGreaterThanOrEqual(0); expect(c).toBeLessThanOrEqual(80); }
      if (s.unit !== undefined) expect(UNIT_CELLS[s.unit], `unit ${s.unit}`).toBeDefined();
    }
    // immunity keys are status types, values finite
    for (const [k, v] of Object.entries(p.immuneUntil)) {
      expect(STATUS_TYPES).toContain(k as never);
      expect(Number.isFinite(v)).toBe(true);
    }
  }

  // phase / winner consistency
  if (st.phase === 'ended') {
    expect(st.winner).not.toBeNull();
    expect(['seals', 'reckoning', 'suddenJudgment', 'forfeit']).toContain(st.winReason as never);
    if (st.winReason === 'seals' && st.winner !== 'draw') {
      expect(st.players[st.winner === 0 ? 1 : 0].seals).toBe(0);
    }
    if (st.winReason === 'reckoning' && st.winner !== 'draw' && st.winner !== null) {
      expect(st.players[st.winner].board.every((v) => v !== 0)).toBe(true);
    }
    if (st.winReason === 'suddenJudgment') expect(st.clockMs).toBeGreaterThanOrEqual(st.durationMs);
  } else {
    expect(st.winner).toBeNull();
    expect(st.winReason).toBeNull();
  }

  // event log integrity (retained window)
  expect(st.events.length).toBeLessThanOrEqual(120);
  for (let i = 1; i < st.events.length; i++) {
    expect(st.events[i].seq).toBe(st.events[i - 1].seq + 1);
    expect(st.events[i].atMs).toBeGreaterThanOrEqual(st.events[i - 1].atMs);
  }
  const last = st.events[st.events.length - 1];
  expect(st.eventSeq).toBe((last ? last.seq : 0) + 1);
};

describe('I+D · seeded fuzz duels — invariants after every step, determinism across runs', () => {
  const SEATS: Array<[OrderId, OrderId]> = [
    ['scholar', 'executioner'], ['executioner', 'apothecary'], ['apothecary', 'warden'],
    ['warden', 'scholar'], ['scholar', 'scholar'], ['warden', 'warden'],
  ];

  for (let f = 0; f < 120; f++) {
    it(`fuzz duel ${f}: invariants hold and two runs serialize identically`, () => {
      const script = buildScript(new Rng(`fuzz-${f}`), 240);
      const orders = SEATS[f % SEATS.length];
      const puzzleIdx = f % PUZZLES.length;
      const all = allUnits();

      const run = (): string => {
        const st = mkDuel({ seed: `fuzz-${f}`, orders }, puzzleIdx);
        const initial = {
          seals: [st.players[0].seals, st.players[1].seals] as [number, number],
          givensCount: PUZZLES[puzzleIdx].givensCount,
        };
        const rng = new Rng(`exec-${f}`);
        for (const s of script) {
          execStep(st, s, rng, all);
          checkInvariants(st, initial);
          if (st.phase === 'ended') break;
        }
        return serializeDuel(st);
      };

      const a = run();
      const b = run();
      expect(b).toBe(a);
    });
  }

  it('different seeds produce different duels (determinism is not degeneracy)', () => {
    const script = buildScript(new Rng('cross-seed'), 200);
    const finals: string[] = [];
    for (let f = 0; f < 10; f++) {
      const st = mkDuel({ seed: `cross-${f}`, orders: ['scholar', 'executioner'] }, f % PUZZLES.length);
      const rng = new Rng(`exec-${f}`);
      const all = allUnits();
      for (const s of script) {
        execStep(st, s, rng, all);
        if (st.phase === 'ended') break;
      }
      finals.push(serializeDuel(st));
    }
    const differ = finals.filter((v, i) => i > 0 && v !== finals[i - 1]).length;
    expect(differ).toBeGreaterThanOrEqual(8);
  });
});

// ================================================================== S. status matrix
describe('S · status interaction matrix — every negation path pinned', () => {
  it('S1 Bulwark negates exactly the first incoming status, then never again', () => {
    const st = mkDuel({ orders: ['warden', 'executioner'] });
    useAbility(st, 1, 'hush');
    expect(st.players[0].statuses.length).toBe(0);
    expect(st.players[0].bulwarkUsed).toBe(true);
    st.players[1].abilities.hush.cdLeftMs = 0;
    const r2 = useAbility(st, 1, 'hush');
    expect(r2.applied).toBe(true); // gap NOT consumed by the negated cast
    expect(st.players[0].statuses.some((s) => s.type === 'hush')).toBe(true);
    st.players[1].abilities.hush.cdLeftMs = 0;
    tick(st, 7600); // hush expired (2500); expiry tick stamps immunity 7600+5000 = 12600
    tick(st, 5100); // 12700: immunity (until 12600) spent, gap long past
    st.players[1].abilities.hush.cdLeftMs = 0;
    expect(useAbility(st, 1, 'hush').applied).toBe(true);
    expect(st.players[0].statuses.some((s) => s.type === 'hush')).toBe(true);
  });

  it('S2 Ward eats one status inside its 15s window and expires cleanly', () => {
    const st = mkDuel({ orders: ['warden', 'executioner'] });
    st.players[0].bulwarkUsed = true; // the once-per-duel passive outranks the armed window
    useAbility(st, 0, 'ward');
    expect(useAbility(st, 1, 'hush').applied).toBe(false);
    expect(st.players[0].wardUntilMs).toBe(0); // window consumed
    st.players[1].abilities.hush.cdLeftMs = 0;
    expect(useAbility(st, 1, 'hush').applied).toBe(true);
    // after the window, statuses land again
    const st2 = mkDuel({ orders: ['warden', 'executioner'] });
    st2.players[0].bulwarkUsed = true;
    useAbility(st2, 0, 'ward');
    tick(st2, 15_500);
    st2.players[1].abilities.hush.cdLeftMs = 0;
    expect(useAbility(st2, 1, 'hush').applied).toBe(true);
  });

  it('S3 Mirror reflects inside 10s: the caster wears their own smudge, window consumed', () => {
    const st = mkDuel({ orders: ['warden', 'apothecary'] });
    // smudge needs PLACED digits on its target's tablet — the target is p0
    for (let i = 0; i < 6; i++) { const c = firstEmpty(st, 0); if (c < 0) break; place(st, 0, c, st.solution![c] as Digit); }
    useAbility(st, 0, 'mirror');
    const r = useAbility(st, 1, 'smudge');
    expect(r.statusReflected ?? true).toBe(true);
    expect(st.players[0].statuses.length).toBe(0);
    expect(st.players[1].statuses.some((s) => s.type === 'smudge')).toBe(true);
    expect(st.players[0].mirrorUntilMs).toBe(0);
  });

  it('S4 reflected status is "incoming" for the caster too: their own Bulwark eats the reflection', () => {
    const st = mkDuel({ orders: ['warden', 'warden'] });
    // a warden cannot cast smudge (no Order has both), so the caster uses the primitive
    for (let i = 0; i < 6; i++) { const c = firstEmpty(st, 0); if (c < 0) break; place(st, 0, c, st.solution![c] as Digit); }
    useAbility(st, 0, 'mirror');
    const r = applyStatus(st, 1, 'smudge', 0, { cells: [firstEmpty(st, 0), firstEmpty(st, 0)] });
    expect(r.applied).toBe(false);
    expect(st.players[0].statuses.length).toBe(0);
    expect(st.players[1].statuses.length).toBe(0);
    expect(st.players[1].bulwarkUsed).toBe(true); // spent on their own reflected status
  });

  it('S5 the 4s global gap counts successful applications only — negated casts do not open it', () => {
    const st = mkDuel({ orders: ['warden', 'executioner'] });
    useAbility(st, 1, 'hush'); // negated by Bulwark at clock 0
    expect(st.lastStatusAtMs).toBe(-CONFIG.duel.statusGlobalGapMs); // unchanged
    st.players[1].abilities.hush.cdLeftMs = 0;
    expect(useAbility(st, 1, 'hush').applied).toBe(true); // lands immediately
    st.players[1].abilities.sever.cdLeftMs = 0;
    expect(useAbility(st, 1, 'sever').applied).toBe(false); // gap now active
    tick(st, 4000);
    st.players[1].abilities.sever.cdLeftMs = 0;
    expect(useAbility(st, 1, 'sever').applied).toBe(true);
  });

  it('S6 immunity after expiry is per-type for exactly 5s; other types unaffected', () => {
    const st = mkDuel({ orders: ['scholar', 'executioner'] });
    useAbility(st, 1, 'sever'); // chain on p0
    tick(st, 8000);
    expect(st.players[0].statuses.length).toBe(0);
    expect(st.players[0].immuneUntil.chain).toBe(13_000);
    st.players[1].abilities.sever.cdLeftMs = 0;
    tick(st, 100); // 8100: still inside chain immunity + gap window needs 4s since 8000
    tick(st, 3100); // 11200: gap satisfied, immunity (until 13000) still holds
    expect(useAbility(st, 1, 'sever').applied).toBe(false);
    tick(st, 1900); // 13100
    st.players[1].abilities.sever.cdLeftMs = 0;
    expect(useAbility(st, 1, 'sever').applied).toBe(true);
  });

  it('S7 statuses never apply in the final 10s (Sudden Judgment honesty window)', () => {
    const st = mkDuel();
    tick(st, st.durationMs - CONFIG.duel.finalStatusBanMs + 1);
    expect(applyStatus(st, 0, 'hush', 1).applied).toBe(false);
    tick(st, 1);
    expect(applyStatus(st, 0, 'hush', 1).applied).toBe(false);
    // earlier than the ban window it works
    const st2 = mkDuel();
    tick(st2, st2.durationMs - CONFIG.duel.finalStatusBanMs - 5000);
    expect(applyStatus(st2, 0, 'hush', 1).applied).toBe(true);
  });

  it('S8 Distiller extends only smudge and miasma, by exactly 2s', () => {
    const st = mkDuel({ orders: ['scholar', 'apothecary'] });
    for (let i = 0; i < 6; i++) { const c = firstEmpty(st, 0); if (c < 0) break; place(st, 0, c, st.solution![c] as Digit); }
    useAbility(st, 1, 'smudge');
    expect(st.players[0].statuses.find((s) => s.type === 'smudge')!.endsAtMs).toBe(9000);
    tick(st, 4100); // clear gap
    st.players[1].abilities.miasma.cdLeftMs = 0;
    useAbility(st, 1, 'miasma');
    expect(st.players[0].statuses.find((s) => s.type === 'miasma')!.endsAtMs).toBe(16_100); // 4100 + 10000 + 2000
    // chain gets NO bonus even from an apothecary caster
    const st2 = mkDuel({ orders: ['scholar', 'apothecary'] });
    expect(applyStatus(st2, 1, 'chain', 0, { cell: 1 }).applied).toBe(true);
    expect(st2.players[0].statuses.find((s) => s.type === 'chain')!.endsAtMs).toBe(8000); // no bonus
  });

  it('S9 one active instance per type per player', () => {
    const st = mkDuel();
    expect(applyStatus(st, 0, 'chain', 1, { cell: 1 }).applied).toBe(true);
    expect(applyStatus(st, 0, 'chain', 1, { cell: 2 }).applied).toBe(false);
    expect(st.players[1].statuses.filter((s) => s.type === 'chain')).toHaveLength(1);
    // different types coexist
    tick(st, 4100);
    expect(applyStatus(st, 0, 'hush', 1).applied).toBe(true);
    expect(st.players[1].statuses).toHaveLength(2);
  });
});

// ================================================================== C. clock & judgment
describe('C · clock, flinch, momentum, Sudden Judgment', () => {
  it('C1 Flinch freezes cooldowns for exactly 3s, then they resume', () => {
    const st = mkDuel({ orders: ['scholar', 'executioner'] });
    useAbility(st, 0, 'augur', { cell: firstEmpty(st) }); // cd 20000
    place(st, 0, firstEmpty(st), wrongDigitFor(st, firstEmpty(st))); // flinch until 3000
    const frozen = st.players[0].abilities.augur.cdLeftMs;
    tick(st, 1000);
    expect(st.players[0].abilities.augur.cdLeftMs).toBe(frozen); // inside flinch
    tick(st, 1900);
    expect(st.players[0].abilities.augur.cdLeftMs).toBe(frozen); // still inside (2900 < 3000)
    tick(st, 200);
    const unfrozenAt = st.players[0].abilities.augur.cdLeftMs;
    expect(unfrozenAt).toBeLessThan(frozen); // 3100: 100ms deducted
    tick(st, 500);
    expect(st.players[0].abilities.augur.cdLeftMs).toBe(unfrozenAt - 500);
  });

  it('C2 Momentum shaves exactly 500ms per correct placement and floors at 0', () => {
    const st = mkDuel({ orders: ['scholar', 'executioner'] });
    st.players[0].seals = 99; st.players[1].seals = 99; // outlive the claims the loop generates
    useAbility(st, 0, 'augur', { cell: firstEmpty(st) }); // 20000
    expect(st.players[0].abilities.augur.cdLeftMs).toBe(20_000);
    for (let i = 0; i < 10; i++) {
      const c = firstEmpty(st);
      const r = place(st, 0, c, st.solution![c] as Digit);
      expect(r.ok && r.correct).toBe(true);
    }
    expect(st.players[0].abilities.augur.cdLeftMs).toBe(15_000);
    for (let i = 0; i < 40; i++) {
      const c = firstEmpty(st);
      if (c < 0) break;
      place(st, 0, c, st.solution![c] as Digit);
    }
    expect(st.players[0].abilities.augur.cdLeftMs).toBe(0);
  });

  it('C3 Momentum does not apply to mistakes', () => {
    const st = mkDuel({ orders: ['scholar', 'executioner'] });
    useAbility(st, 0, 'augur', { cell: firstEmpty(st) });
    const before = st.players[0].abilities.augur.cdLeftMs;
    place(st, 0, firstEmpty(st), wrongDigitFor(st, firstEmpty(st)));
    expect(st.players[0].abilities.augur.cdLeftMs).toBe(before);
  });

  it('C4 Sudden Judgment precedence: seals, then claims, then mistakes, then draw', () => {
    // seals decide
    const a = mkDuel();
    a.players[0].seals = 3; a.players[1].seals = 5;
    a.players[1].claimed.push('r0'); // claims would favour 1
    a.players[1].mistakes = 0; a.players[0].mistakes = 9; // mistakes favour 1
    tick(a, a.durationMs + 1);
    expect(`${a.winner}:${a.winReason}`).toBe('1:suddenJudgment');
    // seals tie -> claims decide
    const b = mkDuel();
    b.players[0].claimed.push('r0');
    tick(b, b.durationMs + 1);
    expect(`${b.winner}:${b.winReason}`).toBe('0:suddenJudgment');
    // seals + claims tie -> mistakes decide
    const c = mkDuel();
    c.players[1].mistakes = 2;
    tick(c, c.durationMs + 1);
    expect(`${c.winner}:${c.winReason}`).toBe('0:suddenJudgment');
    // full tie -> draw
    const d = mkDuel();
    tick(d, d.durationMs + 1);
    expect(`${d.winner}:${d.winReason}`).toBe('draw:suddenJudgment');
  });

  it('C5 seal-death wins the moment it happens, even against a same-placement board completion', () => {
    const st = mkDuel({ orders: ['executioner', 'scholar'] });
    st.players[1].seals = 1;
    st.players[0].reckoningUntilMs = st.clockMs + 10_000;
    // complete a row while the foe sits at 1 Seal: claim damage (2-3) kills first
    const sol = st.solution!;
    for (let c = 0; c < 9; c++) if (st.givens[c] === 0) place(st, 0, c, sol[c] as Digit);
    expect(st.phase).toBe('ended');
    expect(st.winReason).toBe('seals');
    expect(st.winner).toBe(0);
  });

  it('C6 ending is idempotent: extra ticks and extra resigns cannot change the outcome', () => {
    const st = mkDuel();
    resign(st, 1);
    const snap = serializeDuel(st);
    tick(st, 10_000);
    resign(st, 0);
    resign(st, 1);
    place(st, 0, firstEmpty(st), 5 as Digit);
    useAbility(st, 0, 'unseal');
    expect(serializeDuel(st)).toBe(snap);
  });

  it('C7 tick(0) is a safe no-op; fractional ticks accumulate without drift', () => {
    const st = mkDuel();
    tick(st, 0);
    expect(st.clockMs).toBe(0);
    for (let i = 0; i < 100; i++) tick(st, 0.5);
    expect(st.clockMs).toBeCloseTo(50, 5);
  });
});

// ================================================================== A. abilities
describe('A · ability contracts with explicitly-built preconditions', () => {
  it('A1 all 12 abilities cast with exact first-use cooldowns (preconditions explicit, no luck)', () => {
    for (const [order, abilities] of Object.entries(ORDER_ABILITIES)) {
      const st = mkDuel({ orders: [order as OrderId, 'executioner'] });
      // give the caster raw material: their own placements for smudge/sever targets
      for (let i = 0; i < 6; i++) { const c = firstEmpty(st, 1); if (c < 0) break; place(st, 1, c, st.solution![c] as Digit); }
      for (const id of abilities as AbilityId[]) {
        if (id === 'tincture') st.players[0].seals = 5; // EXPLICIT: below the cap (the shipped suite passed this by luck)
        const arg: { cell?: number; unit?: UnitId } = {};
        if (id === 'augur' || id === 'fairCopy') arg.cell = firstEmpty(st);
        if (id === 'quarantine') arg.unit = 'r1';
        const r = useAbility(st, 0, id, arg);
        expect(r.ok, `${order}/${id} must cast`).toBe(true);
        const full = CONFIG.abilityCdMs[id];
        expect(st.players[0].abilities[id].cdLeftMs, `${order}/${id} first-use cd`).toBe(Math.round(full * CONFIG.abilities.firstUseCooldownFactor));
        expect(st.players[0].abilities[id].usedOnce).toBe(true);
      }
    }
  });

  it('A2 Tincture: refused at cap, +1 below cap, exactly 2 uses, third refused', () => {
    const st = mkDuel({ orders: ['apothecary', 'executioner'] });
    st.players[0].seals = CONFIG.seals.tinctureCap;
    expect(useAbility(st, 0, 'tincture').ok).toBe(false);
    expect(st.players[0].abilities.tincture.usesLeft).toBe(2);
    st.players[0].seals = 4;
    expect(useAbility(st, 0, 'tincture').ok).toBe(true);
    expect(st.players[0].seals).toBe(5);
    st.players[0].abilities.tincture.cdLeftMs = 0;
    expect(useAbility(st, 0, 'tincture').ok).toBe(true);
    expect(st.players[0].seals).toBe(6);
    expect(st.players[0].abilities.tincture.usesLeft).toBe(0);
    st.players[0].abilities.tincture.cdLeftMs = 0;
    expect(useAbility(st, 0, 'tincture').reason).toBe('noUses');
    expect(st.players[0].seals).toBe(6);
  });

  it('A3 Unseal clears every status and grants 6s per-type immunity; the count is logged', () => {
    const st = mkDuel({ orders: ['scholar', 'executioner'] });
    applyStatus(st, 1, 'chain', 0, { cell: 2 });
    tick(st, 4100);
    applyStatus(st, 1, 'hush', 0);
    const r = useAbility(st, 0, 'unseal');
    expect(r.ok).toBe(true);
    expect(st.players[0].statuses.length).toBe(0);
    expect(st.players[0].immuneUntil.chain).toBe(10_100); // unseal at clock 4100 + 6s
    expect(st.players[0].immuneUntil.hush).toBe(10_100);
    const ev = st.events.find((e) => e.kind === 'ability' && e.ability === 'unseal') as { cleared?: number } | undefined;
    expect(ev?.cleared).toBe(2);
  });

  it('A4 Augur voids Clean for exactly the three units of the revealed cell and logs the true digit', () => {
    const st = mkDuel({ orders: ['scholar', 'executioner'] });
    const cell = firstEmpty(st);
    const r = useAbility(st, 0, 'augur', { cell });
    expect(r.ok).toBe(true);
    const ev = st.events.find((e) => e.kind === 'ability' && e.ability === 'augur') as { digit?: number } | undefined;
    expect(ev?.digit).toBe(st.solution![cell]);
    for (const u of CELL_UNITS(cell)) expect(st.players[0].augurRevealed[u]).toBe(true);
    const other = allUnits().find((u) => !CELL_UNITS(cell).includes(u))!;
    expect(st.players[0].augurRevealed[other]).toBeUndefined();
  });

  it('A5 Fair Copy candidates are sound: every candidate set contains the true digit and contradicts nothing', () => {
    const st = mkDuel({ orders: ['scholar', 'executioner'] });
    for (let i = 0; i < 8; i++) { const c = firstEmpty(st); if (c < 0) break; place(st, 0, c, st.solution![c] as Digit); }
    const someBoxCell = UNIT_CELLS['b4'].find((c) => st.players[0].board[c] === 0) ?? firstEmpty(st);
    const r = useAbility(st, 0, 'fairCopy', { cell: someBoxCell });
    expect(r.ok).toBe(true);
    const ev = st.events.find((e) => e.kind === 'ability' && e.ability === 'fairCopy') as { candidates?: Record<string, number[]> } | undefined;
    expect(ev?.candidates).toBeTruthy();
    const box = CELL_UNITS(someBoxCell)[2];
    for (const c of UNIT_CELLS[box]) {
      if (st.players[0].board[c] !== 0) continue;
      const cands = ev!.candidates![c];
      expect(Array.isArray(cands)).toBe(true);
      expect(cands.length).toBeGreaterThan(0);
      expect(cands).toContain(st.solution![c]); // soundness: truth is never eliminated
      expect(new Set(cands).size).toBe(cands.length); // no duplicates
    }
  });

  it('A6 Sever chains a cell of the most complete unclaimed foe unit; only that cell is locked', () => {
    const st = mkDuel({ orders: ['executioner', 'scholar'] }); // the caster must wear the Axe
    expect(useAbility(st, 0, 'sever').ok).toBe(true);
    const chain = st.players[1].statuses.find((s) => s.type === 'chain');
    expect(chain).toBeTruthy();
    expect(chain!.cell).toBeGreaterThanOrEqual(0);
    expect(place(st, 1, chain!.cell!, st.solution![chain!.cell!] as Digit).reason).toBe('chained');
    // a different empty cell in the same unit is fine
    const unitCells = CELL_UNITS(chain!.cell!);
    const other = unitCells.map((u) => UNIT_CELLS[u]).flat().find((c) => st.players[1].board[c] === 0 && c !== chain!.cell);
    if (other !== undefined) {
      expect(place(st, 1, other, st.solution![other] as Digit).ok).toBe(true);
    }
  });

  it('A7 Hush blocks every placement including correct ones; Reckoning adds +1 to exactly one claim', () => {
    const st = mkDuel({ orders: ['scholar', 'executioner'] });
    useAbility(st, 1, 'hush');
    expect(place(st, 0, firstEmpty(st), st.solution![firstEmpty(st)] as Digit).reason).toBe('hushed');

    const st2 = mkDuel({ orders: ['executioner', 'scholar'] });
    useAbility(st2, 0, 'reckoning');
    expect(st2.players[0].reckoningUntilMs).toBe(CONFIG.abilityCdMs.reckoningWindowMs);
    for (let c = 0; c < 9; c++) if (st2.givens[c] === 0) place(st2, 0, c, st2.solution![c] as Digit);
    const claim = st2.events.find((e) => e.kind === 'claim' && e.unit === 'r0') as unknown as { damage: number; clean: boolean };
    expect(claim.damage).toBe(claim.clean ? 3 : 2); // base(+clean) + reckoning
    // consumed: a second claim gets no bonus
    for (let c = 9; c < 18; c++) if (st2.givens[c] === 0) place(st2, 0, c, st2.solution![c] as Digit);
    const claim2 = st2.events.find((e) => e.kind === 'claim' && e.unit === 'r1') as unknown as { damage: number; clean: boolean } | undefined;
    if (claim2) expect(claim2.damage).toBe(claim2.clean ? 2 : 1);
  });

  it('A8 casting into a negated window burns cooldown AND use — pinned as intended (information cost)', () => {
    const st = mkDuel({ orders: ['warden', 'apothecary'] });
    for (let i = 0; i < 5; i++) { const c = firstEmpty(st, 0); if (c < 0) break; place(st, 0, c, st.solution![c] as Digit); }
    st.players[1].seals = 4; // make tincture meaningful
    const r = useAbility(st, 1, 'smudge');
    expect(r.applied).toBe(false); // Bulwark ate it
    expect(st.players[1].abilities.smudge.usedOnce).toBe(true);
    expect(st.players[1].abilities.smudge.cdLeftMs).toBe(Math.round(CONFIG.abilityCdMs.smudge * 0.5));
  });

  it('A9 rejected casts never consume cooldown, uses, or RNG state advancement visible in output', () => {
    const st = mkDuel({ orders: ['scholar', 'executioner'] });
    const rngBefore = st.rngState;
    expect(useAbility(st, 0, 'sever').reason).toBe('wrongOrder');
    expect(st.rngState).toBe(rngBefore);
    expect(useAbility(st, 0, 'blast' as unknown as AbilityId).ok).toBe(false);
    expect(st.rngState).toBe(rngBefore);
  });
});

// ================================================================== W. swap
describe('W · swapOrder primitives cannot corrupt state or resurrect spent defenses', () => {
  it('W1 swap rebuilds runtimes but preserves earned/suffered state exactly', () => {
    const st = mkDuel({ orders: ['scholar', 'executioner'] });
    const p = st.players[0];
    place(st, 0, firstEmpty(st), wrongDigitFor(st, firstEmpty(st))); // mistake (forgiven by Marginalia)
    applyStatus(st, 1, 'chain', 0, { cell: 3 });
    p.immuneUntil.hush = 5000;
    const seals = p.seals, mistakes = p.mistakes;
    expect(swapOrder(st, 0, 'warden')).toBe(true);
    expect(p.order).toBe('warden');
    expect(Object.keys(p.abilities).sort()).toEqual(['mirror', 'quarantine', 'ward']);
    expect(p.seals).toBe(seals);
    expect(p.mistakes).toBe(mistakes);
    expect(p.statuses.some((s) => s.type === 'chain')).toBe(true);
    expect(p.immuneUntil.hush).toBe(5000);
    expect(p.marginaliaUsed).toBe(false); // unworn again
  });

  it('W2 Marginalia returns unworn: the forgiven mistake allowance is granted again after a swap', () => {
    const st = mkDuel({ orders: ['scholar', 'executioner'] });
    place(st, 0, firstEmpty(st), wrongDigitFor(st, firstEmpty(st)));
    expect(st.players[0].seals).toBe(7); // forgiven
    expect(swapOrder(st, 0, 'executioner')).toBe(true);
    expect(swapOrder(st, 0, 'scholar')).toBe(true);
    expect(st.players[0].marginaliaUsed).toBe(false);
    place(st, 0, firstEmpty(st), wrongDigitFor(st, firstEmpty(st)));
    expect(st.players[0].seals).toBe(7); // forgiven AGAIN by the fresh passive
    place(st, 0, firstEmpty(st), wrongDigitFor(st, firstEmpty(st)));
    expect(st.players[0].seals).toBe(6);
  });

  it('W3 outgoing windows lapse: armed Reckoning dies with the Axe', () => {
    const st = mkDuel({ orders: ['executioner', 'scholar'] });
    useAbility(st, 0, 'reckoning');
    expect(st.players[0].reckoningUntilMs).toBeGreaterThan(0);
    expect(swapOrder(st, 0, 'warden')).toBe(true);
    expect(st.players[0].reckoningUntilMs).toBe(0);
    useAbility(st, 0, 'ward');
    expect(st.players[0].wardUntilMs).toBeGreaterThan(0);
    expect(swapOrder(st, 0, 'apothecary')).toBe(true);
    expect(st.players[0].wardUntilMs).toBe(0);
  });

  it('W4 a chain of swaps is legal at engine level and keeps every invariant (policy lives in the runtime)', () => {
    const st = mkDuel();
    const seen = new Set<OrderId>();
    let current = st.players[0].order;
    for (const to of ['apothecary', 'warden', 'scholar', 'executioner'] as OrderId[]) {
      expect(swapOrder(st, 0, to)).toBe(true);
      current = to;
      seen.add(current);
      expect(Object.keys(st.players[0].abilities).sort()).toEqual([...ORDER_ABILITIES[current]].sort());
      expect(st.players[0].board.length).toBe(81);
    }
    expect(seen.size).toBe(4);
  });
});

// ================================================================== X. serialization
describe('X · serialization round-trips byte-identically on rich mid-duel states', () => {
  it('X1 full-fidelity round trip: statuses, pendingClaim, immunity, swap, long event log', () => {
    const st = mkDuel({ orders: ['executioner', 'warden'], magistrateSeals: [8, 8] }, 2);
    st.players[0].seals = 99; st.players[1].seals = 99; // nobody dies; we need a long living duel
    // long log: 20 placements, then quarantine row 7 BEFORE completing it
    for (let i = 0; i < 20; i++) { const c = firstEmpty(st, 0); if (c < 0) break; place(st, 0, c, st.solution![c] as Digit); }
    applyStatus(st, 1, 'quarantine', 0, { unit: 'r7' });
    for (let i = 0; i < 30; i++) {
      if (UNIT_CELLS['r7'].every((c) => st.players[0].board[c] !== 0)) break;
      const c = firstEmpty(st, 0);
      if (c < 0) break;
      place(st, 0, c, st.solution![c] as Digit);
    }
    const q = st.players[0].statuses.find((s) => s.type === 'quarantine') as { pendingClaim?: unknown } | undefined;
    expect(q?.pendingClaim).toBeTruthy(); // the deferred claim rides on the quarantine status
    // more ink on the foe's tablet only — p0's board stays incomplete so the duel
    // cannot end by Reckoning before the swap below
    for (let i = 0; i < 30; i++) { const c = firstEmpty(st, 1); if (c < 0) break; place(st, 1, c, st.solution![c] as Digit); }
    applyStatus(st, 0, 'chain', 1, { cell: 3 });
    tick(st, 4100);
    applyStatus(st, 0, 'smudge', 1, { cells: [10, 11, 12, 13, 14] });
    useAbility(st, 0, 'reckoning');
    expect(swapOrder(st, 1, 'scholar')).toBe(true);
    expect(st.events.length).toBeGreaterThan(60);

    const s1 = serializeDuel(st);
    const back = deserializeDuel(s1);
    const s2 = serializeDuel(back);
    expect(s2).toBe(s1);
    // and it keeps playing identically after the round trip
    const probe = (d: DuelState) => {
      tick(d, 4000);
      const c = firstEmpty(d, 0);
      if (c >= 0) place(d, 0, c, d.solution![c] as Digit);
      return serializeDuel(d);
    };
    expect(probe(deserializeDuel(s1))).toBe(probe(back));
  });

  it('X2 PvP snapshots (solution: null) round-trip and keep refusing placements', () => {
    const st = mkDuel();
    (st as { solution: Uint8Array | null }).solution = null;
    const back = deserializeDuel(serializeDuel(st));
    expect(back.solution).toBeNull();
    expect(place(back, 0, firstEmpty(back), 5 as Digit).reason).toBe('noSolution');
  });
});
