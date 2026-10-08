// ASSIZE mobile — the audio asset registry.
//
// The sounds on disk are produced by `node tools/render-audio.mjs` (repo root),
// which renders the web build's synth graph offline into 16-bit mono WAV — the
// settled porting decision of specs/07. This file is the only place that names
// them: the imports are what make Metro bundle the files, so a renamed sound
// breaks the BUILD here, loudly, at the one place you would look — the same law
// `src/theme/assets.ts` established for the art.
//
// The imports are ESM default imports rather than require(): the registry sits
// under the whole app's import graph (every screen reaches `audio`), so it must
// EVALUATE everywhere the app runs — including the logic-test runner, where a
// binary require() would be parsed as JavaScript. The runner is taught to treat
// .wav as an asset (vitest.config.ts assetsInclude); Metro already knows the
// extension. Same bytes, same bundle, no environment can crash on it.
//
// Three of these are CONTINUOUS beds (drone / tension / murmur) rendered as
// seamless loops; the runtime drives their volume from `tickMusic(tension)` and
// `setHeat(heat)` through the gain law in `./gainLaw`. The rest are ONE-SHOTS
// played at trigger time on the fx bus.

import droneLoop from '../../assets/audio/drone-loop.wav';
import tensionLoop from '../../assets/audio/tension-loop.wav';
import murmurLoop from '../../assets/audio/murmur-loop.wav';
import placeWav from '../../assets/audio/place.wav';
import wrongWav from '../../assets/audio/wrong.wav';
import pencilWav from '../../assets/audio/pencil.wav';
import errorWav from '../../assets/audio/error.wav';
import uiTapWav from '../../assets/audio/ui-tap.wav';
import pageTurnWav from '../../assets/audio/page-turn.wav';
import stampWav from '../../assets/audio/stamp.wav';
import claimWonWav from '../../assets/audio/claim-won.wav';
import claimLostWav from '../../assets/audio/claim-lost.wav';
import statusAppliedWav from '../../assets/audio/status-applied.wav';
import statusEndedWav from '../../assets/audio/status-ended.wav';
import padlockWav from '../../assets/audio/padlock.wav';
import orderSwapWav from '../../assets/audio/order-swap.wav';
import cast0Wav from '../../assets/audio/cast-0.wav';
import cast1Wav from '../../assets/audio/cast-1.wav';
import cast2Wav from '../../assets/audio/cast-2.wav';
import cast3Wav from '../../assets/audio/cast-3.wav';
import victoryWav from '../../assets/audio/victory.wav';
import defeatWav from '../../assets/audio/defeat.wav';
import drawWav from '../../assets/audio/draw.wav';
import reliquaryWav from '../../assets/audio/reliquary.wav';

export const loopAssets = {
  /** the courtroom drone — three detuned saws under a breathing lowpass */
  drone: droneLoop,
  /** the bowed tension layer — sparse swells from the duel's six-note scale */
  tension: tensionLoop,
  /** the J4 gallery murmur — the pinkish bed whose gain follows heat */
  murmur: murmurLoop,
} as const;

export type LoopKey = keyof typeof loopAssets;

export const sfxAssets = {
  // the duel's placement voices
  place: placeWav,
  wrong: wrongWav,
  pencil: pencilWav,
  error: errorWav,
  uiTap: uiTapWav,
  pageTurn: pageTurnWav,
  // the wax and the claims
  stamp: stampWav,
  claimWon: claimWonWav,
  claimLost: claimLostWav,
  // statuses, rites and the Order swap
  statusApplied: statusAppliedWav,
  statusEnded: statusEndedWav,
  padlock: padlockWav,
  orderSwap: orderSwapWav,
  cast0: cast0Wav,
  cast1: cast1Wav,
  cast2: cast2Wav,
  cast3: cast3Wav,
  // verdicts
  victory: victoryWav,
  defeat: defeatWav,
  draw: drawWav,
  // S10 — the Reliquary chest ritual
  reliquary: reliquaryWav,
} as const;

export type SfxKey = keyof typeof sfxAssets;
