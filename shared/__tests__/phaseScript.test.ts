// T18 — PhaseScript bosses. ADVERSARIAL SUITE. These tests try to break the
// ladder, not bless it:
//   · monotonicity — a phase must never regress, however the duel state wobbles
//   · hostile scripts (NaN/Infinity/empty/unknown) fail CLOSED to the base Shade
//   · signatures fire AT MOST once per duel, only when LEGAL (own Order, off
//     cooldown, uses left), and are engine-legal actions
//   · determinism — byte-identical action logs for identical seeds
//   · full-duel fuzz of all nine arcs under the engine invariant checklist
//   · envelope idempotence under ~500 hostile patches
import { describe, it, expect } from 'vitest';
import {
  createDuel, tick, place, useAbility, serializeDuel, type DuelState,
} from '../engine';
import { Rng } from '../rng';
import { generatePuzzle } from '../sudoku';
import { CONFIG, ORDER_ABILITIES, type Digit, type OrderId } from '../config';
import {
  bossAct, newBossScriptState, phaseMatches, advancePhase, patchProfile,
  BOSS_SCRIPTS, type BossScript, type BossScriptState, type PhasePatch,
} from '../phaseScript';
import { shadeAct, profileForStanding, clampProfile, PROFILE_ENVELOPE } from '../shade';
import { FOLIOS } from '../orders';
import { LocalDuel } from '../../src/game/localDuel';

// the foe acts on seat 1 in every real duel
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

// step a duel forward with a scripted (mediocre but honest) human on seat 0
let humanCellCursor = 0;
const driveStep = (st: DuelState, rand: Rng): void => {
  const me = st.players[0];
  if (st.phase !== 'live') return;
  // the human finds a naked single most of the time
  const empties: number[] = [];
  for (let c = 0; c < 81; c++) if (me.board[c] === 0) empties.push(c);
  if (empties.length && rand.next() < 0.7) {
    const c = empties[Math.floor(rand.next() * empties.length)];
    place(st, 0, c, st.solution![c] as Digit);
  }
};

const stepFoe = (script: BossScript, sst: BossScriptState, st: DuelState, rng: Rng): void => {
  if (st.phase !== 'live') return;
  const act = bossAct(script, sst, st, ME, baseProfile(), () => rng.next(), 0);
  if (act.kind === 'place') place(st, ME, act.cell, act.digit);
  else if (act.kind === 'ability') useAbility(st, ME, act.id, { cell: act.cell, unit: act.unit });
};

const invariants = (st: DuelState, where: string): void => {
  for (const p of st.players) {
    expect(p.seals, `${where}: seals bounded`).toBeGreaterThanOrEqual(0);
    expect(p.seals, `${where}: seals bounded`).toBeLessThanOrEqual(CONFIG.seals.magistrate);
    for (let c = 0; c < 81; c++) {
      expect(p.board[c], `${where}: board digit range`).toBeGreaterThanOrEqual(0);
      expect(p.board[c], `${where}: board digit range`).toBeLessThanOrEqual(9);
    }
    for (const u of p.claimed) expect(typeof u, `${where}: claimed unit ids`).toBe('string');
  }
  expect(st.clockMs, `${where}: clock non-negative`).toBeGreaterThanOrEqual(0);
};

// ================================================================ the ladder
describe('PS · the phase ladder is monotonic and fail-closed', () => {
  it('PS1 the entry phase never advances from an empty/garbage `when`', () => {
    const st = mkDuel('ps1');
    const sst = newBossScriptState();
    // a rule with no finite condition must NEVER match (no unconditional god-phase)
    expect(phaseMatches({}, st, ME)).toBe(false);
    expect(phaseMatches(undefined, st, ME)).toBe(false);
    expect(phaseMatches({ clockAfterMs: NaN, ownSealsBelow: NaN }, st, ME)).toBe(false);
    expect(phaseMatches({ clockAfterMs: Infinity }, st, ME)).toBe(false);
    // hostile cast: wrong-typed fields are simply not finite numbers
    expect(phaseMatches({ clockAfterMs: 'soon' as unknown as number }, st, ME)).toBe(false);
    const script: BossScript = { id: 'garbage', phases: [{ when: {} }, { when: { ownSealsBelow: NaN } }] };
    expect(advancePhase(script, sst, st, ME)).toBe(0);
    expect(sst.phaseIdx).toBe(0);
  });

  it('PS2 phases advance on matching conditions and NEVER regress', () => {
    const st = mkDuel('ps2');
    const sst = newBossScriptState();
    const script: BossScript = { id: 'ladder', phases: [
      { when: {} },
      { when: { ownSealsBelow: 6 }, patch: { paceFactor: 0.9 } },
      { when: { ownSealsBelow: 3 }, patch: { paceFactor: 0.7 } },
    ] };
    // drop the boss to 5 seals → phase 1
    st.players[1].seals = 5;
    expect(advancePhase(script, sst, st, ME)).toBe(1);
    // the state "recovers" (a wobble the real engine cannot produce — the ladder
    // must not care): phase stays, never walks back
    st.players[1].seals = 8;
    expect(advancePhase(script, sst, st, ME)).toBe(1);
    // deeper drop skips straight to 2 in one scan
    st.players[1].seals = 2;
    expect(advancePhase(script, sst, st, ME)).toBe(2);
    st.players[1].seals = 8;
    expect(advancePhase(script, sst, st, ME)).toBe(2);
    expect(sst.phaseIdx).toBe(2);
  });

  it('PS3 hostile script state (NaN phaseIdx, missing fields) stays lawful', () => {
    const st = mkDuel('ps3');
    const script = BOSS_SCRIPTS['the-grip'];
    const sst: BossScriptState = { phaseIdx: NaN, pendingSig: null };
    expect(advancePhase(script, sst, st, ME)).toBe(0);
    // a state pushed past the end clamps, never crashes
    const past: BossScriptState = { phaseIdx: 99, pendingSig: null };
    expect(advancePhase(script, past, st, ME)).toBe(script.phases.length - 1);
    // hostile state objects
    expect(advancePhase({ id: 'x', phases: [] }, newBossScriptState(), st, ME)).toBe(0);
    expect(advancePhase(undefined as unknown as BossScript, newBossScriptState(), st, ME)).toBe(0);
  });

  it('PS4 empty phases degrade to byte-identical plain shadeAct behavior', () => {
    const stA = mkDuel('ps4');
    const stB = mkDuel('ps4');
    const empty: BossScript = { id: 'empty', phases: [] };
    const sst = newBossScriptState();
    const prof = baseProfile();
    // identical seeds → the boss with an empty script must mirror shadeAct exactly
    for (let i = 0; i < 40 && stA.phase === 'live'; i++) {
      const rA = new Rng(`ps4-${i}`);
      const rB = new Rng(`ps4-${i}`);
      const a = bossAct(empty, sst, stA, ME, prof, () => rA.next(), 0);
      const b = shadeAct(stB, ME, prof, () => rB.next(), 0);
      expect(JSON.stringify(a)).toBe(JSON.stringify(b));
      if (a.kind === 'place') { place(stA, ME, a.cell, a.digit); place(stB, ME, (b as { kind: 'place'; cell: number; digit: Digit }).cell, (b as { kind: 'place'; cell: number; digit: Digit }).digit); }
      else if (a.kind === 'ability') { useAbility(stA, ME, a.id, {}); useAbility(stB, ME, (b as { kind: 'ability'; id: Parameters<typeof useAbility>[2] }).id, {}); }
      tick(stA, 500); tick(stB, 500);
    }
    expect(serializeDuel(stA)).toBe(serializeDuel(stB));
  });

  it('PS5 the boss refuses to act once the duel has ended', () => {
    const st = mkDuel('ps5');
    st.phase = 'ended';
    const sst = newBossScriptState();
    const act = bossAct(BOSS_SCRIPTS['the-grip'], sst, st, ME, baseProfile(), () => 0.5, 0);
    expect(act.kind).toBe('wait');
  });
});

// ================================================================ patches
describe('PS · patches stay relative, inside the envelope, idempotent', () => {
  const base = baseProfile();

  it('PS6 paceFactor multiplies the band; adds shift within the envelope', () => {
    const p = patchProfile(base, { paceFactor: 0.8, mistakeAdd: 0.05, skillAdd: 0.1, aggressionAdd: 0.2 });
    expect(p.placeDelayMs[0]).toBeCloseTo(base.placeDelayMs[0] * 0.8, 6);
    expect(p.placeDelayMs[1]).toBeCloseTo(base.placeDelayMs[1] * 0.8, 6);
    expect(p.mistakeRate).toBeCloseTo(Math.min(PROFILE_ENVELOPE.mistakeRateMax, base.mistakeRate + 0.05), 6);
    expect(p.aggression).toBeCloseTo(Math.min(PROFILE_ENVELOPE.aggressionMax, base.aggression + 0.2), 6);
  });

  it('PS7 ~500 hostile patches never escape the envelope and never throw', () => {
    const hostile: unknown[] = [];
    const seeds = [NaN, Infinity, -Infinity, 0, -3, 1e9, 'x', null, {}, [], true, 0.0001, -0.7, 3.999, 4, 4.001];
    for (let i = 0; i < 500; i++) {
      hostile.push({
        paceFactor: seeds[(i * 7 + 1) % seeds.length],
        mistakeAdd: seeds[(i * 5 + 2) % seeds.length],
        skillAdd: seeds[(i * 3 + 3) % seeds.length],
        aggressionAdd: seeds[(i * 11 + 4) % seeds.length],
      });
    }
    for (const patch of hostile) {
      const p = patchProfile(base, patch as PhasePatch);
      const c = clampProfile(p);
      expect(p).toEqual(c); // idempotent — already inside
      expect(p.placeDelayMs[0]).toBeGreaterThanOrEqual(PROFILE_ENVELOPE.placeDelayMinMs);
      expect(p.placeDelayMs[1]).toBeLessThanOrEqual(PROFILE_ENVELOPE.placeDelayMaxMs);
      expect(p.placeDelayMs[0]).toBeLessThanOrEqual(p.placeDelayMs[1]);
      expect(p.aggression).toBeGreaterThanOrEqual(PROFILE_ENVELOPE.aggressionMin);
      expect(p.aggression).toBeLessThanOrEqual(PROFILE_ENVELOPE.aggressionMax);
      expect(Number.isFinite(p.mistakeRate)).toBe(true);
      expect(Number.isFinite(p.singlesSkill)).toBe(true);
    }
  });

  it('PS8 Marchetti hoards at entry (phase-0 patch) — the arc has an opening', () => {
    const marchetti = BOSS_SCRIPTS['the-ledger'];
    const prof = patchProfile(base, marchetti.phases[0].patch);
    expect(prof.aggression).toBeLessThan(base.aggression);
  });

  it('PS9 Nox digs faster in the exhumation than he buries the opening', () => {
    const nox = BOSS_SCRIPTS['the-exhumation'];
    const slow = patchProfile(base, nox.phases[0].patch);
    const fast = patchProfile(base, nox.phases[2].patch);
    expect(slow.placeDelayMs[0]).toBeGreaterThan(base.placeDelayMs[0]);
    expect(fast.placeDelayMs[0]).toBeLessThan(base.placeDelayMs[0]);
    expect(fast.aggression).toBeGreaterThan(base.aggression);
  });
});

// ================================================================ signatures
describe('PS · signature rites fire once, legally, or not at all', () => {
  it('PS10 the-grip dispatches its hush SIGNATURE exactly once after two claims', () => {
    const st = mkDuel('ps10');
    const sst = newBossScriptState();
    const script = BOSS_SCRIPTS['the-grip'];
    const rng = new Rng('ps10');
    // give the boss two claims → phase 2 matches; pre-advance the ladder so the
    // pending signature is observable BEFORE the first bossAct (a wake-0 dispatch
    // is otherwise indistinguishable from a natural cast)
    st.players[1].claimed.push('r0', 'c0');
    st.players[1].seals = 7;
    advancePhase(script, sst, st, ME);
    expect(sst.pendingSig?.[0]?.id).toBe('hush');
    let sigDispatches = 0;
    let naturalHush = 0;
    for (let i = 0; i < 150 && st.phase === 'live'; i++) {
      // every rite ready: the signature CAN fire — so could the natural path
      for (const a of Object.values(st.players[1].abilities)) a.cdLeftMs = 0;
      // scaffold: hold both duelists alive so the probe is not cut short by a
      // legitimate seals win (the boss claims fast on an Easy tablet)
      if (st.players[1].seals < 5) st.players[1].seals = 5;
      if (st.players[0].seals < 7) st.players[0].seals = 7;
      const headWasHush = sst.pendingSig?.[0]?.id === 'hush';
      const act = bossAct(script, sst, st, ME, baseProfile(), () => rng.next(), 0);
      if (act.kind === 'ability' && act.id === 'hush') {
        if (headWasHush) sigDispatches++; // the SIGNATURE cast
        else naturalHush++;               // the aggression path casting hush on its own
      }
      if (act.kind === 'place') place(st, ME, act.cell, act.digit);
      else if (act.kind === 'ability') useAbility(st, ME, act.id, { cell: act.cell, unit: act.unit });
      if (i % 3 === 0) driveStep(st, rng); // a modest Clerk — the boss is not slaughtered
      tick(st, 400);
      expect(sst.phaseIdx).toBe(1); // held phase 2 for the whole probe
    }
    expect(sigDispatches).toBe(1);  // one-shot semantics, honored
    expect(naturalHush).toBeGreaterThanOrEqual(0);
  });

  it('PS11 a foreign-Order signature (Orsolo post-swap) never casts and never crashes', () => {
    const st = mkDuel('ps11', 'warden'); // Orsolo has swapped to Warden
    const sst = newBossScriptState();
    const ninth = BOSS_SCRIPTS['the-ninth'];
    // walk the ladder lawfully: rung 2 needs ownInkAtLeast 12, rung 3 needs
    // ownSealsBelow 5 — BOTH must hold; the ladder refuses to skip a rung
    st.players[1].progress = 12;
    expect(advancePhase(ninth, sst, st, ME)).toBe(1);
    st.players[1].seals = 2;
    advancePhase(ninth, sst, st, ME);
    expect(sst.phaseIdx).toBe(2);
    expect(sst.pendingSig && sst.pendingSig.some((s) => s.id === 'fairCopy')).toBe(true);
    const rng = new Rng('ps11');
    for (let i = 0; i < 60 && st.phase === 'live'; i++) {
      for (const a of Object.values(st.players[1].abilities)) a.cdLeftMs = 0;
      const act = bossAct(ninth, sst, st, ME, baseProfile(), () => rng.next(), 0);
      if (act.kind === 'ability') {
        expect(ORDER_ABILITIES[st.players[ME].order]).toContain(act.id); // own Order only
        useAbility(st, ME, act.id, { cell: act.cell, unit: act.unit });
      } else if (act.kind === 'place') place(st, ME, act.cell, act.digit);
      driveStep(st, rng);
      tick(st, 400);
    }
    // the fairCopy signature was never dispatched (warden has no such rite)
    expect(sst.pendingSig?.some((s) => s.id === 'fairCopy') ?? false).toBe(true);
  });

  it('PS12 a signature on cooldown waits for the wax instead of fizzling forever', () => {
    const st = mkDuel('ps12');
    const sst = newBossScriptState();
    const grip = BOSS_SCRIPTS['the-grip'];
    st.players[1].claimed.push('r0', 'c0'); // enter phase 2
    const rng = new Rng('ps12');
    // hush on a LONG cooldown — the boss must play on (not stall) while pending
    st.players[1].abilities['hush'].cdLeftMs = 999_000;
    let placed = 0;
    for (let i = 0; i < 30 && st.phase === 'live'; i++) {
      if (st.players[1].seals < 5) st.players[1].seals = 5; // hold phase 2
      if (st.players[0].seals < 7) st.players[0].seals = 7; // the probe is not a real duel — stay alive
      const act = bossAct(grip, sst, st, ME, baseProfile(), () => rng.next(), 0);
      if (act.kind === 'ability' && act.id === 'hush') {
        // cooldown was still running — this must not happen
        expect(st.players[1].abilities['hush'].cdLeftMs).toBeLessThanOrEqual(0);
      }
      if (act.kind === 'place') { place(st, ME, act.cell, act.digit); placed++; }
      else if (act.kind === 'ability') useAbility(st, ME, act.id, { cell: act.cell, unit: act.unit });
      tick(st, 400);
    }
    expect(sst.phaseIdx).toBe(1); // the human did not storm the ladder mid-probe
    expect(placed).toBeGreaterThan(0); // the boss kept dueling through the wait
    // now the wax clears — the signature lands on a later wake
    st.players[1].abilities['hush'].cdLeftMs = 0;
    let fired = false;
    for (let i = 0; i < 40 && st.phase === 'live' && !fired; i++) {
      if (st.players[1].seals < 5) st.players[1].seals = 5;
      if (st.players[0].seals < 7) st.players[0].seals = 7;
      const act = bossAct(grip, sst, st, ME, baseProfile(), () => rng.next(), 0);
      if (act.kind === 'ability' && act.id === 'hush') fired = true;
      else if (act.kind === 'place') place(st, ME, act.cell, act.digit);
      else if (act.kind === 'ability') useAbility(st, ME, act.id, { cell: act.cell, unit: act.unit });
      tick(st, 400);
    }
    expect(fired).toBe(true);
    expect(sst.phaseIdx).toBe(1); // dispatched while its own phase was current
  });
});

// ================================================================ the nine arcs
describe('PS · the nine Magistrate arcs duel lawfully, end to end', () => {
  const SCRIPT_IDS = FOLIOS.map((f) => f.duels[2].script!).filter(Boolean);

  it('PS13 every Magistrate carries a real arc whose signatures fit their Order', () => {
    expect(SCRIPT_IDS).toHaveLength(9);
    for (const folio of FOLIOS) {
      const boss = folio.duels[2];
      const script = BOSS_SCRIPTS[boss.script!];
      expect(script, `${boss.key} has a script`).toBeDefined();
      expect(script.phases.length).toBeGreaterThanOrEqual(2);
      expect(script.id).toBe(boss.script);
      for (const rule of script.phases) {
        for (const sig of rule.signature ?? []) {
          expect(ORDER_ABILITIES[boss.order], `${script.id}: ${sig.id} fits ${boss.order}`).toContain(sig.id);
        }
      }
    }
  });

  for (const scriptId of SCRIPT_IDS) {
    it(`PS14 ${scriptId}: two seeded duels run to judgment under the invariants`, () => {
      for (const seed of [`arc-${scriptId}-a`, `arc-${scriptId}-b`]) {
        const st = mkDuel(seed, FOLIOS.find((f) => f.duels[2].script === scriptId)!.duels[2].order);
        const sst = newBossScriptState();
        const script = BOSS_SCRIPTS[scriptId];
        const rng = new Rng(seed);
        let lastPhase = 0;
        let steps = 0;
        while (st.phase === 'live' && st.clockMs < CONFIG.duel.durationMs && steps < 3000) {
          stepFoe(script, sst, st, rng);
          driveStep(st, rng);
          tick(st, 500);
          invariants(st, `${scriptId}/${seed}@${st.clockMs.toFixed(0)}`);
          expect(sst.phaseIdx, 'phase never regresses mid-duel').toBeGreaterThanOrEqual(lastPhase);
          lastPhase = sst.phaseIdx;
          steps++;
        }
        expect(st.phase).toBe('ended'); // the duel reached judgment, not the step cap
      }
    }, 20_000);
  }

  it('PS15 boss duels are deterministic: byte-identical replays per seed', () => {
    const run = (scriptId: string, seed: string): string => {
      const st = mkDuel(seed, 'executioner');
      const sst = newBossScriptState();
      const rng = new Rng(seed);
      let steps = 0;
      while (st.phase === 'live' && steps < 2400) {
        stepFoe(BOSS_SCRIPTS[scriptId], sst, st, rng);
        driveStep(st, rng);
        tick(st, 500);
        steps++;
      }
      return serializeDuel(st);
    };
    for (const scriptId of ['the-grip', 'the-peal', 'the-exhumation']) {
      expect(run(scriptId, `det-${scriptId}`)).toBe(run(scriptId, `det-${scriptId}`));
    }
  }, 30_000);
});

// ================================================================ runtime wiring
describe('PS · LocalDuel drives boss arcs (runtime parity with the pure module)', () => {
  it('PS16 a LocalDuel with a foeScript advances phases and stays byte-deterministic', () => {
    // a clock-driven arc guarantees the phase advances regardless of play strength;
    // the shipped the-peal is clock-driven too — this probe mirrors it
    const clockArc: BossScript = { id: 'probe-peal', phases: [
      { when: {} },
      { when: { clockAfterMs: 1500 }, patch: { paceFactor: 0.8 } },
    ] };
    const makeDuel = () => new LocalDuel({
      mode: 'campaign', seed: 'ps16-campaign-boss', tier: 'Medium',
      orders: ['scholar', 'executioner'], names: ['You', 'Halbrecht the Headsman'],
      seals: [7, 8],
      foeProfile: { ...baseProfile(), name: 'Halbrecht the Headsman' },
      foeScript: clockArc,
    });
    const human = (d: LocalDuel) => {
      const empties: number[] = [];
      for (let c = 0; c < 81; c++) if (d.state.players[0].board[c] === 0) empties.push(c);
      if (empties.length) d.place(empties[0], d.state.solution![empties[0]] as Digit);
    };
    const run = (): { log: string; phaseSeen: boolean } => {
      const d = makeDuel();
      const wake = (d as unknown as { shadeWake: () => void });
      let phaseSeen = false;
      for (let i = 0; i < 400 && d.state.phase === 'live'; i++) {
        tick(d.state, 500);
        if (i % 3 === 0) human(d); // a modest Clerk keeps the duel alive
        wake.shadeWake();
        const probe = (d as unknown as { bossState?: BossScriptState }).bossState;
        if (probe && probe.phaseIdx > 0) phaseSeen = true;
      }
      return { log: serializeDuel(d.state), phaseSeen };
    };
    const a = run();
    const b = run();
    expect(a.log).toBe(b.log);
    expect(a.phaseSeen).toBe(true); // the arc actually moved mid-duel
  });

  it('PS17 a boss duel still ends by the engine\u2019s own judgment (seals or clock)', () => {
    const d = new LocalDuel({
      mode: 'campaign', seed: 'ps17-end', tier: 'Easy',
      orders: ['executioner', 'executioner'], names: ['You', 'Boss'],
      foeProfile: baseProfile(),
      foeScript: BOSS_SCRIPTS['the-ledger'], // Marchetti spends everything late
    });
    const wake = (d as unknown as { shadeWake: () => void });
    const rng = new Rng('ps17');
    for (let i = 0; i < 3000 && d.state.phase === 'live'; i++) {
      tick(d.state, 500);
      const empties: number[] = [];
      for (let c = 0; c < 81; c++) if (d.state.players[0].board[c] === 0) empties.push(c);
      if (empties.length && rng.next() < 0.6) {
        d.place(empties[Math.floor(rng.next() * empties.length)], d.state.solution![empties[Math.floor(rng.next() * empties.length)]] as Digit);
      }
      wake.shadeWake();
    }
    expect(d.state.phase).toBe('ended');
    expect(d.state.winner).toBeDefined();
  }, 30_000);
});
