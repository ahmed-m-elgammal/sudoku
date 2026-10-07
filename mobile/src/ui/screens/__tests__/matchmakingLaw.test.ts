// Matchmaking laws — the Summoning screen's pure core (specs/17 phase 4.4).
//
// The queue timing, the Shade fallback's honest labelling (R7) and the 'matched'
// mapping are the parts of the screen that can silently rot: a wrong wait constant
// races the server's own fallback, a wrong mapping sends the duel screen a mirror it
// cannot authorise. These pins walk the web build's values verbatim.
import { describe, expect, it } from 'vitest';
import {
  SHADE_FALLBACK_NAMES, SHADE_FALLBACK_WAIT_MS,
  matchedToNav, shadeFallbackName, shadeFallbackNav,
} from '@/ui/screens/matchmakingLaw';
import { CONFIG } from '@shared/config';

describe('the Shade fallback clock', () => {
  it('WAIT-1 the client waits just past the server\'s own 4 s fallback (+500 ms margin)', () => {
    expect(SHADE_FALLBACK_WAIT_MS).toBe(CONFIG.matchmaking.shadeFallbackMs + 500);
    expect(SHADE_FALLBACK_WAIT_MS).toBe(4500);
  });

  it('WAIT-2 the fallback foe is one of the web\'s four named Shades, honestly labelled', () => {
    for (let i = 0; i < 40; i++) {
      const name = shadeFallbackName();
      expect(name).toMatch(/^Shade of /);
      expect(SHADE_FALLBACK_NAMES.some((n) => name === `Shade of ${n}`)).toBe(true);
    }
  });
});

describe("the 'matched' mapping (socket payload -> versus payload)", () => {
  const save = { name: 'Clerk One', order: 'scholar' as const };

  it('MAP-1 a human match is ranked, carries the stakes, and builds the ServerDuelInit', () => {
    const nav = matchedToNav({
      duelId: 'duel-77', seat: 1, givens: [0, 1, 2],
      foe: { name: 'Rival Clerk', order: 'executioner', shade: false, standing: 1010 },
      stakes: { tier: 'Medium', range: [909, 1111] },
    }, save);
    expect(nav.duelMode).toBe('ranked');
    expect(nav.pendingFoe).toEqual({
      name: 'Rival Clerk', order: 'executioner', shade: false,
      standing: 1010, tier: 'Medium', range: [909, 1111],
    });
    // the duel screen constructs the authoritative mirror from exactly this
    expect(nav.serverDuel).toEqual({
      duelId: 'duel-77', seat: 1, givens: [0, 1, 2],
      foeName: 'Rival Clerk', myName: 'Clerk One',
      myOrder: 'scholar', foeOrder: 'executioner',
    });
  });

  it('MAP-2 a Shade from the authoritative queue is labelled a Shade (R7) and still server-driven', () => {
    const nav = matchedToNav({
      duelId: 'duel-78', seat: 0, givens: [5],
      foe: { name: 'Shade of Rival', order: 'executioner', shade: true, standing: 980 },
      stakes: { tier: 'Medium', range: [0, 0] },
    }, save);
    expect(nav.duelMode).toBe('shade');
    expect(nav.pendingFoe.shade).toBe(true);
    expect(nav.serverDuel).not.toBeNull(); // a server Shade duel is STILL a ServerDuel
  });

  it('MAP-3 missing stakes degrade to Ranked with a [0, 0] range', () => {
    const nav = matchedToNav({
      duelId: 'duel-79', seat: 0, givens: [],
      foe: { name: 'Rival', order: 'scholar', shade: false, standing: 1000 },
    }, save);
    expect(nav.pendingFoe.tier).toBe('Ranked');
    expect(nav.pendingFoe.range).toEqual([0, 0]);
  });

  it('MAP-4 the local fallback is a LocalDuel (serverDuel null) on the practice ladder', () => {
    const nav = shadeFallbackNav({ standing: 1037 });
    expect(nav.duelMode).toBe('shade');
    expect(nav.pendingFoe.order).toBe('executioner');
    expect(nav.pendingFoe.shade).toBe(true);
    expect(nav.pendingFoe.standing).toBe(1037);
    expect(nav.pendingFoe.tier).toBe('Practice ladder');
    expect(nav.pendingFoe.range).toEqual([0, 0]);
    expect(nav.serverDuel).toBeNull();
  });
});
