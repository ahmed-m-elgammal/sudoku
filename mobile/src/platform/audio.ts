// ASSIZE mobile — AUDIO BASELINE (Phase A stub).
//
// ┌────────────────────────────────────────────────────────────────────────────┐
// │ OWNED BY: the audio agent. Replace this file wholesale with a real          │
// │ expo-audio implementation. Keep the interface in ./types EXACTLY as-is —   │
// │ 18 methods + unlock/setMuted/muted/setVolumes.                             │
// │                                                                             │
// │ This baseline exists only so Phase A compiles: it is a silent, throw-free   │
// │ implementation of the full contract. That is the correct degraded state    │
// │ anyway — the game is fully playable with no audio at all.                   │
// └────────────────────────────────────────────────────────────────────────────┘
//
// The web build's synth (../src/audio/synth.ts, 290 lines of WebAudio graph) is
// NOT ported. It is replaced by an implementation of its 18-method call surface:
//
//   cast claimWon defeat draw error orderSwap padlock pageTurn pencil place
//   stamp statusApplied statusEnded tickMusic uiTap victory wrong
//
// Design constraints for the replacement:
//   - never throw; every method is a no-op before unlock() and when audio fails
//   - one-shots are short pre-rendered assets (expo-audio players)
//   - tickMusic(tension) and setHeat(heat) drive continuous gain on the ambient
//     bed and the gallery murmur — the J4 "the room's stakes are audible" law
//   - volumes come from save.settings.music / save.settings.fx
import type { AudioBackend } from './types';

let isMuted = false;
let musicVol = 0.3;
let fxVol = 0.7;
let lastTension = 0;
let lastHeat = 0;

const noop = (): void => {};

export const audio: AudioBackend = {
  // A real implementation flips this on the first user gesture (iOS/Android both
  // refuse audio before one). Until then every method below is a no-op.
  unlock: noop,

  place: noop,
  wrong: noop,
  pencil: noop,
  error: noop,
  uiTap: noop,
  pageTurn: noop,
  stamp: noop,
  claimWon: noop,
  claimLost: noop,
  statusApplied: noop,
  statusEnded: noop,
  padlock: noop,
  orderSwap: noop,
  cast: noop,
  victory: noop,
  defeat: noop,
  draw: noop,

  tickMusic(tension: number): void {
    lastTension = Number.isFinite(tension) ? Math.max(0, Math.min(1, tension)) : 0;
  },
  setHeat(heat: number): void {
    lastHeat = Number.isFinite(heat) ? Math.max(0, Math.min(1, heat)) : 0;
  },

  setMuted(muted: boolean): void {
    isMuted = !!muted;
  },
  muted(): boolean {
    return isMuted;
  },
  setVolumes(music: number, fx: number): void {
    musicVol = Number.isFinite(music) ? Math.max(0, Math.min(1, music)) : musicVol;
    fxVol = Number.isFinite(fx) ? Math.max(0, Math.min(1, fx)) : fxVol;
  },
};

/** Read-only view of the continuous state, for tests and a future mixer. */
export const audioState = () => ({ isMuted, musicVol, fxVol, lastTension, lastHeat });
