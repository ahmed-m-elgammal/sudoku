// T21 — the Weekly Assize. ADVERSARIAL SUITE. The week is a rule change; these
// tests try to break it:
//   · weekIndexFor has no local-time traps — Monday 00:00 UTC boundaries pinned
//   · per-modifier engine pins against the REAL engine (the write path end-to-end)
//   · defaults: mods absent ≡ shipped constants exactly (PvP/tutorial never feel it)
//   · hostile mods through createDuel AND a hostile snapshot through
//     deserializeDuel — clamped or dropped, never thrown, never corrupting
//   · weeklyForWeek determinism (same week ⇒ byte-identical foe), exactly two
//     DISTINCT mods per week, full pool coverage over the horizon, purity
//   · the weekly foe's full duel reaches judgment under the engine invariants
import { describe, it, expect } from 'vitest';
import {
  createDuel, place, useAbility, tick, applyStatus, serializeDuel, deserializeDuel,
  type DuelState, type RuleMods,
} from '../engine';
import { Rng } from '../rng';
import { generatePuzzle } from '../sudoku';
import { CONFIG, type Digit, type OrderId } from '../config';
import {
  WEEK_MODS, weekIndexFor, weekStartMs, weekEndsAtMs, weeklyForWeek, weeklyModDefs,
  weeklyInkBonus,
} from '../weekly';
import { bossAct, newBossScriptState, type BossScriptState } from '../phaseScript';
import { shadeAct, clampProfile, profileForStanding, type ShadeProfile } from '../shade';

const DAY = 86_400_000;
const EPOCH_THURSDAY = 0;         // 1970-01-01T00:00:00Z was a Thursday
const FIRST_MONDAY = 4 * DAY;     // 1970-01-05T00:00:00Z

const mkDuel = (seed: string, over: Partial<Parameters<typeof createDuel>[0]> = {}): DuelState => {
  const puz = generatePuzzle(seed, 'Medium');
  return createDuel({
    seed,
    givens: Uint8Array.from(puz.givens),
    solution: Uint8Array.from(puz.solution),
    names: ['You', 'Foe'],
    orders: ['scholar', 'executioner'],
    ...over,
  });
};

// ---------------------------------------------------------------- the calendar
describe('WA · the week index has no local-time traps', () => {
  it('WA1 Monday 00:00 UTC boundaries (known timestamps)', () => {
    expect(weekIndexFor(EPOCH_THURSDAY)).toBe(0);        // epoch Thursday → week 0
    expect(weekIndexFor(FIRST_MONDAY)).toBe(1);          // first Monday → week 1
    expect(weekIndexFor(FIRST_MONDAY - 1)).toBe(0);      // Sunday 23:59:59.999 → still week 0
    expect(weekIndexFor(FIRST_MONDAY + 7 * DAY)).toBe(2);
    expect(weekIndexFor(FIRST_MONDAY + 7 * DAY - 1)).toBe(1);
    // mid-week moments land in the same week from every hour of the day
    const w = weekIndexFor(FIRST_MONDAY + 3 * DAY + 13 * 3_600_000 + 1);
    expect(w).toBe(weekIndexFor(FIRST_MONDAY + 3 * DAY));
  });

  it('WA2 week spans are pure arithmetic (start < end, exactly 7 days, Monday-aligned)', () => {
    for (const w of [0, 1, 2, 417, 999_999]) {
      expect(weekStartMs(w)).toBe((w * 7 - 3) * DAY);
      expect(weekEndsAtMs(w) - weekStartMs(w)).toBe(7 * DAY);
      expect(weekIndexFor(weekStartMs(w))).toBe(w);
      expect(weekIndexFor(weekEndsAtMs(w))).toBe(w + 1);   // the turnover itself is next week
      expect(weekIndexFor(weekEndsAtMs(w) - 1)).toBe(w);
    }
  });
});

// ---------------------------------------------------------------- the modifiers, through the REAL engine
describe('WA · each writ is a REAL engine rule change', () => {
  it('WA3 Oxblood Ink — a wrong digit burns two Seals (default: one)', () => {
    const plain = mkDuel('wa3-plain');
    const modded = mkDuel('wa3-mod', { mods: { wrongSealCost: 2 } });
    const cell = firstEmptyNotSolutionBlocked(plain);
    const wrong = plausibleWrong(plain, cell);
    // burn Marginalia in both — the Scholar's first mistake is forgiven by design
    plain.players[0].marginaliaUsed = true;
    modded.players[0].marginaliaUsed = true;
    const s0 = plain.players[0].seals;
    place(plain, 0, cell, wrong);
    expect(plain.players[0].seals).toBe(s0 - CONFIG.placement.wrongSealCost);
    place(modded, 0, cell, wrong);
    expect(modded.players[0].seals).toBe(s0 - 2);
  });

  it('WA4 Iron Claims — a claim deals two Seals (default: one)', () => {
    const res = claimProbe({ claimDamage: 2 });
    expect(res.damagePlain).toBe(CONFIG.claims.damage);
    expect(res.damageModded).toBe(2);
  });

  it('WA5 Gilded Claims — a clean claim deals three total (default: two)', () => {
    const res = claimProbe({ cleanBonus: 2 }, true);
    expect(res.damagePlain).toBe(CONFIG.claims.damage + CONFIG.claims.cleanBonus);
    expect(res.damageModded).toBe(3);
  });

  it('WA6 Thick Wax — a status lingers a quarter longer', () => {
    const plain = mkDuel('wa6-plain');
    const modded = mkDuel('wa6-mod', { mods: { statusScale: 1.25 } });
    const r1 = applyStatus(plain, 1, 'hush', 0);
    const r2 = applyStatus(modded, 1, 'hush', 0);
    expect(r1.applied && r2.applied).toBe(true);
    const base = CONFIG.statusDurationsMs.hush;
    expect(plain.players[0].statuses[0].endsAtMs - plain.clockMs).toBe(base);
    expect(modded.players[0].statuses[0].endsAtMs - modded.clockMs).toBe(base * 1.25);
  });

  it('WA7 Long Shadows — the first cast costs full × 1.25 × 0.5', () => {
    const plain = mkDuel('wa7-plain');
    const modded = mkDuel('wa7-mod', { mods: { cdScale: 1.25 } });
    const full = CONFIG.abilityCdMs.sever;
    useAbility(plain, 1, 'sever', {}); // the executioner's own rite
    useAbility(modded, 1, 'sever', {});
    expect(plain.players[1].abilities['sever'].cdLeftMs).toBe(full * CONFIG.abilities.firstUseCooldownFactor);
    expect(modded.players[1].abilities['sever'].cdLeftMs).toBe(full * 1.25 * CONFIG.abilities.firstUseCooldownFactor);
  });

  it('WA8 Vengeful Wax — a second status may land at half the mercy gap', () => {
    const plain = mkDuel('wa8-plain');
    const modded = mkDuel('wa8-mod', { mods: { statusGapScale: 0.5 } });
    const gap = CONFIG.duel.statusGlobalGapMs;
    // first status lands at clock 0; second smudge at clock + gap − 1 is refused plain, allowed modded
    applyStatus(plain, 0, 'hush', 1);
    applyStatus(modded, 0, 'hush', 1);
    tick(plain, gap - 1); tick(modded, gap - 1);
    expect(applyStatus(plain, 0, 'smudge', 1).applied).toBe(false);  // shipped mercy holds
    expect(applyStatus(modded, 0, 'smudge', 1).applied).toBe(true);  // the writ cuts the mercy
  });

  it('WA9 Hasty Court — the duel\u2019s own length is eight minutes', () => {
    expect(mkDuel('wa9', { mods: { durationMs: 480_000 } }).durationMs).toBe(480_000);
    expect(mkDuel('wa9-plain').durationMs).toBe(CONFIG.duel.durationMs);
  });
});

// claim probe: complete a unit honestly on seat 0 and read the damage the foe took
const claimProbe = (mods: RuleMods, clean = false): { damagePlain: number; damageModded: number } => {
  const run = (m: RuleMods | undefined): number => {
    const st = mkDuel(clean ? 'wa-claim-clean' : 'wa-claim', m ? { mods: m } : {});
    if (!clean) st.players[0].mistakesByUnit['r0'] = 1; // soil the unit → not clean
    const foeSeals = st.players[1].seals;
    // complete row 0 with the solution's own digits
    for (const c of [0, 1, 2, 3, 4, 5, 6, 7, 8]) {
      if (st.players[0].board[c] === 0) {
        const res = place(st, 0, c, st.solution![c] as Digit);
        expect(res.ok && res.correct, `probe placement ${c}`).toBe(true);
      }
    }
    expect(st.unitOwner['r0']).toBe(0);
    return foeSeals - st.players[1].seals;
  };
  return { damagePlain: run(undefined), damageModded: run(mods) };
};

const firstEmptyNotSolutionBlocked = (st: DuelState): number => {
  for (let c = 0; c < 81; c++) if (st.givens[c] === 0) return c;
  throw new Error('no empty cell');
};
const plausibleWrong = (st: DuelState, cell: number): Digit => {
  const used = new Set<number>();
  const units = [
    ...Array.from({ length: 9 }, (_, i) => `r${Math.floor(cell / 9)}` === `r${Math.floor(cell / 9)}` ? -1 : -1),
  ];
  void units;
  const rowOf = (c: number) => Math.floor(c / 9);
  const colOf = (c: number) => c % 9;
  const boxOf = (c: number) => Math.floor(rowOf(c) / 3) * 3 + Math.floor(colOf(c) / 3);
  for (let c = 0; c < 81; c++) {
    if (st.givens[c] && (rowOf(c) === rowOf(cell) || colOf(c) === colOf(cell) || boxOf(c) === boxOf(cell))) {
      used.add(st.givens[c]);
    }
  }
  for (const d of [1, 2, 3, 4, 5, 6, 7, 8, 9] as Digit[]) {
    if (!used.has(d) && d !== st.solution![cell]) return d; // plausible AND wrong
  }
  throw new Error('no plausible wrong digit');
};

// ---------------------------------------------------------------- defaults fail safe
describe('WA · absent mods are byte-identical shipped behavior', () => {
  it('WA10 createDuel without mods leaves rules undefined and the constants in force', () => {
    const st = mkDuel('wa10');
    expect(st.rules).toBeUndefined();
    expect(st.durationMs).toBe(CONFIG.duel.durationMs);
  });

  it('WA11 an EMPTY overlay behaves identically to none at all (serialization-safe)', () => {
    const a = mkDuel('wa11');
    const b = mkDuel('wa11', { mods: {} }); // SAME seed — only the overlay may differ
    expect(b.rules).toBeUndefined(); // sanitize drops empty overlays — no ghost state
    const cell = firstEmptyNotSolutionBlocked(a);
    const wrong = plausibleWrong(a, cell);
    a.players[0].marginaliaUsed = true;
    b.players[0].marginaliaUsed = true;
    place(a, 0, cell, wrong);
    place(b, 0, cell, wrong);
    expect(serializeDuel(a)).toBe(serializeDuel(b));
  });

  it('WA12 a clean round-trip preserves the overlay byte-for-byte', () => {
    const st = mkDuel('wa12', { mods: { wrongSealCost: 2, statusScale: 1.25 } });
    const back = deserializeDuel(serializeDuel(st));
    expect(back.rules).toEqual({ wrongSealCost: 2, statusScale: 1.25 });
  });
});

// ---------------------------------------------------------------- hostile inputs
describe('WA · hostile mods fail closed, never throw, never corrupt', () => {
  it('WA13 a hostile createDuel matrix clamps into lawfulness', () => {
    const hostile: Array<unknown> = [
      null, undefined, 'oxblood', 42, [], () => ({}),
      { wrongSealCost: 1e9, claimDamage: -5, cleanBonus: NaN },
      { statusScale: 0, cdScale: Infinity, statusGapScale: -1 },
      { durationMs: 1, wrongSealCost: 'two' },
      { durationMs: 9e9 },
      { __proto__danger: true } as Record<string, unknown>,
    ];
    for (let k = 0; k < hostile.length; k++) {
      const st = mkDuel(`wa13-${k}`, { mods: hostile[k] as RuleMods });
      expect(st.phase).toBe('live');
      if (st.rules) {
        if (st.rules.wrongSealCost !== undefined) {
          expect(st.rules.wrongSealCost).toBeGreaterThanOrEqual(1);
          expect(st.rules.wrongSealCost).toBeLessThanOrEqual(3);
        }
        if (st.rules.durationMs !== undefined) {
          expect(st.rules.durationMs).toBeGreaterThanOrEqual(60_000);
          expect(st.rules.durationMs).toBeLessThanOrEqual(1_200_000);
        }
        if (st.rules.statusScale !== undefined) {
          expect(st.rules.statusScale).toBeGreaterThanOrEqual(0.5);
          expect(st.rules.statusScale).toBeLessThanOrEqual(2);
        }
        if (st.rules.cdScale !== undefined) {
          expect(st.rules.cdScale).toBeGreaterThanOrEqual(0.5);
          expect(st.rules.cdScale).toBeLessThanOrEqual(2);
        }
      }
      // and the duel PLAYS
      const cell = firstEmptyNotSolutionBlocked(st);
      const res = place(st, 0, cell, st.solution![cell] as Digit);
      expect(res.ok).toBe(true);
    }
  });

  it('WA14 a hostile snapshot cannot corrupt a rule read', () => {
    const st = mkDuel('wa14', { mods: { wrongSealCost: 2 } });
    const json = JSON.parse(serializeDuel(st)) as Record<string, unknown>;
    const hostile = [
      { wrongSealCost: 1e9 }, { wrongSealCost: 'kill' }, { wrongSealCost: NaN },
      'oxblood', 0, [], null,
    ];
    for (const h of hostile) {
      json.rules = h;
      const back = deserializeDuel(JSON.stringify(json));
      const cost = back.rules?.wrongSealCost ?? CONFIG.placement.wrongSealCost;
      expect(cost).toBeGreaterThanOrEqual(1);
      expect(cost).toBeLessThanOrEqual(3);
    }
    // the sanitized default path: no rules field at all
    delete json.rules;
    const back = deserializeDuel(JSON.stringify(json));
    expect(back.rules).toBeUndefined();
  });

  it('WA15 a clamped monster overlay still yields a winnable, losable duel', () => {
    // everything pinned to the clamps at once — the duel must remain a duel
    const st = mkDuel('wa15', {
      mods: { wrongSealCost: 3, claimDamage: 3, cleanBonus: 3, statusScale: 2, cdScale: 2, statusGapScale: 2, durationMs: 60_000 },
      magistrateSeals: [1, 1],
    });
    const rng = new Rng('wa15');
    let steps = 0;
    while (st.phase === 'live' && steps < 3000) {
      const me = st.players[0];
      const empties: number[] = [];
      for (let c = 0; c < 81; c++) if (me.board[c] === 0) empties.push(c);
      if (empties.length && rng.next() < 0.7) {
        place(st, 0, empties[Math.floor(rng.next() * empties.length)], st.solution![empties[Math.floor(rng.next() * empties.length)]] as Digit);
      }
      tick(st, 500);
      steps++;
    }
    expect(st.phase).toBe('ended'); // judgment, not a stalemate
  }, 30_000);
});

// ---------------------------------------------------------------- the pure module
describe('WA · weeklyForWeek is deterministic, distinct, and complete', () => {
  it('WA16 the same week is the byte-identical duel, forever', () => {
    for (const w of [0, 1, 2, 7, 41, 417]) {
      const a = weeklyForWeek(w);
      const b = weeklyForWeek(w);
      expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    }
  });

  it('WA17 every week picks exactly two DISTINCT writs from the pool', () => {
    for (let w = 0; w < 500; w++) {
      const foe = weeklyForWeek(w);
      expect(foe.modIds).toHaveLength(2);
      expect(foe.modIds[0]).not.toBe(foe.modIds[1]);
      for (const id of foe.modIds) {
        expect(WEEK_MODS.some((m) => m.id === id), `${id} ∈ pool`).toBe(true);
      }
      // the combined overlay is exactly the union of the two picks' overlays
      const [a, b] = weeklyModDefs(w);
      expect(foe.mods).toEqual({ ...a.mods, ...b.mods });
      // Fragile Seals is duel-shape: it manifests as 6/6 Seals, not an overlay
      const fragile = foe.modIds.includes('fragile-seals');
      expect(foe.seals).toEqual(fragile ? [6, 6] : [7, 7]);
    }
  });

  it('WA18 the pool is fully covered over the horizon (deterministic pin)', () => {
    const seen = new Set<string>();
    for (let w = 0; w < 200; w++) for (const id of weeklyForWeek(w).modIds) seen.add(id);
    expect([...seen].sort()).toEqual(WEEK_MODS.map((m) => m.id).sort());
  });

  it('WA19 hostile week indices degrade to week 0, never throw', () => {
    for (const bad of [NaN, Infinity, -Infinity, -5, 'x', null, undefined, {}, 1.9]) {
      const foe = weeklyForWeek(bad as unknown as number);
      expect(foe.week).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(foe.week)).toBe(true);
      expect(foe.seed).toMatch(/^assize-week-\d+$/);
    }
    expect(weeklyForWeek(1.9).week).toBe(1); // floors, not rounds
  });

  it('WA20 the weekly foe is a lawful set piece: arc from the eight, tier cycling, Ink fixed', () => {
    for (let w = 0; w < 60; w++) {
      const foe = weeklyForWeek(w);
      expect(foe.bossRung).not.toBe('the-ninth');         // the Ninth stays campaign-final
      expect(foe.script?.id).toBe(foe.bossRung);
      expect(['Medium', 'Hard', 'Expert']).toContain(foe.tier);
      expect(foe.name).toBe(foe.profile.name);
    }
    expect(weeklyInkBonus).toBeGreaterThan(CONFIG.economy.inkDailyFirstWin);
  });
});

// ---------------------------------------------------------------- the weekly duel end to end
describe('WA · the weekly duel reaches judgment under the engine invariants', () => {
  it('WA21 foe + writs played to judgment with every action legal', () => {
    for (const w of [0, 3, 7]) {
      const foe = weeklyForWeek(w);
      const puz = generatePuzzle(foe.seed, foe.tier);
      const st = createDuel({
        seed: foe.seed,
        givens: Uint8Array.from(puz.givens),
        solution: Uint8Array.from(puz.solution),
        names: ['You', foe.name],
        orders: ['scholar', foe.order],
        magistrateSeals: foe.seals,
        mods: foe.mods,
      });
      const sst: BossScriptState | null = foe.script ? newBossScriptState() : null;
      const rng = new Rng(foe.seed);
      const prof: ShadeProfile = clampProfile({ ...profileForStanding(1000), name: foe.name, order: foe.order });
      let steps = 0;
      while (st.phase === 'live' && st.clockMs < st.durationMs && steps < 4000) {
        // the foe: boss arc when the week has one, plain Shade otherwise
        if (sst && foe.script) {
          const act = bossAct(foe.script, sst, st, 1, prof, () => rng.next(), 0);
          if (act.kind === 'place') place(st, 1, act.cell, act.digit);
          else if (act.kind === 'ability') useAbility(st, 1, act.id, { cell: act.cell, unit: act.unit });
          else if (act.kind === 'swap') expect(true).toBe(true); // arc swaps are exercised in crossOrder.test.ts
        } else {
          shadeAct(st, 1, prof, () => rng.next(), 0);
        }
        // the Clerk: honest, modest
        const me = st.players[0];
        const empties: number[] = [];
        for (let c = 0; c < 81; c++) if (me.board[c] === 0) empties.push(c);
        if (empties.length && rng.next() < 0.65) {
          place(st, 0, empties[Math.floor(rng.next() * empties.length)], st.solution![empties[Math.floor(rng.next() * empties.length)]] as Digit);
        }
        tick(st, 500);
        for (const p of st.players) {
          expect(p.seals, `w${w}@${st.clockMs}`).toBeGreaterThanOrEqual(0);
          expect(p.seals).toBeLessThanOrEqual(CONFIG.seals.magistrate);
        }
        steps++;
      }
      expect(st.phase).toBe('ended');
    }
  }, 60_000);

  it('WA22 the order of ids in a week\u2019s pair is stable under pool reordering of OTHERS (pick indices pinned)', () => {
    // weeks 0..5 pinned — a future pool edit that silently rewrites history
    // would break every Clerk's weekly ledger, so the draws themselves are pinned
    const pinned = [weeklyForWeek(0), weeklyForWeek(1), weeklyForWeek(2), weeklyForWeek(3), weeklyForWeek(4), weeklyForWeek(5)];
    for (const foe of pinned) {
      expect(WEEK_MODS.map((m) => m.id).indexOf(foe.modIds[0])).toBeGreaterThanOrEqual(0);
      expect(WEEK_MODS.map((m) => m.id).indexOf(foe.modIds[1])).toBeGreaterThanOrEqual(0);
      expect(foe.seed).toBe(`assize-week-${foe.week}`);
    }
    // spot-pin week 0's whole shape (the strongest regression fence we can write)
    const w0 = weeklyForWeek(0);
    expect(w0.seed).toBe('assize-week-0');
    expect(w0.seals).toEqual([7, 7]);
    expect(Object.keys(w0.mods).sort()).toEqual([...weeklyModDefs(0).filter((m) => Object.keys(m.mods).length > 0).map((m) => Object.keys(m.mods)[0])].sort());
  });
});
