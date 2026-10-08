// The replay-entry law (src/ui/screens/replayEntry.ts) — G13, M1 item 7.
//
// The Antechamber card and the Settings row are two doors into ONE payload; these
// tests pin the payload itself and the routing it produces in the real screen
// machine. (The Antechamber cannot render under vitest — its module-scope asset
// requires are Metro-only — so the hub's press-wiring is covered by tsc + the shared
// builder, and the end-to-end press proof lives in settingsReplay.test.tsx.)
//
//   ENTRY-1  the payload shape: mode pinned to 'tutorial', the nonce bumped, the
//            stale verdict/server fields nulled
//   ENTRY-2  routed through the REAL store it re-enters the tutorial with a clean
//            duel context (no lastResult, no serverDuel, mode corrected)
//   ENTRY-3  the dictionary law: the single key pair exists on mobile AND web with
//            equal values (the game's voice stays one voice)
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useUi } from '@/state/ui';
import { i18n } from '@/i18n';
import { tutorialReplayPayload } from '../replayEntry';
import webEn from '../../../../../src/i18n/en.json';
import mobileEn from '@/i18n/en.json';

/** the store's own state type — UiStore itself is not exported */
type UiState = ReturnType<typeof useUi.getState>;

beforeEach(() => {
  // a dirty session: the entry must clean up whatever the last mode left behind
  useUi.setState({
    screen: 'antechamber',
    prev: 'result',
    duelMode: 'endless',
    duelNonce: 40,
    lastResult: { winner: 1 } as unknown as UiState['lastResult'],
    serverDuel: { duelId: 'stale' } as unknown as UiState['serverDuel'],
    campaignDuel: { folio: 2, duel: 1 },
    endlessRung: 9,
  });
});

afterEach(() => {
  useUi.setState({
    screen: 'boot', prev: null, duelMode: 'tutorial', duelNonce: 0,
    lastResult: null, serverDuel: null, campaignDuel: null, endlessRung: null,
  });
});

describe('tutorialReplayPayload · the one replay door (M1 G13)', () => {
  it('ENTRY-1 pins the mode, bumps the nonce, clears the stale duel fields', () => {
    expect(tutorialReplayPayload(40)).toEqual({
      duelMode: 'tutorial',
      duelNonce: 41,
      lastResult: null,
      serverDuel: null,
    });
  });

  it('ENTRY-2 routed through the real store it lands in a clean tutorial duel', () => {
    const ui = useUi.getState();
    ui.go('tutorial', tutorialReplayPayload(ui.duelNonce));
    const after = useUi.getState();
    expect(after.screen).toBe('tutorial');
    expect(after.duelMode).toBe('tutorial'); // the endless mode is corrected
    expect(after.duelNonce).toBe(41); // the shell remounts DuelScreen fresh
    expect(after.lastResult).toBeNull(); // no stale verdict feeds the result screen
    expect(after.serverDuel).toBeNull(); // no stale server init hijacks the runtime
    expect(after.prev).toBe('antechamber'); // back pops out of the lesson honestly
  });

  it('ENTRY-3 the single dictionary key pair exists on both dictionaries, equal', () => {
    // the JSON imports carry their own types: the keys must EXIST, so a typo fails
    // to compile before it can fail this assertion
    expect(mobileEn.tutorial.relearn.length).toBeGreaterThan(0);
    expect(mobileEn.tutorial.relearnSub.length).toBeGreaterThan(0);
    expect(webEn.tutorial.relearn).toBe(mobileEn.tutorial.relearn); // the superset law, pinned
    expect(webEn.tutorial.relearnSub).toBe(mobileEn.tutorial.relearnSub);
    expect(mobileEn.tutorial.relearn).toBe('Relearn the Reckoning');
  });
});
