// Pins the DAY1 integrity fix: the Shade is kin to the player's engine clock, not a
// wall-clock free agent.
//
// The regression this locks out: the foe's cadence lives on wall-clock setTimeout
// timers. Pausing gated only the rAF engine loop, and Android keeps firing JS timers
// with the app backgrounded — so pausing (or switching apps) handed the foe ~1
// placement per cadence while the player's clock did not move. shadeWake() must hold
// (a cheap no-op re-arm) while `paused || backgrounded`, before every acting path,
// and resume within SHADE_HOLD_MS of the clock restarting.
//
// Harness: the tutorialUnlosable pattern — a no-op requestAnimationFrame stub (the
// engine loop never advances; irrelevant here) + fake timers driving the Shade's
// timer chain. `progress` counts correct foe placements, so wrong-digit clears can
// never mask a stall or fake an advance.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LocalDuel } from '@/game/localDuel';

function makeDuel() {
  return new LocalDuel({
    mode: 'practice', seed: 'shade-hold-seed', tier: 'Easy',
    orders: ['scholar', 'executioner'], names: ['You', 'Foe'],
  });
}

const foeProgress = (d: LocalDuel) => d.state.players[1].progress;

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('requestAnimationFrame', () => 0);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('LocalDuel · the frozen-clock hold (DAY1 integrity fix)', () => {
  it('HOLD-1 the baseline: a running duel\'s Shade places within a few cadences', () => {
    const duel = makeDuel();
    const baseline = foeProgress(duel);
    duel.start();
    vi.advanceTimersByTime(6000);
    expect(foeProgress(duel)).toBeGreaterThan(baseline);
    duel.destroy();
  });

  it('HOLD-2 pausing the duel freezes the Shade — zero foe ink while paused', () => {
    const duel = makeDuel();
    const baseline = foeProgress(duel);
    duel.setPaused(true);
    duel.start();
    vi.advanceTimersByTime(6000);
    expect(foeProgress(duel)).toBe(baseline);
    duel.destroy();
  });

  it('HOLD-3 backgrounding the duel freezes the Shade (the Android timer leak)', () => {
    const duel = makeDuel();
    const baseline = foeProgress(duel);
    duel.setBackgrounded(true);
    duel.start();
    vi.advanceTimersByTime(6000);
    expect(foeProgress(duel)).toBe(baseline);
    duel.destroy();
  });

  it('HOLD-4 the foe restarts within the hold cadence of un-backgrounding', () => {
    const duel = makeDuel();
    const baseline = foeProgress(duel);
    duel.setBackgrounded(true);
    duel.start();
    vi.advanceTimersByTime(6000);
    expect(foeProgress(duel)).toBe(baseline);
    duel.setBackgrounded(false);
    vi.advanceTimersByTime(6000);
    expect(foeProgress(duel)).toBeGreaterThan(baseline);
    duel.destroy();
  });

  it('HOLD-5 setBackgrounded is idempotent — a repeated state change wakes nobody', () => {
    const duel = makeDuel();
    duel.setBackgrounded(true);
    vi.advanceTimersByTime(70); // step past the 66 ms notify throttle (the SNAP law)
    let notifications = 0;
    duel.subscribe(() => { notifications++; });
    duel.setBackgrounded(true); // no change: no wake, even past the throttle window
    vi.advanceTimersByTime(70);
    expect(notifications).toBe(0);
    duel.setBackgrounded(false); // the change itself wakes exactly once
    vi.advanceTimersByTime(70);
    expect(notifications).toBe(1);
    duel.setBackgrounded(false); // still no change: still no wake
    vi.advanceTimersByTime(70);
    expect(notifications).toBe(1);
    duel.destroy();
  });
});
