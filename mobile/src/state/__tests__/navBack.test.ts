// Pins the DAY2 back-nav hardening in the screen machine (ui.ts).
//
// The regression cluster this locks out (the report's 3.3.4, one subsystem):
//   · back on the HUB popped to `prev:'boot'` — the splash re-showed and
//     auto-advanced 1.2 s later; the app could never be left from the root screen.
//   · back on the RESULT popped into 'duel' — GameShell remounted a brand-new duel
//     with the same spec, and finishing that replayed daily re-awarded its ink
//     (the duplicate-reward path).
//   · a live duel was left with no confirm at all (the guard's store contract).
//
// The law now: root screens return false (the OS exits the app), dead-end
// destinations remap to the hub, and a screen-owned guard is stored for GameShell's
// single BackHandler to consult fresh at the call.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useUi } from '@/state/ui';

const reset = () =>
  useUi.setState({
    screen: 'boot',
    prev: null,
    backGuard: null,
    story: null,
    lastResult: null,
  });

beforeEach(reset);
afterEach(reset);

describe('goBack — the DAY2 nav law', () => {
  it('NAV-1 a root screen never pops — the OS exits the app (the hub↔splash bounce is dead)', () => {
    for (const root of ['antechamber', 'boot'] as const) {
      useUi.setState({ screen: root, prev: 'boot' });
      expect(useUi.getState().goBack()).toBe(false);
      expect(useUi.getState().screen).toBe(root); // the splash does NOT re-show
      expect(useUi.getState().prev).toBe('boot'); // untouched — no page turn fired
    }
  });

  it('NAV-2 no prev and no root — the gesture falls through (false)', () => {
    // a cold-start tutorial (boot() sets the screen without a prev): back exits.
    useUi.setState({ screen: 'tutorial', prev: null });
    expect(useUi.getState().goBack()).toBe(false);
    expect(useUi.getState().screen).toBe('tutorial');
  });

  it('NAV-3 the result NEVER pops back into a duel — the double-ink path is closed', () => {
    // layer 1: the finish() route overrides prev to the hub, so the pop lands there
    useUi.setState({ screen: 'duel', prev: 'daily', duelMode: 'daily' });
    useUi.getState().go('result', { prev: 'antechamber' });
    expect(useUi.getState().screen).toBe('result');
    expect(useUi.getState().prev).toBe('antechamber');
    expect(useUi.getState().goBack()).toBe(true);
    expect(useUi.getState().screen).toBe('antechamber');
    // layer 2: even a STALE prev:'duel' (any path that forgot the override) remaps
    // to the hub by the dead-end law — a duel screen is never a back destination
    useUi.setState({ screen: 'result', prev: 'duel' });
    expect(useUi.getState().goBack()).toBe(true);
    expect(useUi.getState().screen).toBe('antechamber');
    expect(useUi.getState().screen).not.toBe('duel');
  });

  it('NAV-4 every dead-end destination remaps to the hub', () => {
    for (const deadEnd of ['boot', 'duel', 'tutorial', 'story', 'endingChoice', 'reliquary'] as const) {
      useUi.setState({ screen: 'settings', prev: deadEnd });
      expect(useUi.getState().goBack()).toBe(true);
      expect(useUi.getState().screen).toBe('antechamber');
      expect(useUi.getState().prev).toBeNull();
      reset();
    }
  });

  it('NAV-5 a normal pop still works, exactly once', () => {
    useUi.setState({ screen: 'settings', prev: 'antechamber' });
    expect(useUi.getState().goBack()).toBe(true);
    expect(useUi.getState().screen).toBe('antechamber');
    expect(useUi.getState().prev).toBeNull();
    // popped ONCE: prev was cleared, so the next back is the root/exit gesture
    expect(useUi.getState().goBack()).toBe(false);
  });
});

describe('backGuard — the duel screen intercept (DAY2)', () => {
  it('NAV-6 the guard round-trips through the store for GameShell to consult fresh', () => {
    const guard = () => true;
    useUi.getState().setBackGuard(guard);
    expect(useUi.getState().backGuard).toBe(guard);
    useUi.getState().setBackGuard(null);
    expect(useUi.getState().backGuard).toBeNull();
  });

  it('NAV-7 the guard consumes the gesture without popping; a false guard lets the pop through', () => {
    // the GameShell law: guard() true → the event is consumed, the screen holds
    useUi.setState({ screen: 'duel', prev: 'antechamber' });
    useUi.getState().setBackGuard(() => true);
    expect(useUi.getState().backGuard?.()).toBe(true);
    expect(useUi.getState().screen).toBe('duel'); // the duel was NOT abandoned
    // guard() false (the skeleton path) → the shell pops as usual
    useUi.getState().setBackGuard(() => false);
    expect(useUi.getState().backGuard?.()).toBe(false);
    expect(useUi.getState().goBack()).toBe(true);
    expect(useUi.getState().screen).toBe('antechamber');
  });
});
