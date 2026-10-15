// P3.2 — "I have worn nine Orders" stays true (docs/STORY_HOLD_PLAN.md P3.2).
//
// Orsolo's challenge line promises he swaps Orders mid-fight, and the engine
// delivers — through the T4 ADAPTIVE swap (FOLIOS[8] duels[2].adaptive, at
// CONFIG.seals.adaptiveSwapAtSeals), riding on top of his 'the-ninth' arc —
// not through a scripted phaseScript swapTo (the-ninth carries none, by
// design: the adaptive trigger catches Seals lost to ANY source the instant
// they land, localDuel checkAdaptive). This suite pins the promise to the
// mechanism that keeps it: change the threshold, drop the adaptive flag, or
// detach the arc, and CI fails quoting the canon line.
//
// Canon: «I have worn nine Orders waiting for you.» (story.mag.orsolo.challenge[1])
import { describe, it, expect } from 'vitest';
import { CONFIG } from '../config';
import { FOLIOS } from '../orders';
import { BOSS_SCRIPTS } from '../phaseScript';
import sharedStory from '../i18n/story.json';

const PROMISE = 'I have worn nine Orders waiting for you.';

describe('reveal integrity (P3.2)', () => {
  it('the canon promise still reads as written', () => {
    const challenge = (sharedStory.mag as Record<string, { challenge: string[] }>).orsolo.challenge;
    expect(challenge, 'Orsolo must still promise the swap').toContain(PROMISE);
  });

  it('Orsolo duels with his arc AND the adaptive swap', () => {
    const folio = FOLIOS[8];
    expect(folio.key).toBe('orsolo');
    const magistrate = folio.duels[2];
    expect(magistrate.script, `${PROMISE} — the arc must stay attached`).toBe('the-ninth');
    expect(BOSS_SCRIPTS[magistrate.script as string], `${PROMISE} — the arc must exist`).toBeDefined();
    expect(magistrate.adaptive, `${PROMISE} — the mid-duel swap must stay armed`).toBe(true);
  });

  it('the swap threshold is 4 Seals, the documented beat', () => {
    expect(
      CONFIG.seals.adaptiveSwapAtSeals,
      `${PROMISE} — the swap must fire at 4 Seals`,
    ).toBe(4);
  });
});
