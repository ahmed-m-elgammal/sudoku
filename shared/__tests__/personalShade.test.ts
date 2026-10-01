// T17 — "Your Shade": mining a stored echo into a personal ShadeProfile.
// ADVERSARIAL SUITE — written to break the miner:
//   · exact-number pins on the pace median and delay band (off-by-one dies here)
//   · wrong-ink measurement against a reconstructed solution (the core claim of T17)
//   · degenerate echoes: 0 placements, 1 placement, all-wrong, zero-cast, absurd
//     timestamps, duplicate cells — never NaN, never a throw, null when unfittable
//   · 200 seeded hostile-but-validator-passing payloads: null-or-envelope-valid, always
//   · purity (same echo → byte-identical profile; input never mutated)
//   · round-trip: the mined Shade must actually PLAY at the mined pace
//   · the unreliable-reconstruction gate (wrongRate > 0.5 → null)
import { describe, it, expect } from 'vitest';
import { generatePuzzle } from '../sudoku';
import { validateReplay, type DuelReplay, type ReplayAction } from '../replay';
import { clampProfile, PROFILE_ENVELOPE, profileForStanding, shadeAct, type ShadeProfile } from '../shade';
import {
  minePersonalShade, MIN_INK, PACE_FLOOR_LO_MS, PACE_FLOOR_HI_MS,
  UNRELIABLE_WRONG_RATE, type EchoTelemetry,
} from '../personalShade';
import { Rng } from '../rng';
import { tick, place, useAbility, createDuel, type DuelState } from '../engine';

// ---------------------------------------------------------------- echo builders
// Craft echoes whose ground truth we control: real puzzle, chosen cells, chosen
// correctness, chosen timestamps — everything else is the miner's problem.
interface EchoSpec {
  seed?: string;
  tier?: 'Easy' | 'Medium' | 'Hard' | 'Expert';
  wrongAt?: number[];            // indices (into placements) that burn ink
  gapMs?: number[];              // gap before each placement (gap[0] = t of first place)
  casts?: number;                // augur casts interleaved before each placement
  places?: number;
  winner?: 0 | 1 | 'draw';
  duplicateCell?: boolean;       // repeat the first placement (a fizzled log line)
  name?: string;
}

const buildEcho = (spec: EchoSpec): { replay: DuelReplay; placements: Array<{ cell: number; digit: number; t: number }> } => {
  const seed = spec.seed ?? 'mine-seed';
  const tier = spec.tier ?? 'Easy';
  const puz = generatePuzzle(seed, tier);
  const empties: number[] = [];
  for (let c = 0; c < 81; c++) if (!puz.givens[c]) empties.push(c);
  const n = spec.places ?? 8;
  const gaps = spec.gapMs ?? Array.from({ length: n }, () => 4000);
  const wrong = new Set(spec.wrongAt ?? []);
  const actions: ReplayAction[] = [];
  const placements: Array<{ cell: number; digit: number; t: number }> = [];
  let t = 2000;
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < (spec.casts ?? 0); k++) {
      actions.push({ t, kind: 'ability', id: 'augur', cell: empties[(i * 3 + k) % empties.length] });
    }
    const cell = empties[i % empties.length];
    const digit = wrong.has(i) ? ((puz.solution[cell] % 9) + 1) : puz.solution[cell];
    actions.push({ t, kind: 'place', cell, digit });
    placements.push({ cell, digit, t });
    t += gaps[i % gaps.length];
  }
  if (spec.duplicateCell && actions.length) {
    const first = actions.findIndex((a) => a.kind === 'place');
    const p = actions[first] as { t: number; kind: 'place'; cell: number; digit: number };
    actions.push({ t, kind: 'place', cell: p.cell, digit: p.digit });
  }
  const replay: DuelReplay = {
    v: 1,
    seed,
    tier,
    orders: ['scholar', 'executioner'],
    names: [spec.name ?? 'Iter the Clerk', 'Foe'],
    durationMs: Math.max(60_000, t + 1000),
    actions,
    outcome: { winner: spec.winner ?? 0, reason: 'seals' },
  };
  return { replay, placements };
};

const mine = (spec: EchoSpec): { profile: ShadeProfile; telemetry: EchoTelemetry } | null =>
  minePersonalShade(JSON.parse(JSON.stringify(spec && buildEcho(spec).replay)));

// ---------------------------------------------------------------- exact pins
describe('T17 · exact mining pins (pace, band, wrong-ink)', () => {
  it('the median gap drives the delay band exactly (gaps 7,6,8,9,10,11,12k → median 9k)', () => {
    const { profile } = mine({
      gapMs: [7000, 6000, 8000, 9000, 10000, 11000, 12000],
      places: 8,
    })!;
    // median 9000 → lo = 7200, hi = 12150 → envelope caps hi at 9000
    expect(profile.placeDelayMs).toEqual([7200, PROFILE_ENVELOPE.placeDelayMaxMs]);
  });

  it('a slow human is floored to the fair floor, not resurrected as a god', () => {
    const { profile } = mine({ gapMs: [300], places: 10 })!; // burst taps
    expect(profile.placeDelayMs[0]).toBe(PACE_FLOOR_LO_MS);
    expect(profile.placeDelayMs[1]).toBe(PACE_FLOOR_HI_MS);
  });

  it('wrong ink is measured against the reconstructed solution (1/8 wrong → 0.125)', () => {
    const { profile, telemetry } = mine({ wrongAt: [3], places: 8 })!;
    expect(telemetry.wrong).toBe(1);
    expect(telemetry.correct).toBe(7);
    expect(telemetry.placements).toBe(8);
    expect(profile.mistakeRate).toBeCloseTo(0.125, 5);
  });

  it('more burned ink never mines a gentler mistakeRate', () => {
    const clean = mine({ wrongAt: [], places: 10 })!;
    const dirty = mine({ wrongAt: [0, 2, 4], places: 10 })!;
    expect(dirty.profile.mistakeRate).toBeGreaterThan(clean.profile.mistakeRate);
  });

  it('cast density raises aggression (an interleave-heavy echo ≫ a cast-free one)', () => {
    // NOTE builder semantics: spec.casts is casts PER placement (interleaved rites)
    const quiet = mine({ casts: 0, places: 12 })!;   // cast-free → the 0.35 base
    const loud = mine({ casts: 1, places: 12 })!;    // 12 casts / 12 places → ceiling
    expect(quiet.profile.aggression).toBeCloseTo(0.35, 5);
    expect(loud.profile.aggression).toBeCloseTo(0.85, 5);
  });

  it('a flawless win on Expert mines techniques 4→3 (clamped) and Medium flawless wins climb a rung', () => {
    expect(mine({ tier: 'Expert', winner: 0, wrongAt: [], places: 12 })!.profile.techniques).toBe(3);
    expect(mine({ tier: 'Medium', winner: 0, wrongAt: [], places: 12 })!.profile.techniques).toBe(3);
    expect(mine({ tier: 'Medium', winner: 0, wrongAt: [1], places: 12 })!.profile.techniques).toBe(2);
    expect(mine({ tier: 'Easy', winner: 1, places: 12 })!.profile.techniques).toBe(1);
  });

  it('the Shade wears the recorded Clerk’s name and Order', () => {
    const { profile } = mine({ name: 'Iter of the Ash Court', places: 9 })!;
    expect(profile.order).toBe('scholar');
    expect(profile.name.startsWith('Shade of ')).toBe(true);
    expect(profile.name.length).toBeLessThanOrEqual(24);
  });
});

// ---------------------------------------------------------------- degenerates
describe('T17 · degenerate echoes (fail-closed, never NaN, never throws)', () => {
  it('refuses echoes fainter than MIN_INK placements', () => {
    expect(mine({ places: 0 })).toBeNull();
    expect(mine({ places: 1 })).toBeNull();
    expect(mine({ places: MIN_INK - 1 })).toBeNull();
    expect(mine({ places: MIN_INK })).not.toBeNull();
  });

  it('refuses logs whose wrong-ink rate exceeds the plausible-duel gate', () => {
    const { replay } = buildEcho({ places: 10, wrongAt: [0, 1, 2, 3, 4, 5] }); // 0.6
    expect(minePersonalShade(replay)).toBeNull();
    expect(UNRELIABLE_WRONG_RATE).toBe(0.5);
  });

  it('an all-wrong-but-plausible short log still mines, clamped at the envelope ceiling', () => {
    const r = mine({ places: 10, wrongAt: [0, 1, 2, 3] }); // 0.4 ≤ 0.5
    expect(r).not.toBeNull();
    expect(r!.profile.mistakeRate).toBeCloseTo(0.35, 5); // envelope max
  });

  it('zero casts mine a floor-aggression Shade, not a NaN', () => {
    const { profile } = mine({ casts: 0, places: 10 })!;
    expect(Number.isFinite(profile.aggression)).toBe(true);
    expect(profile.aggression).toBeGreaterThanOrEqual(0.15);
  });

  it('absurd timestamps (30s+ idles) cap to GAP_CAP and still mine a sane pace', () => {
    // 8 gaps × 400 s stays under the validator's 1 h duration ceiling
    const { profile, telemetry } = mine({ gapMs: [400_000], places: 8 })!;
    expect(telemetry.medianGapMs).toBeLessThanOrEqual(30_000);
    expect(profile.placeCadenceMs).toBeLessThanOrEqual(12_000);
    expect(Number.isFinite(profile.placeDelayMs[0])).toBe(true);
    expect(profile.placeDelayMs[1]).toBeLessThanOrEqual(PROFILE_ENVELOPE.placeDelayMaxMs);
  });

  it('duplicate-cell log lines fizzle without corrupting the wrong-ink rate', () => {
    const { profile, telemetry } = mine({ places: 8, duplicateCell: true })!;
    expect(telemetry.fizzled).toBe(1);
    expect(telemetry.wrong).toBe(0);
    // flawless ink mines a no-deliberate-error Shade: the envelope floor is 0
    // (deliberate zeros are legal — the practice Tablet depends on that)
    expect(profile.mistakeRate).toBe(0);
  });
});

// ---------------------------------------------------------------- purity + fuzz
describe('T17 · purity and hostile-input fuzz', () => {
  it('the same echo mines to the byte-identical profile, and the input is never mutated', () => {
    const { replay } = buildEcho({ places: 12, wrongAt: [2], casts: 2 });
    const before = JSON.stringify(replay);
    const a = minePersonalShade(replay)!;
    const b = minePersonalShade(replay)!;
    expect(JSON.stringify(replay)).toBe(before);
    expect(a.profile).toEqual(b.profile);
    expect(a.telemetry).toEqual(b.telemetry);
    expect(clampProfile(a.profile)).toEqual(a.profile); // already envelope-normalized
  });

  it('200 seeded payloads (half plausible duels, half garbage): never throws, null or envelope-valid', () => {
    const rng = new Rng('miner-fuzz');
    const abilities = ['augur', 'unseal', 'fairCopy', 'sever', 'hush', 'reckoning', 'smudge', 'tincture', 'miasma', 'ward', 'mirror', 'quarantine'] as const;
    let mined = 0;
    for (let i = 0; i < 200; i++) {
      const tier = (['Easy', 'Medium', 'Hard', 'Expert'] as const)[rng.int(4)];
      const actions: ReplayAction[] = [];
      let t = rng.int(5000);
      if (i % 2 === 0) {
        // plausible duel: solution-true ink at human-ish gaps (minable by design)
        const puz = generatePuzzle(`fuzz-${i}`, tier);
        const empties: number[] = [];
        for (let c = 0; c < 81; c++) if (!puz.givens[c]) empties.push(c);
        for (let k = 0; k < 14; k++) {
          t += 1500 + rng.int(6000);
          const cell = empties[k % empties.length];
          const digit = rng.next() < 0.92 ? puz.solution[cell] : 1 + rng.int(9);
          actions.push({ t, kind: 'place', cell, digit });
        }
      } else {
        // garbage: random cells/digits — the wrong-ink gate or MIN_INK should eat it
        const n = rng.int(80);
        for (let k = 0; k < n; k++) {
          t += rng.int(30000);
          const roll = rng.next();
          if (roll < 0.7) actions.push({ t, kind: 'place', cell: rng.int(81), digit: 1 + rng.int(9) });
          else if (roll < 0.95) {
            const id = abilities[rng.int(abilities.length)];
            const withCell = rng.next() < 0.4;
            const withUnit = !withCell && rng.next() < 0.3;
            actions.push({
              t, kind: 'ability', id,
              ...(withCell ? { cell: rng.int(81) } : {}),
              ...(withUnit ? { unit: `r${rng.int(9)}` } : {}),
            });
          } else actions.push({ t, kind: 'resign' });
        }
      }
      const payload = {
        v: 1,
        seed: `fuzz-${i}`,
        tier,
        orders: ['scholar', 'executioner'] as ['scholar', 'executioner'],
        names: ['Fuzz Clerk', 'Foe'],
        durationMs: Math.max(60_000, Math.min(3_600_000, t + 1000)),
        actions,
        outcome: { winner: ([0, 1, 'draw'] as const)[rng.int(3)], reason: 'seals' },
      };
      expect(validateReplay(payload), `fuzz ${i} must pass the validator by construction`).not.toBeNull();
      let out: unknown;
      expect(() => { out = minePersonalShade(payload); }).not.toThrow();
      if (out !== null) {
        const { profile, telemetry } = out as { profile: ShadeProfile; telemetry: EchoTelemetry };
        expect(clampProfile(profile)).toEqual(profile);
        expect(telemetry.placements).toBeGreaterThanOrEqual(MIN_INK);
        expect(telemetry.wrong / telemetry.placements).toBeLessThanOrEqual(UNRELIABLE_WRONG_RATE + 1e-9);
        mined++;
      }
    }
    expect(mined).toBeGreaterThan(50); // the plausible half actually reached the mining math
  });

  it('validator-hostile shapes never reach the math (miner defers to validateReplay)', () => {
    const bases = [
      null, 'string', 42, [],
      { v: 2 }, { v: 1 },
      { v: 1, seed: '', tier: 'Easy', orders: ['scholar', 'executioner'], names: ['a', 'b'], durationMs: 60000, actions: [] },
      { v: 1, seed: 'x'.repeat(129), tier: 'Easy', orders: ['scholar', 'executioner'], names: ['a', 'b'], durationMs: 60000, actions: [] },
      { v: 1, seed: 's', tier: 'Impossible', orders: ['scholar', 'executioner'], names: ['a', 'b'], durationMs: 60000, actions: [] },
      { v: 1, seed: 's', tier: 'Easy', orders: ['bob', 'executioner'], names: ['a', 'b'], durationMs: 60000, actions: [] },
      { v: 1, seed: 's', tier: 'Easy', orders: ['scholar', 'executioner'], names: ['a', 'b'], durationMs: 10, actions: [] },
      { v: 1, seed: 's', tier: 'Easy', orders: ['scholar', 'executioner'], names: ['a', 'b'], durationMs: 60000, actions: [{ t: -5, kind: 'resign' }] },
      { v: 1, seed: 's', tier: 'Easy', orders: ['scholar', 'executioner'], names: ['a', 'b'], durationMs: 60000, actions: [{ t: 0, kind: 'place', cell: 81, digit: 5 }] },
      { v: 1, seed: 's', tier: 'Easy', orders: ['scholar', 'executioner'], names: ['a', 'b'], durationMs: 60000, actions: [{ t: 0, kind: 'place', cell: 0, digit: 0 }] },
      { v: 1, seed: 's', tier: 'Easy', orders: ['scholar', 'executioner'], names: ['a', 'b'], durationMs: 60000, actions: [{ t: 0, kind: 'ability', id: 'armageddon' }] },
      { v: 1, seed: 's', tier: 'Easy', orders: ['scholar', 'executioner'], names: ['a', 'b'], durationMs: 60000, actions: [{ t: 0, kind: 'resign', cell: 3 }] },
    ];
    for (const [i, payload] of bases.entries()) {
      let out: unknown;
      expect(() => { out = minePersonalShade(payload); }, `hostile shape ${i}`).not.toThrow();
      expect(out, `hostile shape ${i}`).toBeNull();
    }
  });
});

// ---------------------------------------------------------------- round-trip
describe('T17 · round-trip: the mined Shade plays at the mined cadence', () => {
  const runMinedDuel = (profile: ShadeProfile, capMs = 150_000): number[] => {
    const puz = generatePuzzle('roundtrip', 'Easy');
    const st: DuelState = createDuel({
      seed: 'roundtrip',
      givens: Uint8Array.from(puz.givens),
      solution: Uint8Array.from(puz.solution),
      names: ['You', profile.name],
      orders: ['scholar', profile.order],
    });
    const rng = new Rng('roundtrip-shade');
    const gaps: number[] = [];
    let lastPlaceT = 0;
    let wake = 600;
    let guard = 0;
    while (st.phase === 'live' && st.clockMs < capMs && guard++ < 3000) {
      tick(st, 250);
      if (st.phase !== 'live' || st.clockMs < wake) continue;
      const a = shadeAct(st, 1, profile, () => rng.next(), st.clockMs);
      // cadence mirrors LocalDuel.shadeWake: post-action = the profile's ink cadence
      const after = Math.max(400, profile.placeCadenceMs ?? 900);
      if (a.kind === 'place') {
        const res = place(st, 1, a.cell, a.digit);
        if (res.ok && res.correct && lastPlaceT > 0) gaps.push(st.clockMs - lastPlaceT);
        if (res.ok && res.correct) lastPlaceT = st.clockMs;
        wake = st.clockMs + after;
      } else if (a.kind === 'ability') {
        useAbility(st, 1, a.id, { cell: a.cell, unit: a.unit });
        wake = st.clockMs + after;
      } else {
        wake = st.clockMs + Math.max(400, a.untilMs - st.clockMs);
      }
    }
    return gaps;
  };

  it('observed placement gaps track the mined ink cadence (tolerance 0.6×–1.6×)', () => {
    // cast-free echo: aggression sits at the 0.35 base, so the gap distribution is
    // dominated by the mined placeCadenceMs with occasional cast interleaves
    const mined = mine({ seed: 'roundtrip', places: 12, gapMs: [5000], casts: 0, winner: 0 })!;
    const cadence = mined.profile.placeCadenceMs!;
    expect(cadence).toBeGreaterThanOrEqual(PACE_FLOOR_LO_MS);
    const gaps = runMinedDuel(mined.profile);
    expect(gaps.length).toBeGreaterThanOrEqual(6);
    const observed = median(gaps);
    expect(observed).toBeGreaterThanOrEqual(cadence * 0.6);
    expect(observed).toBeLessThanOrEqual(cadence * 1.6);
  });

  it('a slow clerk mines a slow Shade, a fast clerk a fast one (cadence ordering)', () => {
    const slow = mine({ seed: 'cad-slow', places: 10, gapMs: [9000], casts: 0 })!.profile.placeCadenceMs!;
    const fast = mine({ seed: 'cad-fast', places: 10, gapMs: [2000], casts: 0 })!.profile.placeCadenceMs!;
    expect(slow).toBeGreaterThan(fast);
  });
});

const median = (xs: number[]): number => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
