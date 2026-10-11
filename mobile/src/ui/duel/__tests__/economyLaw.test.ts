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
import { describe, expect, it } from 'vitest';
import { dailyStreakFor, weeklySealFor } from '../economyLaw';
import { weeklyInkBonus } from '@shared/weekly';

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
