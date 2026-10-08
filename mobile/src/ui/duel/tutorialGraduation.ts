// The graduation law (M1 item 7, docs/TUTORIAL_OPTIMIZATION_PLAN.md G13/G11).
//
// Before the replay entries landed, a tutorial completion could only ever happen once
// per save, so `+100 Ink` unconditionally was safe. G13 makes the lesson re-playable
// from the Antechamber and Settings, and an unguarded +100 becomes an Ink farm: sit,
// win, collect 100, repeat. The plan's law: "graduation Ink is once-per-save".
//
// Both completion paths (win via DuelScreen.finish, skip via the G11 confirm sheet)
// route their SAVE mutation through this module, and both gate their LEDGER delta on
// `isGraduated()` read fresh from the store — so every replay path (hub card, settings
// row, ResultScreen rematch, the G10 non-win remount) dedupes by the same source of
// truth, one that survives an app kill.
//
// What is NOT deduped: the ordinary duel Ink a tutorial win already pays (base 30 +
// claims, exactly like any other Shade duel) and the ordinary stats. Only the
// GRADUATION — the +100 and the reliquary candle — is once-per-save.
import type { SaveStateV2 } from '@/state/save';

/** The graduation reward. Named here so the ledger delta and the save write cannot drift. */
export const GRADUATION_INK = 100;

/** True when this Clerk has already graduated (the once-per-save gate). */
export function isGraduated(s: SaveStateV2 | null | undefined): boolean {
  return s?.tutorialDone === true;
}

/**
 * Win-path completion (DuelScreen.finish → `useSave.update`). Unlock flags are
 * idempotent; the +100 and the reliquary candle land only on the FIRST completion.
 */
export function completeTutorialByWin(cur: SaveStateV2): SaveStateV2 {
  const first = !cur.tutorialDone;
  return {
    ...cur,
    tutorialDone: true,
    antechamberUnlocked: true,
    economy: first
      ? { ...cur.economy, ink: cur.economy.ink + GRADUATION_INK, reliquaryProgress: cur.economy.reliquaryProgress + 1 }
      : cur.economy,
  };
}

/**
 * Skip-path completion (DuelScreen.skipTutorial → `useSave.update`). The confirmed
 * skip is a positive completion — the same unlock and the same graduation Ink — but
 * an abandoned duel lights no reliquary candle.
 */
export function completeTutorialBySkip(cur: SaveStateV2): SaveStateV2 {
  const first = !cur.tutorialDone;
  return {
    ...cur,
    tutorialDone: true,
    antechamberUnlocked: true,
    economy: first ? { ...cur.economy, ink: cur.economy.ink + GRADUATION_INK } : cur.economy,
  };
}
