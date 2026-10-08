// The tutorial replay-entry law (M1 item 7, docs/TUTORIAL_OPTIMIZATION_PLAN.md G13).
//
// Until now the tutorial was unreachable forever once `tutorialDone` was written: the
// Antechamber, Settings and OfflineScreen offered no replay entry on mobile (G13). The
// plan's fix is one shared entry shape — a single dictionary key (`tutorial.relearn`)
// and BOTH screens routing through THIS one builder, so the two entries can never
// drift the way the web's lone OfflineScreen entry does from its rematch path.
//
// The payload is exactly the shape the G10 replay routing already uses (DuelScreen
// finish + ResultScreen rematch): re-enter `tutorial` with the mode pinned and a
// bumped `duelNonce` — the shell keys DuelScreen on the nonce, so a replay always
// remounts with a fresh runtime even when the previous screen was itself a duel.
// `lastResult`/`serverDuel` are cleared so no verdict or server init leaks into the
// lesson (a stale lastResult would feed the Result screen; a stale serverDuel would
// hijack the runtime).
//
// Why no `tutorialReplay` flag rides along: the graduation reward's once-per-save
// dedup must read the SAVE (`tutorialDone`), not route provenance — a store flag is
// stale across app kills and would wrongly re-grant through the BootScreen/G10 paths.
// The M2 prologue cards gate on `!save.tutorialDone` the same way (plan §6.1.5).
import type { DuelMode } from '@/state/ui';

export interface TutorialReplayPayload {
  duelMode: DuelMode;
  duelNonce: number;
  lastResult: null;
  serverDuel: null;
}

/** The one payload both replay entries (Antechamber + Settings) route with. */
export function tutorialReplayPayload(duelNonce: number): TutorialReplayPayload {
  return { duelMode: 'tutorial', duelNonce: duelNonce + 1, lastResult: null, serverDuel: null };
}
