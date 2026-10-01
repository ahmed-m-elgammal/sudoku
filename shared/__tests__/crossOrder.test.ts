// T20 — cross-Order boss phases. ADVERSARIAL SUITE. The arc now carries a
// mid-duel Order change; these tests try to break it:
//   · the swap dispatches EXACTLY ONCE, before signatures, and never re-arms
//     (monotonicity under Seal wobble — recovered Seals never re-arm a consumed swap)
//   · the swap rides the ENGINE's atomic swapOrder: runtimes rebuilt, passives
//     unworn, windows lapsed, everything earned or suffered preserved
//   · post-swap signatures resolve against the NEW Order; the OLD Order's rites
//     never cast and never crash
//   · a hostile swapTo matrix (unknown ids, non-strings, garbage) never swaps, never throws
//   · a swapTo on the ENTRY phase is ignored — a Magistrate arrives as announced
//   · same-Order pending swaps are dropped silently, no event, no fizzled action
//   · determinism: byte-identical duels for identical seeds through the swap
//   · LocalDuel runtime parity: order flips mid-duel, the brass banner shows,
//     the duel reaches judgment
import { describe, it, expect } from 'vitest';
import {
  createDuel, tick, place, useAbility, serializeDuel, swapOrder, deserializeDuel,
  type DuelState,
} from '../engine';
import { Rng } from '../rng';
import { generatePuzzle } from '../sudoku';
import { CONFIG, ORDER_ABILITIES, type Digit, type OrderId } from '../config';
import {
  bossAct, newBossScriptState, advancePhase, BOSS_SCRIPTS,
  type BossScript, type BossScriptState,
} from '../phaseScript';
import { clampProfile, profileForStanding } from '../shade';
import { FOLIOS } from '../orders';
import { LocalDuel } from '../../src/game/localDuel';

const ME: 1 = 1;

const baseProfile = () => clampProfile({
  ...profileForStanding(1000),
  name: 'Test Boss', order: 'executioner' as const,
});

const mkDuel = (seed: string, foeOrder: OrderId = 'executioner'): DuelState => {
  const puz = generatePuzzle(seed, 'Easy');
  return createDuel({
    seed,
    givens: Uint8Array.from(puz.givens),
    solution: Uint8Array.from(puz.solution),
    names: ['You', 'Boss'],
    orders: ['scholar', foeOrder],
  });
};

// a modest but honest human on seat 0
let humanCellCursor = 0;
const driveStep = (st: DuelState, rand: Rng): void => {
  const me = st.players[0];
  if (st.phase !== 'live') return;
  const empties: number[] = [];
  for (let c = 0; c < 81; c++) if (me.board[c] === 0) empties.push(c);
  if (empties.length && rand.next() < 0.7) {
    const c = empties[Math.floor(rand.next() * empties.length)];
    place(st, 0, c, st.solution![c] as Digit);
  }
};

// the desperation arc under test: entry → press → swap at ownSealsBelow 3
const SWAP_ARC: BossScript = {
  id: 'probe-cross',
  phases: [
    { when: {} },
    { when: { ownClaimsAtLeast: 1 }, patch: { aggressionAdd: 0.1 }, signature: [{ id: 'hush' }] },
    { when: { ownSealsBelow: 3 }, patch: { paceFactor: 0.9 }, swapTo: 'warden', signature: [{ id: 'ward' }] },
  ],
};

describe('CO · the cross-Order swap dispatches once, before everything else', () => {
  it('CO1 the swap action is returned exactly once, then never again', () => {
    const st = mkDuel('co1');
    const sst = newBossScriptState();
    const rng = new Rng('co1');
    // walk the ladder lawfully to the swap phase
    st.players[1].claimed.push('r0');           // phase 1
    st.players[1].seals = 2;                    // phase 2 (swap)
    advancePhase(SWAP_ARC, sst, st, ME);
    expect(sst.phaseIdx).toBe(2);
    expect(sst.pendingSwap).toBe('warden');
    let swaps = 0;
    for (let i = 0; i < 60 && st.phase === 'live'; i++) {
      if (st.players[1].seals < 2) st.players[1].seals = 2; // hold the phase
      if (st.players[0].seals < 7) st.players[0].seals = 7; // the probe is not a real duel
      const act = bossAct(SWAP_ARC, sst, st, ME, baseProfile(), () => rng.next(), 0);
      if (act.kind === 'swap') {
        swaps++;
        expect(act.to).toBe('warden');
        swapOrder(st, ME, act.to); // apply like the runtime does
      } else if (act.kind === 'place') place(st, ME, act.cell, act.digit);
      else if (act.kind === 'ability') useAbility(st, ME, act.id, { cell: act.cell, unit: act.unit });
      driveStep(st, rng);
      tick(st, 400);
      expect(st.players[1].order).toBe('warden'); // stays swapped
    }
    expect(swaps).toBe(1); // one-shot semantics
    expect(sst.pendingSwap ?? null).toBe(null);
  });

  it('CO2 recovered Seals never re-arm a consumed swap (the ladder never regresses)', () => {
    const st = mkDuel('co2');
    const sst = newBossScriptState();
    st.players[1].claimed.push('r0'); // phase 1 — the ladder never skips a rung
    st.players[1].seals = 2;
    advancePhase(SWAP_ARC, sst, st, ME);
    expect(sst.pendingSwap).toBe('warden');
    const act = bossAct(SWAP_ARC, sst, st, ME, baseProfile(), () => 0.5, 0);
    expect(act.kind).toBe('swap');
    swapOrder(st, ME, (act as { kind: 'swap'; to: OrderId }).to);
    // the state "recovers" — a wobble the real engine cannot produce
    st.players[1].seals = 8;
    const rng = new Rng('co2');
    for (let i = 0; i < 30; i++) {
      const a = bossAct(SWAP_ARC, sst, st, ME, baseProfile(), () => rng.next(), 0);
      expect(a.kind).not.toBe('swap');
      if (a.kind === 'place') place(st, ME, a.cell, a.digit);
      else if (a.kind === 'ability') useAbility(st, ME, a.id, { cell: a.cell, unit: a.unit });
      st.players[1].seals = 8; // keep the wobble alive
      tick(st, 400);
    }
    expect(st.players[1].order).toBe('warden');
  });

  it('CO3 the swap outranks the phase signature on the entry wake', () => {
    const st = mkDuel('co3', 'executioner');
    const sst = newBossScriptState();
    st.players[1].claimed.push('r0');
    st.players[1].seals = 1;
    advancePhase(SWAP_ARC, sst, st, ME); // phase 2 armed: swap + ward signature
    expect(sst.pendingSwap).toBe('warden');
    expect(sst.pendingSig?.some((s) => s.id === 'ward')).toBe(true);
    // the FIRST wake must be the swap, not the rite, not a placement
    const first = bossAct(SWAP_ARC, sst, st, ME, baseProfile(), () => 0.5, 0);
    expect(first.kind).toBe('swap');
  });
});

describe('CO · the swap rides the engine\u2019s atomic swapOrder', () => {
  it('CO4 runtimes are rebuilt, passives unworn, windows lapsed, state preserved', () => {
    const st = mkDuel('co4', 'executioner');
    const boss = st.players[1];
    boss.seals = 2;
    boss.marginaliaUsed = false; boss.bulwarkUsed = false;
    boss.abilities['sever'].cdLeftMs = 12_345;
    boss.abilities['sever'].usedOnce = true;
    boss.mistakes = 4;
    boss.board[10] = 5;
    boss.statuses.push({
      uid: 999, type: 'hush', target: 1, endsAtMs: st.clockMs + 5000,
    });
    const sealsBefore = boss.seals;
    const mistakesBefore = boss.mistakes;
    const claimedBefore = boss.claimed.length;
    expect(swapOrder(st, 1, 'warden')).toBe(true);
    expect(boss.order).toBe('warden');
    // new rites only
    expect(Object.keys(boss.abilities).sort()).toEqual(['mirror', 'quarantine', 'ward']);
    for (const rt of Object.values(boss.abilities)) {
      expect(rt.cdLeftMs).toBe(0);      // rebuilt fresh
      expect(rt.usedOnce).toBe(false);  // unworn
    }
    expect(boss.bulwarkUsed).toBe(false); // the new passive returns unworn
    expect(boss.reckoningUntilMs).toBe(0);
    expect(boss.mirrorUntilMs).toBe(0);
    expect(boss.wardUntilMs).toBe(0);
    // everything earned or suffered preserved
    expect(boss.seals).toBe(sealsBefore);
    expect(boss.mistakes).toBe(mistakesBefore);
    expect(boss.claimed.length).toBe(claimedBefore);
    expect(boss.board[10]).toBe(5);
    expect(boss.statuses.some((s) => s.uid === 999)).toBe(true);
    // the event is on the wire for the UI banner
    expect(st.events.some((e) => e.kind === 'orderSwap' && e.player === 1)).toBe(true);
  });

  it('CO5 the new Order\u2019s signature fires on a later wake; the old Order\u2019s rite never casts', () => {
    const st = mkDuel('co5', 'executioner');
    const sst = newBossScriptState();
    st.players[1].claimed.push('r0');
    st.players[1].seals = 2;
    advancePhase(SWAP_ARC, sst, st, ME);
    const rng = new Rng('co5');
    let sawSwap = false;
    let wardCasts = 0;
    let hushCasts = 0;
    for (let i = 0; i < 90 && st.phase === 'live'; i++) {
      for (const rt of Object.values(st.players[1].abilities)) rt.cdLeftMs = 0; // everything ready
      if (st.players[1].seals < 2) st.players[1].seals = 2;
      if (st.players[0].seals < 7) st.players[0].seals = 7;
      const act = bossAct(SWAP_ARC, sst, st, ME, baseProfile(), () => rng.next(), 0);
      if (act.kind === 'swap') { sawSwap = true; swapOrder(st, ME, act.to); }
      else if (act.kind === 'ability') {
        expect(ORDER_ABILITIES[st.players[ME].order]).toContain(act.id); // live Order only
        if (act.id === 'ward') wardCasts++;
        if (act.id === 'hush') hushCasts++;
        useAbility(st, ME, act.id, { cell: act.cell, unit: act.unit });
      } else if (act.kind === 'place') place(st, ME, act.cell, act.digit);
      driveStep(st, rng);
      tick(st, 400);
    }
    expect(sawSwap).toBe(true);
    expect(wardCasts).toBeGreaterThanOrEqual(1); // the new Order's signature landed
    expect(hushCasts).toBe(0);                   // the old Order's rite never casts
  });
});

describe('CO · hostile swapTo and edge cases fail closed', () => {
  it('CO6 a hostile swapTo matrix never swaps and never throws', () => {
    const hostile = [
      'the-ninth', 'blast', '', 'WARDEN', 'warden ', 'scholar)', 'null', 'undefined',
      NaN, null, undefined, 42, true, {}, [], () => 'warden',
    ] as unknown as Array<OrderId>;
    for (let k = 0; k < hostile.length; k++) {
      const arc: BossScript = {
        id: `hostile-${k}`,
        phases: [{ when: {} }, { when: { ownSealsBelow: 3 }, swapTo: hostile[k] }],
      };
      const st = mkDuel(`co6-${k}`, 'executioner');
      const sst = newBossScriptState();
      st.players[1].seals = 1;
      advancePhase(arc, sst, st, ME);
      expect(sst.pendingSwap ?? null, `hostile swapTo ${String(hostile[k])} arms nothing`).toBe(null);
      const rng = new Rng(`co6-${k}`);
      for (let i = 0; i < 10; i++) {
        const act = bossAct(arc, sst, st, ME, baseProfile(), () => rng.next(), 0);
        expect(act.kind).not.toBe('swap');
        if (act.kind === 'place') place(st, ME, act.cell, act.digit);
        else if (act.kind === 'ability') useAbility(st, ME, act.id, { cell: act.cell, unit: act.unit });
        tick(st, 400);
      }
      expect(st.players[1].order).toBe('executioner');
      expect(st.events.some((e) => e.kind === 'orderSwap')).toBe(false);
    }
  });

  it('CO7 a swapTo on the ENTRY phase is ignored — the boss arrives as announced', () => {
    const arc: BossScript = {
      id: 'entry-swap',
      phases: [{ when: {}, swapTo: 'warden' }, { when: { ownSealsBelow: 5 }, swapTo: 'apothecary' }],
    };
    const st = mkDuel('co7', 'executioner');
    const sst = newBossScriptState();
    advancePhase(arc, sst, st, ME); // no advancement happened
    expect(sst.pendingSwap ?? null).toBe(null);
    // the entry wake never swaps
    const act = bossAct(arc, sst, st, ME, baseProfile(), () => 0.5, 0);
    expect(act.kind).not.toBe('swap');
    expect(st.players[1].order).toBe('executioner');
    // but a REAL deeper phase still swaps when entered
    st.players[1].seals = 4;
    advancePhase(arc, sst, st, ME);
    expect(sst.pendingSwap).toBe('apothecary');
  });

  it('CO8 a same-Order pending swap is dropped, not fizzled into a refused action', () => {
    const arc: BossScript = {
      id: 'same-swap',
      phases: [{ when: {} }, { when: { ownSealsBelow: 5 }, swapTo: 'executioner' }],
    };
    const st = mkDuel('co8', 'executioner'); // the boss ALREADY wears the target
    const sst = newBossScriptState();
    st.players[1].seals = 4;
    advancePhase(arc, sst, st, ME);
    expect(sst.pendingSwap).toBe('executioner'); // armed by the ladder
    const act = bossAct(arc, sst, st, ME, baseProfile(), () => 0.5, 0);
    expect(act.kind).not.toBe('swap'); // dropped at dispatch, never emitted
    expect(sst.pendingSwap ?? null).toBe(null);
    expect(st.events.some((e) => e.kind === 'orderSwap')).toBe(false);
  });

  it('CO9 a swap never fires after the duel has ended', () => {
    const st = mkDuel('co9');
    st.phase = 'ended';
    const sst = newBossScriptState();
    const act = bossAct(SWAP_ARC, sst, st, ME, baseProfile(), () => 0.5, 0);
    expect(act.kind).toBe('wait');
  });

  it('CO10 hostile script states (NaN phaseIdx, missing pendingSwap) stay lawful', () => {
    const st = mkDuel('co10');
    const sst: BossScriptState = { phaseIdx: NaN, pendingSig: null } as BossScriptState;
    advancePhase(SWAP_ARC, sst, st, ME);
    const act = bossAct(SWAP_ARC, sst, st, ME, baseProfile(), () => 0.5, 0);
    expect(['wait', 'place', 'ability', 'swap']).toContain(act.kind);
  });
});

describe('CO · the deeper arcs hold under full-duel drives', () => {
  it('CO11 the three extended arcs still run to judgment with every cast legal', () => {
    for (const scriptId of ['the-ledger', 'the-forgery', 'the-drip'] as const) {
      for (const seed of [`co11-${scriptId}-a`, `co11-${scriptId}-b`]) {
        const folio = FOLIOS.find((f) => f.duels[2].script === scriptId)!;
        const st = mkDuel(seed, folio.duels[2].order);
        const sst = newBossScriptState();
        const script = BOSS_SCRIPTS[scriptId];
        const rng = new Rng(seed);
        let steps = 0;
        const swapsExpected = new Set(script.phases.filter((p) => p.swapTo).map((p) => p.swapTo));
        while (st.phase === 'live' && st.clockMs < CONFIG.duel.durationMs && steps < 3000) {
          const act = bossAct(script, sst, st, ME, baseProfile(), () => rng.next(), 0);
          if (act.kind === 'swap') {
            expect(swapsExpected.has(act.to)).toBe(true); // only the arc's own targets
            swapOrder(st, ME, act.to);
          } else if (act.kind === 'ability') {
            expect(ORDER_ABILITIES[st.players[ME].order]).toContain(act.id);
            useAbility(st, ME, act.id, { cell: act.cell, unit: act.unit });
          } else if (act.kind === 'place') place(st, ME, act.cell, act.digit);
          driveStep(st, rng);
          tick(st, 500);
          for (const p of st.players) {
            expect(p.seals).toBeGreaterThanOrEqual(0);
            expect(p.seals).toBeLessThanOrEqual(CONFIG.seals.magistrate);
          }
          steps++;
        }
        expect(st.phase).toBe('ended');
      }
    }
  }, 40_000);

  it('CO12 swap-carrying arcs are deterministic: byte-identical duels per seed', () => {
    const run = (scriptId: string, seed: string): string => {
      const st = mkDuel(seed, 'executioner');
      const sst = newBossScriptState();
      const script = BOSS_SCRIPTS[scriptId];
      const rng = new Rng(seed);
      let steps = 0;
      while (st.phase === 'live' && steps < 2400) {
        const act = bossAct(script, sst, st, ME, baseProfile(), () => rng.next(), 0);
        if (act.kind === 'place') place(st, ME, act.cell, act.digit);
        else if (act.kind === 'ability') useAbility(st, ME, act.id, { cell: act.cell, unit: act.unit });
        else if (act.kind === 'swap') swapOrder(st, ME, act.to);
        driveStep(st, rng);
        tick(st, 500);
        steps++;
      }
      return serializeDuel(st);
    };
    for (const id of ['the-ledger', 'the-forgery', 'the-drip']) {
      expect(run(id, `co12-${id}`)).toBe(run(id, `co12-${id}`));
    }
  }, 40_000);

  it('CO13 a hostile snapshot cannot smuggle hostile rules past deserializeDuel', () => {
    const st = mkDuel('co13');
    const json = serializeDuel(st);
    const parsed = JSON.parse(json) as Record<string, unknown>;
    parsed.rules = { wrongSealCost: 1e9, cdScale: -5, statusScale: NaN, constructor: 999, garbage: 'x' };
    const back = deserializeDuel(JSON.stringify(parsed));
    // the sanitized overlay clamps or drops everything impossible
    expect(back.rules?.wrongSealCost ?? 1).toBeLessThanOrEqual(3);
    expect(back.rules?.wrongSealCost ?? 1).toBeGreaterThanOrEqual(1);
    expect(back.rules?.cdScale ?? 1).toBeGreaterThanOrEqual(0.5);
    expect(back.rules?.cdScale ?? 1).toBeLessThanOrEqual(2);
    expect(back.rules?.statusScale).toBeUndefined();      // NaN dropped
    // junk keys are never COPIED by the sanitizer (own-property check — the
    // prototype chain always knows Object.constructor, that is not pollution)
    expect(Object.getOwnPropertyNames(back.rules ?? {}).some((k) => k === 'constructor' || k === 'garbage' || k === '__proto__')).toBe(false);
    // and the duel still plays
    const rng = new Rng('co13');
    const act = bossAct(SWAP_ARC, newBossScriptState(), back, ME, baseProfile(), () => rng.next(), 0);
    expect(['wait', 'place', 'ability', 'swap']).toContain(act.kind);
  });
});

describe('CO · LocalDuel drives cross-Order arcs (runtime parity)', () => {
  it('CO14 the foe\u2019s Order flips mid-duel, the banner shows, the duel reaches judgment', () => {
    const clockSwapArc: BossScript = {
      id: 'probe-clock-swap',
      phases: [
        { when: {} },
        { when: { clockAfterMs: 1200 }, swapTo: 'warden', signature: [{ id: 'ward' }] },
      ],
    };
    const d = new LocalDuel({
      mode: 'campaign', seed: 'co14-cross', tier: 'Easy',
      orders: ['scholar', 'executioner'], names: ['You', 'Marchetti'],
      seals: [7, 8],
      foeProfile: { ...baseProfile(), name: 'Marchetti' },
      foeScript: clockSwapArc,
    });
    const wake = (d as unknown as { shadeWake: () => void });
    const rng = new Rng('co14');
    let sawBanner = false;
    let flipped = false;
    for (let i = 0; i < 3000 && d.state.phase === 'live'; i++) {
      tick(d.state, 500);
      const empties: number[] = [];
      for (let c = 0; c < 81; c++) if (d.state.players[0].board[c] === 0) empties.push(c);
      if (empties.length && rng.next() < 0.6) {
        d.place(empties[Math.floor(rng.next() * empties.length)], d.state.solution![empties[Math.floor(rng.next() * empties.length)]] as Digit);
      }
      wake.shadeWake();
      if (d.state.players[1].order === 'warden') flipped = true;
      if (d.swapBanner()) sawBanner = true;
      expect(d.state.players[1].seals).toBeGreaterThanOrEqual(0);
    }
    expect(d.state.phase).toBe('ended');
    expect(flipped).toBe(true);       // the arc changed the Order through the engine
    expect(sawBanner).toBe(true);     // the T4 brass callout rode along
    // and the swap event is in the wire log
    expect(d.state.events.some((e) => e.kind === 'orderSwap' && e.player === 1)).toBe(true);
  }, 40_000);
});
