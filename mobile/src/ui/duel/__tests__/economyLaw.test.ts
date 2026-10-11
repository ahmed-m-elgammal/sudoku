// Pins the DAY2 economy laws lifted out of DuelScreen.finish() (report A13).
//
// The regressions this locks out:
//   · DAILY — a same-day re-sit of the daily duel INFLATED the streak on a re-win
//     (`Math.max(cur.streak, prevStreak + 1)` read prevStreak = cur.streak on a
//     re-sit) and ZEROED it on a re-loss. The day's first verdict is the seal;
//     replays may better the time, never the ledger.
//   · WEEKLY — `weekly.lastWeek` was written on EVERY finish, so losing the weekly
//     duel permanently forfeited that week's +120 (a loss had placed the seal).
//     Only a win seals; only the first seal pays.
//
// The shipped first-sit law (the web build's, verbatim) is pinned too, so a future
// "fix" cannot silently change the port-fidelity contract.
//
// DAY3 (report A15) adds `practiceInkFor`: `CONFIG.economy.practiceDailyInkCap: 50`
// was referenced by NOTHING — daily and practice both duel the inert Tablet, so a
// re-sit farm minted unlimited per-attempt ledger ids at up to 111 Ink each. The
// law: a per-UTC-day budget over BOTH Tablet modes; a new day refills it.
import { describe, expect, it } from 'vitest';
import { dailyStreakFor, weeklySealFor, practiceInkFor } from '../economyLaw';
import { weeklyInkBonus } from '@shared/weekly';
import { CONFIG } from '@shared/config';
import { freshSave } from '@/state/save';

const KEY = '2026-10-11';

describe('dailyStreakFor — the daily ledger (A13)', () => {
  it('ECON-1 a same-day re-win no longer inflates the streak', () => {
    const cur = { lastDate: KEY, streak: 2, best: 4 };
    const next = dailyStreakFor(cur, KEY, true);
    expect(next.streak).toBe(2); // the old line produced 3 — and again on every replay
    expect(next.best).toBe(4);
    expect(next.lastDate).toBe(KEY);
  });

  it('ECON-2 a same-day re-loss no longer zeroes a streak the morning earned', () => {
    const cur = { lastDate: KEY, streak: 2, best: 4 };
    const next = dailyStreakFor(cur, KEY, false);
    expect(next.streak).toBe(2); // the old line produced 0
    expect(next.best).toBe(4);
  });

  it('ECON-3 the first sit of a NEW day keeps the shipped web law, byte for byte', () => {
    // a win on a fresh day: streak = max(cur, prev+1) with prevStreak = 0
    expect(dailyStreakFor({ lastDate: '2026-10-10', streak: 5, best: 9 }, KEY, true)).toEqual({
      lastDate: KEY,
      streak: 5, // max(5, 1) — the shipped law (port fidelity; NOT re-litigated here)
      best: 9, //    max(9, 1)
    });
    // a loss on a fresh day zeroes the ledger (the one chance that day was lost)
    expect(dailyStreakFor({ lastDate: '2026-10-10', streak: 5, best: 9 }, KEY, false)).toEqual({
      lastDate: KEY,
      streak: 0,
      best: 9,
    });
    // the very first daily ever: lastDate is null and the floor is 1
    expect(dailyStreakFor({ lastDate: null, streak: 0, best: 0 }, KEY, true)).toEqual({
      lastDate: KEY,
      streak: 1,
      best: 1,
    });
  });
});

describe('weeklySealFor — the weekly seal (A13)', () => {
  it('ECON-4 a loss never seals the week — the +120 stays re-fightable', () => {
    // the week was never sat: a loss leaves it open
    expect(weeklySealFor(null, 700, false)).toEqual({ lastWeek: null, bonus: 0, firstWin: false });
    // the regression: the old code wrote lastWeek unconditionally, sealing the week
    // with a LOSS and forfeiting the bonus forever
    expect(weeklySealFor(null, 700, false).lastWeek).not.toBe(700);
    // an earlier week's seal is not overwritten by a loss
    expect(weeklySealFor(699, 700, false)).toEqual({ lastWeek: 699, bonus: 0, firstWin: false });
  });

  it('ECON-5 a win seals the week and pays exactly once', () => {
    // first win of the week: the seal lands and the bonus pays
    expect(weeklySealFor(null, 700, true)).toEqual({
      lastWeek: 700,
      bonus: weeklyInkBonus,
      firstWin: true,
    });
    // a second win the SAME week: still sealed, no double pay
    expect(weeklySealFor(700, 700, true)).toEqual({
      lastWeek: 700,
      bonus: 0,
      firstWin: false,
    });
    // a win in a LATER week: the new seal pays again (the weekly loop)
    expect(weeklySealFor(700, 701, true)).toEqual({
      lastWeek: 701,
      bonus: weeklyInkBonus,
      firstWin: true,
    });
  });
});

describe('practiceInkFor — the Tablet-modes Ink budget (A15)', () => {
  const CAP = CONFIG.economy.practiceDailyInkCap; // 50

  it('FARM-1 a fresh day pays in full up to the cap', () => {
    const out = practiceInkFor({ day: null, ink: 0 }, KEY, 30 + 5 * 3, CAP);
    expect(out.credited).toBe(45);
    expect(out.farm).toEqual({ day: KEY, ink: 45 });
  });

  it('FARM-2 a fresh day clips everything past the cap — and the clip is the purse\'s truth', () => {
    // a perfect Tablet sweep: 30 + 27 claims × 3 = 111 raw, capped at 50
    const out = practiceInkFor({ day: null, ink: 0 }, KEY, 111, CAP);
    expect(out.credited).toBe(50);
    expect(out.farm.ink).toBe(50);
  });

  it('FARM-3 a same-day re-sit spends only the remainder', () => {
    const out = practiceInkFor({ day: KEY, ink: 45 }, KEY, 40, CAP);
    expect(out.credited).toBe(5);
    expect(out.farm).toEqual({ day: KEY, ink: 50 });
  });

  it('FARM-4 an exhausted day credits nothing — the ledger\'s delta-0 guard then mints no entry', () => {
    const out = practiceInkFor({ day: KEY, ink: 50 }, KEY, 111, CAP);
    expect(out.credited).toBe(0);
    expect(out.farm).toEqual({ day: KEY, ink: 50 });
  });

  it('FARM-5 a new day refills the budget and moves the rows', () => {
    const out = practiceInkFor({ day: '2026-10-10', ink: 50 }, KEY, 60, CAP);
    expect(out.credited).toBe(50);
    expect(out.farm).toEqual({ day: KEY, ink: 50 });
  });

  it('FARM-6 both Tablet modes draw the SAME pool — the farm cannot move between them', () => {
    // the daily drains the budget…
    const daily = practiceInkFor({ day: null, ink: 0 }, KEY, 50, CAP);
    expect(daily.credited).toBe(50);
    // …and the practice duel after it earns nothing
    const practice = practiceInkFor(daily.farm, KEY, 111, CAP);
    expect(practice.credited).toBe(0);
  });

  it('FARM-7 the shipped cap is 50 and the fresh save boots with an empty budget', () => {
    // the config contract cannot drift silently; the save shape carries the rows
    expect(CAP).toBe(50);
    const fresh = freshSave('test');
    expect(fresh.daily.farmInkDay).toBeNull();
    expect(fresh.daily.farmInk).toBe(0);
  });
});
