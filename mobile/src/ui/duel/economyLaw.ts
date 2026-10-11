// economyLaw.ts — the daily-streak and weekly-seal laws of DuelScreen.finish().
//
// DAY2 (report A13) — the ~250-line finish() block had no mobile test; these are the
// two economy lines the audit flagged, lifted OUT of the screen into pure, pinned
// functions. The screen now calls them; the gate proves them.
//
// The laws are the WEB build's, with exactly one repair each — the flagged defect
// and nothing else:
//
//  · DAILY — the shipped first-sit law is preserved byte-for-byte (`streak: win ?
//    max(cur, prev+1) : 0`, `best: max(cur.best, prev+1)`, `prevStreak` read only
//    when the day was already sat). The repair: a SAME-DAY re-sit no longer touches
//    streak/best at all. The old line `Math.max(cur.daily.streak, prevStreak + 1)`
//    read prevStreak = cur.streak on a re-sit, so every re-win inflated the streak
//    by one — and a re-loss zeroed a streak the morning's win had already earned.
//    The day's first verdict is the seal; replays may better the TIME, never the
//    ledger. (times[] stays in the screen — the leaderboard time is integrity-
//    neutral and still improves on a re-sit.)
//
//  · WEEKLY — `weekly.lastWeek` was written on EVERY finish, so losing the weekly
//    duel permanently forfeited that week's +120 (the seal was placed by a loss).
//    The repair: only a WIN seals the week. A loss leaves it unsealed — the writ
//    can be re-fought; a second win the same week is not a first win and re-pays
//    nothing.
//
//  · PRACTICE/DAILY INK CAP (DAY3, report A15) — `CONFIG.ink.practiceDailyInkCap: 50`
//    was referenced by nothing: daily and practice both duel the inert Tablet (an
//    opponent that never plays), so a re-sit farm minted unlimited per-attempt ledger
//    ids at up to 111 Ink each. The repair enforces the shipped cap as a per-UTC-day
//    budget over BOTH Tablet modes combined — the first sit of the day pays up to the
//    cap, everything past it credits 0. The purse, the ledger entry and the result
//    screen all see the CREDITED amount, so the three never disagree.

import { weeklyInkBonus } from '@shared/weekly';

/** The streak-relevant slice of `save.daily`. */
export interface DailyStreakState {
  lastDate: string | null;
  streak: number;
  best: number;
}

/** The streak-relevant rows the screen writes back into `save.daily`. */
export interface DailyStreakUpdate {
  lastDate: string;
  streak: number;
  best: number;
}

/**
 * The daily streak ledger for a finished daily duel.
 *
 * @param cur  the save's daily ledger BEFORE the update
 * @param key  today's UTC date key
 * @param won  whether the Clerk won the duel
 */
export function dailyStreakFor(cur: DailyStreakState, key: string, won: boolean): DailyStreakUpdate {
  // Same-day re-sit: the day is already sealed. Re-win inflates nothing; re-loss
  // zeroes nothing.
  if (cur.lastDate === key) return { lastDate: key, streak: cur.streak, best: cur.best };
  // First sit of the day — the shipped web law, verbatim (prevStreak is 0: the
  // ledger reads the SAME day only, so a new day opens from the floor).
  return {
    lastDate: key,
    streak: won ? Math.max(cur.streak, 1) : 0,
    best: Math.max(cur.best, 1),
  };
}

/** The weekly rows the screen writes back into `save.weekly`, plus the bonus. */
export interface WeeklySealUpdate {
  lastWeek: number | null;
  bonus: number;
  firstWin: boolean;
}
/**
 * The weekly seal for a finished weekly duel. Only a win seals the week and only
 * the first seal pays the +120 (`weeklyInkBonus`); a loss leaves the writ open.
 *
 * @param curLastWeek  the save's `weekly.lastWeek` BEFORE the update
 * @param week         this week's index (`weekIndexFor`)
 * @param won          whether the Clerk won the duel
 */
export function weeklySealFor(curLastWeek: number | null, week: number, won: boolean): WeeklySealUpdate {
  const firstWin = won && curLastWeek !== week;
  return {
    lastWeek: won ? week : curLastWeek,
    bonus: firstWin ? weeklyInkBonus : 0,
    firstWin,
  };
}

/** The farm-budget rows this screen reads out of `save.daily`. */
export interface PracticeInkState {
  /** the UTC day key the running total belongs to */
  day: string | null;
  /** Ink credited so far from the Tablet modes, this day */
  ink: number;
}

/** What the screen writes back, plus the amount that actually credits. */
export interface PracticeInkUpdate {
  /** the credited delta — what the purse, the ledger entry and the result show */
  credited: number;
  /** the rows to write back into `save.daily` */
  farm: { day: string; ink: number };
}

/**
 * The Tablet-modes Ink budget for a finished practice/daily duel (A15).
 *
 * The cap is the shipped `CONFIG.ink.practiceDailyInkCap` — a per-UTC-day budget
 * shared by both Tablet modes. A new day refills it; a same-day re-sit spends what
 * is left, and past the cap credits nothing (the ledger's own delta-0 guard then
 * mints no entry at all).
 *
 * @param cur    the save's farm rows BEFORE the update
 * @param key    today's UTC date key
 * @param earned the duel's raw Ink (result + claims) before the cap
 * @param cap    `CONFIG.ink.practiceDailyInkCap`
 */
export function practiceInkFor(cur: PracticeInkState, key: string, earned: number, cap: number): PracticeInkUpdate {
  const sameDay = cur.day === key;
  const spent = sameDay ? Math.max(0, cur.ink) : 0;
  const budget = Math.max(0, cap - spent);
  const credited = Math.max(0, Math.min(earned, budget));
  return { credited, farm: { day: key, ink: spent + credited } };
}
