// ASSIZE mobile — the AUDIO BACKEND (specs/07, the settled decision, implemented).
//
// Replaces the Phase A silent baseline. The web build's synth (src/audio/synth.ts,
// a 290-line WebAudio graph) is DELETED, not transliterated: every sound is a
// pre-rendered asset (produced by `node tools/render-audio.mjs` and registered in
// ./audioAssets), played through expo-audio. This file owns the mixing machinery;
// the maths lives in ./gainLaw (pure, tested) and the files' character is the
// renderer's, which mirrors the web graph parameter-for-parameter.
//
// The contract (./types, specs/16 A1) is kept EXACTLY:
//   · 18 call-surface methods + `unlock()`/`setMuted()`/`muted()`/`setVolumes()`;
//   · never throws — audio failure degrades to silence, never to a broken duel;
//   · every method is a no-op before `unlock()` (the first user gesture, wired in
//     App.tsx — iOS/Android refuse audio before one);
//   · `tickMusic(tension)` swells the tension layer (tc 1.5 s), `setHeat(h)` swells
//     the gallery murmur (tc 0.9 s) — the J4 law that the room's stakes are audible;
//   · mute and the music/fx volumes ride the same buses the web rode, so every
//     player inherits them.
//
// RN translation notes (the AGENTS.md platform table, nothing more):
//   · WebAudio's gain graph → per-player `volume` multiplication (gainLaw);
//   · `setTargetAtTime` → a 100 ms mixer timer stepping `approach()` one-poles;
//     mute and volume changes land INSTANTLY (the web's bus tc is 0.05 s) while
//     tension/heat keep their long constants;
//   · App background pauses the beds + the timer (specs/07 background behaviour);
//   · one-shots restart from zero on retrigger — one player per voice, the honest
//     RN shape of the web's overlapping envelopes for sounds this short.
import { AppState } from 'react-native';
import * as ExpoAudio from 'expo-audio';
import type { AudioBackend } from './types';
import { sfxAssets, loopAssets, type SfxKey, type LoopKey } from './audioAssets';
import {
  DRONE_GAIN, TIME_CONSTANT, approach, castVariant, clampUnit, fxVolume,
  murmurSource, musicBusVolume, tensionSource,
} from './gainLaw';

type Player = ReturnType<typeof ExpoAudio.createAudioPlayer>;

/** The mixer timer's step, in seconds. */
const MIXER_TICK_SECONDS = 0.1;

const SFX_KEYS = Object.keys(sfxAssets) as SfxKey[];
const LOOP_KEYS = Object.keys(loopAssets) as LoopKey[];

let unlocked = false;
let degraded = false;
let isMuted = false;
let musicVol = 0.3;
let fxVol = 0.7;
let lastTension = 0;
let lastHeat = 0;

/** The three beds' players, created at unlock. */
const loops: Partial<Record<LoopKey, Player>> = {};
/** One player per one-shot voice, created lazily on first use. */
const voices: Partial<Record<SfxKey, Player>> = {};

/** The current smoothed-toward targets, recomputed by retarget(). */
let targets: Record<LoopKey, number> = { drone: 0, tension: 0, murmur: 0 };
let mixerTimer: ReturnType<typeof setInterval> | null = null;
let appStateSub: { remove: () => void } | null = null;

/** Recompute where the beds' volumes are heading. `instant` lands there now. */
function retarget(instant: boolean): void {
  targets = {
    drone: musicBusVolume(DRONE_GAIN, musicVol, isMuted),
    tension: musicBusVolume(tensionSource(lastTension), musicVol, isMuted),
    murmur: musicBusVolume(murmurSource(lastHeat), musicVol, isMuted),
  };
  if (!instant) return;
  for (const key of LOOP_KEYS) {
    const p = loops[key];
    if (p) {
      try { p.volume = targets[key]; } catch { degraded = true; }
    }
  }
}

/** The 100 ms mixer step: walk every bed toward its target with its own tc. */
function mixStep(): void {
  const tcs: Record<LoopKey, number> = {
    drone: TIME_CONSTANT.drone,
    tension: TIME_CONSTANT.tension,
    murmur: TIME_CONSTANT.murmur,
  };
  for (const key of LOOP_KEYS) {
    const p = loops[key];
    if (!p) continue;
    try {
      p.volume = approach(p.volume, targets[key], tcs[key], MIXER_TICK_SECONDS);
    } catch { degraded = true; }
  }
}

function startMixer(): void {
  if (mixerTimer) return;
  mixerTimer = setInterval(mixStep, MIXER_TICK_SECONDS * 1000);
}

function stopMixer(): void {
  if (mixerTimer) { clearInterval(mixerTimer); mixerTimer = null; }
}

/** App background → pause the beds; foreground → resume (specs/07). */
function onAppStateChange(state: string): void {
  if (!unlocked) return;
  try {
    if (state === 'background' || state === 'inactive') {
      for (const key of LOOP_KEYS) loops[key]?.pause();
      stopMixer();
    } else if (state === 'active') {
      for (const key of LOOP_KEYS) loops[key]?.play();
      startMixer();
    }
  } catch { degraded = true; }
}

/** Lazily mint (or reuse) a one-shot voice and fire it from zero. */
function fireVoice(key: SfxKey): void {
  if (!unlocked) return; // the contract: every method is a no-op before the gesture
  try {
    let p = voices[key];
    if (!p) {
      p = ExpoAudio.createAudioPlayer(sfxAssets[key]);
      voices[key] = p;
    }
    p.volume = fxVolume(fxVol, isMuted);
    void p.seekTo(0);
    p.play();
  } catch { degraded = true; }
}

function playLoop(key: LoopKey): void {
  const p = ExpoAudio.createAudioPlayer(loopAssets[key]);
  p.loop = true;
  loops[key] = p;
  p.play();
}

export const audio: AudioBackend = {
  /** The first user gesture (App.tsx onTouchStart). Idempotent; never throws. */
  unlock(): void {
    if (unlocked || degraded) return;
    try {
      // specs/07: don't fight the iOS mute switch; play politely with others.
      void ExpoAudio.setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers' });
      playLoop('drone');
      playLoop('tension');
      playLoop('murmur');
      unlocked = true;
      retarget(true);
      startMixer();
      try {
        appStateSub = AppState.addEventListener('change', onAppStateChange);
      } catch { /* the listener is a nicety; the beds already play */ }
    } catch {
      degraded = true;
      stopMixer();
    }
  },

  place: () => fireVoice('place'),
  wrong: () => fireVoice('wrong'),
  pencil: () => fireVoice('pencil'),
  error: () => fireVoice('error'),
  uiTap: () => fireVoice('uiTap'),
  pageTurn: () => fireVoice('pageTurn'),
  stamp: () => fireVoice('stamp'),
  claimWon: () => fireVoice('claimWon'),
  claimLost: () => fireVoice('claimLost'),
  statusApplied: () => fireVoice('statusApplied'),
  statusEnded: () => fireVoice('statusEnded'),
  padlock: () => fireVoice('padlock'),
  orderSwap: () => fireVoice('orderSwap'),
  cast: (index: number) => fireVoice(`cast${castVariant(index)}` as SfxKey),
  victory: () => fireVoice('victory'),
  defeat: () => fireVoice('defeat'),
  draw: () => fireVoice('draw'),
  reliquary: () => fireVoice('reliquary'),

  tickMusic(tension: number): void {
    lastTension = clampUnit(tension);
    retarget(false); // the 1.5 s swell owns the approach
  },

  setHeat(heat: number): void {
    lastHeat = clampUnit(heat);
    retarget(false); // the 0.9 s swell owns the approach
  },

  setMuted(muted: boolean): void {
    isMuted = !!muted;
    retarget(true); // the bus law: effectively immediate
  },

  muted(): boolean {
    return isMuted;
  },

  setVolumes(music: number, fx: number): void {
    musicVol = clampUnit(music);
    fxVol = clampUnit(fx);
    retarget(true);
  },
};

/** Read-only view of the continuous state, for tests and a future mixer. */
export const audioState = () => ({
  isMuted, musicVol, fxVol, lastTension, lastHeat, unlocked, degraded,
});

/** Test seam: reset the module's machinery (not the contract). */
export function __resetAudioForTests(): void {
  stopMixer();
  appStateSub?.remove();
  appStateSub = null;
  for (const key of LOOP_KEYS) delete loops[key];
  for (const key of SFX_KEYS) delete voices[key];
  unlocked = false;
  degraded = false;
  isMuted = false;
  musicVol = 0.3;
  fxVol = 0.7;
  lastTension = 0;
  lastHeat = 0;
  targets = { drone: 0, tension: 0, murmur: 0 };
}
