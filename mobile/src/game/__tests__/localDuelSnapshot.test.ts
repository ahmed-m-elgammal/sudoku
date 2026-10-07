// Pins the render-signal contract that keeps the duel tappable on a phone.
//
// LocalDuel bumps `version` on every mutation AND every rAF frame (~60/s), while
// listeners are notified at ~15fps. useSyncExternalStore re-checks the snapshot in a
// passive effect after every commit and FORCE-re-renders when it moved — so if
// getSnapshot() ever serves the raw version, React loops render → stale → force-render
// forever, pegs the JS thread, and touch handlers starve ("the duel ignores taps" on
// device). The snapshot must therefore move ONLY when listeners fire.
//
// Regression: the first device build served `version` directly and shipped exactly that
// failure (Expo Go, Android).
import { describe, expect, it } from 'vitest';
import { LocalDuel } from '@/game/localDuel';

function makeDuel() {
  return new LocalDuel({
    mode: 'practice', seed: 'snapshot-seed', tier: 'Easy',
    orders: ['scholar', 'executioner'], names: ['You', 'Foe'],
  });
}

describe('LocalDuel · the render signal (getSnapshot)', () => {
  it('SNAP-1 unnotified bumps NEVER move the snapshot (no React force-render spiral)', () => {
    const duel = makeDuel();
    duel.bumpPublic(); // prime the throttle — the very first bump always notifies (lastNotifyAt is 0)
    const before = duel.getSnapshot();
    // A stretch of engine frames between notifications: version runs ahead, snapshot holds.
    for (let i = 0; i < 200; i++) duel.bumpPublic();
    expect(duel.version).toBeGreaterThan(before + 100); // the counter did advance…
    expect(duel.getSnapshot()).toBe(before);            // …but React saw nothing move
    duel.destroy();
  });

  it('SNAP-2 the snapshot advances exactly when listeners fire', async () => {
    const duel = makeDuel();
    const seen: number[] = [];
    const unsub = duel.subscribe(() => seen.push(duel.getSnapshot()));

    duel.bumpPublic(); // first call: lastNotifyAt is still 0 → notifies immediately
    expect(seen.length).toBe(1);
    const afterFirst = duel.getSnapshot();
    expect(afterFirst).toBe(seen[0]);

    for (let i = 0; i < 50; i++) duel.bumpPublic(); // all inside the 66ms throttle window
    expect(seen.length).toBe(1);                    // still one notification…
    expect(duel.getSnapshot()).toBe(afterFirst);    // …and one snapshot

    await new Promise((r) => setTimeout(r, 70));    // step past the throttle window
    unsub();
    duel.bumpPublic();
    expect(duel.getSnapshot()).not.toBe(afterFirst); // the window elapsed → notify → snapshot moves
    duel.destroy();
  });
});
