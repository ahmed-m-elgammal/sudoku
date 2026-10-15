// P2.2 — the taunt throttle law (docs/STORY_HOLD_PLAN.md P2.2).
//
// The court talks back, but never spams: ≥45 s between lines, never two in a
// row, never in the final 30 s. Selection draws the magistrate's unused taunt
// index through the caller's seeded rng (the pool resets once both are spent,
// so a long duel never goes mute forever).
import { describe, it, expect } from 'vitest';
import {
  eligibleTaunt, freshTauntState, TAUNT_COOLDOWN_MS, TAUNT_QUIET_MS,
  type TauntState,
} from '../shade';

const DUR = 600_000;
const state = (over: Partial<TauntState> = {}): TauntState => ({ ...freshTauntState(), ...over });

describe('eligibleTaunt (P2.2)', () => {
  it('fires on claim and mistake triggers inside the open window', () => {
    expect(eligibleTaunt('claim', 100_000, DUR, state(), () => 0)).toBe(0);
    expect(eligibleTaunt('mistake', 100_000, DUR, state(), () => 0.99)).toBe(1);
    expect(eligibleTaunt('phase', 100_000, DUR, state(), () => 0)).toBe(0);
  });

  it('a null or hostile trigger never speaks', () => {
    expect(eligibleTaunt(null, 100_000, DUR, state(), () => 0)).toBeNull();
    expect(eligibleTaunt('claim', NaN, DUR, state(), () => 0)).toBeNull();
    expect(eligibleTaunt('claim', 100_000, NaN, state(), () => 0)).toBeNull();
  });

  it('45 s cooldown from the last taunt', () => {
    const s = state({ lastTauntAtMs: 100_000 });
    expect(eligibleTaunt('claim', 100_000 + TAUNT_COOLDOWN_MS - 1, DUR, s, () => 0)).toBeNull();
    expect(eligibleTaunt('claim', 100_000 + TAUNT_COOLDOWN_MS, DUR, s, () => 0)).toBe(0);
  });

  it('no back-to-back taunts', () => {
    expect(eligibleTaunt('claim', 200_000, DUR, state({ lastEventWasTaunt: true }), () => 0)).toBeNull();
  });

  it('the final 30 s are taunt-silent for every trigger', () => {
    const t = DUR - TAUNT_QUIET_MS;
    expect(eligibleTaunt('claim', t, DUR, state(), () => 0)).toBe(0);
    for (const trig of ['claim', 'mistake', 'phase'] as const) {
      expect(eligibleTaunt(trig, t + 1, DUR, state(), () => 0)).toBeNull();
    }
  });

  it('draws the unused index, then resets the pool', () => {
    expect(eligibleTaunt('claim', 100_000, DUR, state({ usedIdx: [0] }), () => 0)).toBe(1);
    expect(eligibleTaunt('claim', 100_000, DUR, state({ usedIdx: [1] }), () => 0.99)).toBe(0);
    // both spent — the pool resets instead of going mute
    expect(eligibleTaunt('claim', 100_000, DUR, state({ usedIdx: [0, 1] }), () => 0)).toBe(0);
  });
});
