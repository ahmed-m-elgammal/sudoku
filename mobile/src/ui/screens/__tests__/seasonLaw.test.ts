// SeasonLedger law — the gate for specs/17 phase 5.3's math half.
//
// The docs/BALANCE.md §Season Ledger contract, pinned: 30 tiers, tier n requires
// n × 100 cumulative Season Ink, tier 30 ≈ 46 500 Ink; the web’s descending
// currentTier loop, the weeks-left ceiling, the reward ternary and the award-once
// claim (the 5.3 done-when: "a claim is idempotent — claiming twice grants once").
import { describe, it, expect } from 'vitest';
import {
  claimTier, claimId, cumulative, progressFraction, seasonInkDuelId,
  SEASON_TIER_COUNT, tierCost, tierFromInk, tierReward, TIER_INK, weeksLeftIn,
} from '@/ui/screens/seasonLaw';

const baseSave = (ink = 0, claimed: string[] = []) => ({
  season: { ink, claimed },
  economy: { ink: 0, sigils: 0 },
});

describe('the tier escalation (docs/BALANCE.md §Season Ledger)', () => {
  it('tier n costs n × 100 fresh Ink, reaching tier n takes the triangular sum', () => {
    expect(TIER_INK).toBe(100);
    expect(SEASON_TIER_COUNT).toBe(30);
    expect(tierCost(1)).toBe(100);
    expect(tierCost(30)).toBe(3000);
    expect(cumulative(1)).toBe(100);
    expect(cumulative(2)).toBe(300); // 100 + 200
    expect(cumulative(3)).toBe(600); // 100 + 200 + 300
    expect(cumulative(30)).toBe(46_500); // the balance doc's own ≈46 500
  });

  it('currentTier: the highest tier the ink has paid for (the web’s descending loop)', () => {
    expect(tierFromInk(0)).toBe(0);
    expect(tierFromInk(99)).toBe(0);
    expect(tierFromInk(100)).toBe(1);
    expect(tierFromInk(299)).toBe(1);
    expect(tierFromInk(300)).toBe(2);
    expect(tierFromInk(46_499)).toBe(29);
    expect(tierFromInk(46_500)).toBe(30);
    expect(tierFromInk(999_999)).toBe(30); // the loop caps at 30
  });
});

describe('the season timer (the web’s weeksLeft)', () => {
  it('ceil whole 7-day weeks until turnover', () => {
    expect(weeksLeftIn(0, 0)).toBe(0);
    expect(weeksLeftIn(7 * 86400_000, 0)).toBe(1);
    expect(weeksLeftIn(7 * 86400_000 + 1, 0)).toBe(2);
    expect(weeksLeftIn(8 * 7 * 86400_000, 0)).toBe(8); // freshSave's season
  });

  it('floors at zero when the season has already turned', () => {
    expect(weeksLeftIn(1000, 8 * 7 * 86400_000)).toBe(0);
    expect(weeksLeftIn(-5, 0)).toBe(0);
  });
});

describe('the reward law (the web’s ternary)', () => {
  it('an ink tier grants n × 10 Ink', () => {
    expect(tierReward(1, 'ink')).toEqual({ ink: 10, sigils: 0 });
    expect(tierReward(8, 'ink')).toEqual({ ink: 80, sigils: 0 });
    expect(tierReward(30, 'ink')).toEqual({ ink: 300, sigils: 0 });
  });

  it('a sigil tier grants ⌈n/4⌉ Sigils', () => {
    expect(tierReward(1, 'sigil').sigils).toBe(1);
    expect(tierReward(4, 'sigil').sigils).toBe(1);
    expect(tierReward(5, 'sigil').sigils).toBe(2);
    expect(tierReward(8, 'sigil').sigils).toBe(2);
    expect(tierReward(9, 'sigil').sigils).toBe(3);
  });

  it('a cosmetic tier grants nothing here (the Cabinet owns it)', () => {
    expect(tierReward(2, 'cosmetic')).toEqual({ ink: 0, sigils: 0 });
  });
});

describe('the claim — award once (the 5.3 done-when)', () => {
  it('marks the tier and grants the reward in the same all-or-nothing verdict', () => {
    const next = claimTier(baseSave(100), 1, 'ink');
    expect(next).not.toBeNull();
    expect(next!.claimed).toEqual(['f1']);
    expect(next!.economy).toEqual({ ink: 10, sigils: 0 });
  });

  it('claiming twice grants once — the second claim is refused untouched', () => {
    const save = baseSave(100, ['f1']);
    expect(claimTier(save, 1, 'ink')).toBeNull();
  });

  it('a sigil claim touches only the sigil counter', () => {
    const next = claimTier(baseSave(1500), 5, 'sigil')!;
    expect(next.economy.sigils).toBe(2);
    expect(next.economy.ink).toBe(0);
    expect(next.claimed).toEqual(['f5']);
  });

  it('a cosmetic claim moves only the claimed array', () => {
    const next = claimTier(baseSave(300), 2, 'cosmetic')!;
    expect(next.economy).toEqual({ ink: 0, sigils: 0 });
    expect(next.claimed).toEqual(['f2']);
  });

  it('out-of-range tiers are refused', () => {
    expect(claimTier(baseSave(999_999), 0, 'ink')).toBeNull();
    expect(claimTier(baseSave(999_999), 31, 'ink')).toBeNull();
    expect(claimTier(baseSave(999_999), 1.5, 'ink')).toBeNull();
  });

  it('the ids ride the web’s shapes: f{n} in the save, season-f{n} in the ledger', () => {
    expect(claimId(7)).toBe('f7');
    expect(seasonInkDuelId(7)).toBe('season-f7');
  });
});

describe('the header bar (the web’s fill width)', () => {
  it('clamps to [0, 1]', () => {
    expect(progressFraction(0, 100)).toBe(0);
    expect(progressFraction(50, 100)).toBe(0.5);
    expect(progressFraction(100, 100)).toBe(1);
    expect(progressFraction(900, 100)).toBe(1);
    expect(progressFraction(10, 0)).toBe(1); // no division by zero at the cap
  });
});
