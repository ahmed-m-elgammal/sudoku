// Probe — hard evidence before the adversarial suite. Every probe tries to BREAK
// the engine the way a hostile client (or a buggy transport) would. bun scripts/probe-engine.ts
import { createDuel, place, useAbility, tick, swapOrder, serializeDuel, deserializeDuel, cellFlags } from '../shared/engine';
import { generatePuzzle } from '../shared/sudoku';
import { Rng } from '../shared/rng';
import { CONFIG } from '../shared/config';

let bugs = 0;
const probe = (name: string, fn: () => string) => {
  try {
    const out = fn();
    console.log(`PROBE ${name}: ${out}`);
  } catch (e) {
    bugs++;
    console.log(`PROBE ${name}: *** CRASH: ${(e as Error).constructor.name}: ${(e as Error).message}`);
  }
};

const fresh = (over: Parameters<typeof createDuel>[0] = {}) => {
  const p = generatePuzzle('probe-seed', 'Easy');
  return createDuel({
    seed: 'probe',
    givens: Uint8Array.from(p.givens),
    solution: Uint8Array.from(p.solution),
    ...over,
  });
};
const firstEmpty = (st: ReturnType<typeof fresh>) => {
  for (let c = 0; c < 81; c++) if (st.players[0].board[c] === 0) return c;
  return -1;
};

// 1. fractional digit passes validation and burns a Seal
probe('place digit=2.5', () => {
  const st = fresh();
  const c = firstEmpty(st);
  const r = place(st, 0, c, 2.5 as never);
  return `ok=${r.ok} correct=${r.correct} seals=${st.players[0].seals} mistakes=${st.players[0].mistakes} board[${c}]=${st.players[0].board[c]}`;
});

// 2. NaN digit passes the range check (NaN < 1 is false, NaN > 9 is false)
probe('place digit=NaN', () => {
  const st = fresh();
  const c = firstEmpty(st);
  const r = place(st, 0, c, NaN as never);
  return `ok=${r.ok} correct=${r.correct} seals=${st.players[0].seals} mistakes=${st.players[0].mistakes}`;
});

// 3. NaN clock poisons the duel permanently
probe('tick(NaN)', () => {
  const st = fresh();
  tick(st, NaN);
  tick(st, 1000);
  return `clock=${st.clockMs} phase=${st.phase} statusesAlive=${st.players[0].statuses.length}`;
});

// 4. negative tick rewinds time
probe('tick(-5000)', () => {
  const st = fresh();
  tick(st, 10_000);
  const before = st.clockMs;
  tick(st, -5000);
  return `clock ${before} -> ${st.clockMs} (time travel=${st.clockMs < before})`;
});

// 5. invalid player index crashes instead of rejecting
probe('place player=2', () => {
  const st = fresh();
  const c = firstEmpty(st);
  const r = place(st, 2 as never, c, 1 as never);
  return `ok=${r.ok}`;
});
probe('useAbility player=-1', () => {
  const st = fresh();
  const r = useAbility(st, -1 as never, 'unseal');
  return `ok=${r.ok}`;
});
probe('cellFlags player=9', () => {
  const st = fresh();
  cellFlags(st, 9 as never);
  return 'no crash';
});

// 6. fairCopy with a NaN cell — UNIT_CELLS['bNaN'] is undefined
probe('fairCopy cell=NaN', () => {
  const st = fresh();
  const r = useAbility(st, 0, 'fairCopy', { cell: NaN });
  return `ok=${r.ok} reason=${r.reason}`;
});

// 7. unknown ability id reports the wrong reason
probe('useAbility id=blast', () => {
  const st = fresh();
  const r = useAbility(st, 0, 'blast' as never);
  return `ok=${r.ok} reason=${r.reason}`;
});

// 8. duels can start with impossible Seals and never end
probe('createDuel seals=[-5,100]', () => {
  const st = fresh({ magistrateSeals: [-5, 100] });
  tick(st, CONFIG.duel.durationMs + 1);
  return `phase=${st.phase} winner=${st.winner} reason=${st.winReason} seals=[${st.players[0].seals},${st.players[1].seals}]`;
});

// 9. quarantine accepts a garbage unit id
probe('quarantine unit=r99', () => {
  const st = fresh();
  const r = useAbility(st, 0, 'quarantine', { unit: 'r99' as never });
  return `ok=${r.ok} statuses=${JSON.stringify(st.players[1].statuses.map((s) => ({ t: s.type, u: s.unit })))}`;
});

// 10. an ability cast into a negated window still burns cooldown + use
probe('tincture burned into bulwark', () => {
  const st = fresh({ orders: ['warden', 'apothecary'] });
  st.players[1].seals = 3; // make tincture castable
  const r = useAbility(st, 1, 'tincture');
  return `ok=${r.ok} usesLeft=${st.players[1].abilities.tincture.usesLeft} cd=${st.players[1].abilities.tincture.cdLeftMs}`;
});

// 11. the tincture precondition in the shipped 'every ability casts' test
probe('tincture at seals=7 (cap)', () => {
  const st = fresh({ orders: ['apothecary', 'executioner'] });
  const r = useAbility(st, 0, 'tincture');
  return `ok=${r.ok} reason=${r.reason} (existing test claims every ability casts from a fresh board)`;
});

// 12. serialize roundtrip fidelity with a live quarantine pendingClaim
probe('roundtrip keeps pendingClaim', () => {
  const st = fresh({ orders: ['warden', 'executioner'] });
  useAbility(st, 0, 'quarantine', { unit: 'r0' });
  const p0 = st.players[0];
  for (let c = 0; c < 9; c++) {
    if (p0.board[c] === 0) {
      const sol = st.solution!;
      const r = place(st, 0, c, sol[c] as never);
      if (!r.ok) return `place failed: ${r.reason}`;
    }
  }
  const q = st.players[0].statuses.find((s) => s.type === 'quarantine') as { pendingClaim?: unknown } | undefined;
  const had = !!q?.pendingClaim;
  const back = deserializeDuel(serializeDuel(st));
  const q2 = back.players[0].statuses.find((s) => s.type === 'quarantine') as { pendingClaim?: unknown } | undefined;
  return `deferred=${had} afterRoundtrip=${!!q2?.pendingClaim}`;
});

// 13. Expert generation wall-time (the 51-green-in-673ms smell)
probe('Expert generation timing', () => {
  const t0 = performance.now();
  const p = generatePuzzle('probe-expert', 'Expert');
  const dt = performance.now() - t0;
  return `grade=${p.grade} givens=${p.givensCount} in ${dt.toFixed(0)}ms`;
});

// 14. countSolutions must not mutate its input
probe('countSolutions purity', () => {
  const p = generatePuzzle('probe-purity', 'Easy');
  const g = Uint8Array.from(p.givens);
  const before = Array.from(g);
  generatePuzzle; // keep import used
  const { countSolutions } = require('../shared/sudoku') as typeof import('../shared/sudoku');
  countSolutions(g, 2);
  const same = before.every((v, i) => g[i] === v);
  return `inputPreserved=${same}`;
});

// 15. Rng.int must stay in [0, n)
probe('Rng.int bounds + shuffle permutation', () => {
  const r = new Rng('probe');
  let bad = 0;
  for (let i = 0; i < 10_000; i++) { const v = r.int(7); if (v < 0 || v >= 7 || !Number.isInteger(v)) bad++; }
  const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  const sh = r.shuffle([...arr]).sort((a, b) => a - b);
  const perm = sh.every((v, i) => v === arr[i]);
  return `intViolations=${bad}/10000 shuffleIsPermutation=${perm}`;
});

// 16. event log window: seq must stay strictly increasing after splices
probe('event seq integrity past 120 events', () => {
  const st = fresh();
  let lastSeq = 0, mono = true;
  for (let i = 0; i < 200; i++) {
    const c = firstEmpty(st);
    if (c < 0) break;
    place(st, 0, c, st.solution![c] as never);
    const evs = st.events;
    for (const e of evs) if (e.seq <= lastSeq) mono = false;
    lastSeq = Math.max(lastSeq, ...evs.map((e) => e.seq));
    if (st.phase !== 'live') break;
  }
  return `monotonicSeq=${mono} keptEvents=${st.events.length} eventSeq=${st.eventSeq}`;
});

// 17. swap legality matrix
probe('swapOrder legality', () => {
  const st = fresh();
  const sameOrder = swapOrder(st, 0, 'scholar');
  const swapped = swapOrder(st, 0, 'apothecary');
  tick(st, CONFIG.duel.durationMs + 1);
  const afterEnd = swapOrder(st, 0, 'warden');
  return `sameOrderRefused=${!sameOrder} swapped=${swapped} afterEndRefused=${!afterEnd}`;
});

// 18. sudden judgment tiebreak order (seals -> claims -> mistakes -> draw)
probe('sudden judgment tiebreak', () => {
  const st = fresh();
  st.players[0].claimed.push('r0');
  tick(st, CONFIG.duel.durationMs + 1);
  const w1 = `${st.winner}/${st.winReason}`;
  const st2 = fresh();
  st2.players[0].mistakes = 3; st2.players[1].mistakes = 5;
  tick(st2, CONFIG.duel.durationMs + 1);
  const w2 = `${st2.winner}/${st2.winReason}`;
  const st3 = fresh();
  tick(st3, CONFIG.duel.durationMs + 1);
  const w3 = `${st3.winner}/${st3.winReason}`;
  return `claims=${w1} mistakes=${w2} full-tie=${w3}`;
});

console.log(bugs === 0 ? 'PROBES DONE (no crashes; check semantic results above)' : `PROBES DONE — ${bugs} crash(es)`);
