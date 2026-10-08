// SeasonLedger law — the parts of S16 that can be pinned without native chrome.
//
// The web build keeps the tier math inline in ../src/app/game/SeasonLedger.tsx —
// the TIER_INK constant (:10), the tierCost/cumulative helpers (:11-12), the
// currentTier descending loop (:19-22), the weeks-left read (:24), the header
// progress bar (:33-35) and the claim handler (:57-69). This port extracts them
// (the reliquaryLaw/friendLaw precedent) so the gate can pin the season laws —
// the docs/BALANCE.md §Season Ledger contract: 30 tiers, tier n requires n × 100
// cumulative Season Ink, tier 30 ≈ 46 500 Ink over the 8-week season.
//
// The award-once law: on the web, a second claim is prevented ONLY by the
// button's disabled attribute (`claimable = unlocked && !claimedFree`, :43) —
// the handler itself re-pushes `f${n}` blindly. The spec 17 5.3 done-when is
// "a claim is idempotent — claiming twice grants once", so here the same
// outcome is pinned structurally: claimTier() refuses an id that is already in
// season.claimed, which makes the law testable and double-press-proof without
// changing any value the web grants.

export const SEASON_TIER_COUNT = 30;

/** TIER_INK — SeasonLedger.tsx:10 (docs/BALANCE.md: tier n costs n × 100 fresh Ink). */
export const TIER_INK = 100;

/** the web's tierCost (SeasonLedger.tsx:11) — tier n's own escalation step. */
export const tierCost = (n: number): number => TIER_INK * n;

/** the web's cumulative (SeasonLedger.tsx:12) — total Season Ink to REACH tier n. */
export const cumulative = (n: number): number => ((n * (n + 1)) / 2) * TIER_INK;

/** the web's currentTier loop (SeasonLedger.tsx:19-22): highest n with ink ≥ cumulative(n). */
export function tierFromInk(ink: number): number {
  for (let n = SEASON_TIER_COUNT; n >= 1; n--) if (ink >= cumulative(n)) return n;
  return 0;
}

/** the web's weeksLeft (SeasonLedger.tsx:24): whole 7-day weeks until turnover, floored at 0. */
export function weeksLeftIn(endsAt: number, now: number): number {
  return Math.max(0, Math.ceil((endsAt - now) / (7 * 86400_000)));
}

/** the season's tier kinds — i18n.season.tiers[n].type, the web's reward ternary's switch. */
export type TierType = 'ink' | 'sigil' | 'cosmetic';

/** the dictionary's tier type widens to string (JSON import); the web's ternary
 *  treats anything that is not ink/sigil as cosmetic — this is that coercion. */
export function tierTypeOf(v: string): TierType {
  return v === 'ink' ? 'ink' : v === 'sigil' ? 'sigil' : 'cosmetic';
}

/**
 * the web's reward law (SeasonLedger.tsx:50,62-66): an ink tier grants n × 10 Ink,
 * a sigil tier ⌈n / 4⌉ Sigils, a cosmetic tier grants nothing here (its reward
 * lives in the Cabinet). Zero is expressed in the untouched counters, never -0.
 */
export function tierReward(n: number, type: TierType): { ink: number; sigils: number } {
  if (type === 'ink') return { ink: n * 10, sigils: 0 };
  if (type === 'sigil') return { ink: 0, sigils: Math.ceil(n / 4) };
  return { ink: 0, sigils: 0 };
}

/** the claim id the save stores in season.claimed — the web's `f${n}` (SeasonLedger.tsx:61). */
export const claimId = (n: number): string => `f${n}`;

/** the recordInk duelId for a claimed ink tier — the web's `season-f${n}` (:68). */
export const seasonInkDuelId = (n: number): string => `season-f${n}`;

/** minimal structural view of the save this law touches (SaveStateV2 satisfies it). */
export interface SeasonSave {
  season: { ink: number; claimed: string[] };
  economy: { ink: number; sigils: number };
}

/** the law's output: the new claimed array + the new balances, spread-safe —
 *  the save's patron/endsAt (season) and reliquaryProgress/pending (economy)
 *  stay untouched, exactly as the web's spread update keeps them. */
export interface ClaimedSlices {
  claimed: string[];
  economy: { ink: number; sigils: number };
}

/**
 * The claim (SeasonLedger.tsx:57-69), all-or-nothing: out-of-range or
 * already-claimed → null and the save is untouched; otherwise the id joins
 * season.claimed and the tier's reward lands in the economy in the SAME
 * slices — a claim can never be marked without being granted, nor granted
 * twice. Unlock gating stays with the button (the web's `unlocked` ternary);
 * the law only enforces the award-once half.
 */
export function claimTier(save: SeasonSave, n: number, type: TierType): ClaimedSlices | null {
  if (!Number.isInteger(n) || n < 1 || n > SEASON_TIER_COUNT) return null;
  const id = claimId(n);
  if (save.season.claimed.includes(id)) return null; // the award-once law
  const reward = tierReward(n, type);
  return {
    claimed: [...save.season.claimed, id],
    economy: {
      ink: save.economy.ink + reward.ink,
      sigils: save.economy.sigils + reward.sigils,
    },
  };
}

/** the header bar's fill fraction (SeasonLedger.tsx:34), clamped to [0, 1] for the width math. */
export function progressFraction(ink: number, nextCost: number): number {
  if (nextCost <= 0) return 1;
  return Math.min(1, Math.max(0, ink / nextCost));
}
