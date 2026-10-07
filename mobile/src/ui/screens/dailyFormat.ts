// Pure clock formats for the Daily Assize screens, extracted verbatim from
// DailyScreen.tsx's inline JSX math so the gate can pin them (the web build
// composes these strings inside the leaderboard rows / the 1 s countdown tick).
//
//   · fmtClock     — the leaderboard's m:ss (minutes UNPADDED, seconds padded)
//   · fmtCountdown — the midnight countdown's HH:MM:SS (both padded)
//
// No clock reads here — callers own `Date`; these are string laws only.
/** `Math.floor(t/60000)` : `pad2(Math.floor((t%60000)/1000))` — web DailyScreen:105 */
export const fmtClock = (timeMs: number): string =>
  `${Math.floor(timeMs / 60000)}:${String(Math.floor((timeMs % 60000) / 1000)).padStart(2, '0')}`;

/** `HH:MM:SS` from whole seconds — web DailyScreen:46's padStart composition */
export const fmtCountdown = (s: number): string =>
  `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
