// ASSIZE mobile — the audio asset registry.
//
// The sounds on disk are produced by `node tools/render-audio.mjs` (repo root),
// which renders the web build's synth graph offline into 16-bit mono WAV, then
// encoded to gapless AAC-in-M4A (loops 80 kbps, one-shots 64 kbps, mono,
// +faststart). M4A is the gapless-safe intersection of the two players:
// ExoPlayer (Android) and AVPlayer (iOS) both honour the MP4 edit list, so the
// three beds loop with no click — verified by decoding and correlating the
// wrap point against the WAV masters (fidelity r > 0.999, wrap step a fraction
// of bed RMS). This file is the only place that names
// them: the imports are what make Metro bundle the files, so a renamed sound
// breaks the BUILD here, loudly, at the one place you would look — the same law
// `src/theme/assets.ts` established for the art.
//
// The imports are ESM default imports rather than require(): the registry sits
// under the whole app's import graph (every screen reaches `audio`), so it must
// EVALUATE everywhere the app runs — including the logic-test runner, where a
// binary require() would be parsed as JavaScript. The runner is taught to treat
// .m4a as an asset (vitest.config.ts assetsInclude); Metro already knows the
// extension. Same bytes, same bundle, no environment can crash on it.
//
// Three of these are CONTINUOUS beds (drone / tension / murmur) rendered as
// seamless loops; the runtime drives their volume from `tickMusic(tension)` and
// `setHeat(heat)` through the gain law in `./gainLaw`. The rest are ONE-SHOTS
// played at trigger time on the fx bus.

import droneLoop from '../../assets/audio/drone-loop.m4a';
import tensionLoop from '../../assets/audio/tension-loop.m4a';
import murmurLoop from '../../assets/audio/murmur-loop.m4a';
import placeM4a from '../../assets/audio/place.m4a';
import wrongM4a from '../../assets/audio/wrong.m4a';
import pencilM4a from '../../assets/audio/pencil.m4a';
import errorM4a from '../../assets/audio/error.m4a';
import uiTapM4a from '../../assets/audio/ui-tap.m4a';
import pageTurnM4a from '../../assets/audio/page-turn.m4a';
import stampM4a from '../../assets/audio/stamp.m4a';
import claimWonM4a from '../../assets/audio/claim-won.m4a';
import claimLostM4a from '../../assets/audio/claim-lost.m4a';
import statusAppliedM4a from '../../assets/audio/status-applied.m4a';
import statusEndedM4a from '../../assets/audio/status-ended.m4a';
import padlockM4a from '../../assets/audio/padlock.m4a';
import orderSwapM4a from '../../assets/audio/order-swap.m4a';
import cast0M4a from '../../assets/audio/cast-0.m4a';
import cast1M4a from '../../assets/audio/cast-1.m4a';
import cast2M4a from '../../assets/audio/cast-2.m4a';
import cast3M4a from '../../assets/audio/cast-3.m4a';
import victoryM4a from '../../assets/audio/victory.m4a';
import defeatM4a from '../../assets/audio/defeat.m4a';
import drawM4a from '../../assets/audio/draw.m4a';
import reliquaryM4a from '../../assets/audio/reliquary.m4a';

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
  place: placeM4a,
  wrong: wrongM4a,
  pencil: pencilM4a,
  error: errorM4a,
  uiTap: uiTapM4a,
  pageTurn: pageTurnM4a,
  // the wax and the claims
  stamp: stampM4a,
  claimWon: claimWonM4a,
  claimLost: claimLostM4a,
  // statuses, rites and the Order swap
  statusApplied: statusAppliedM4a,
  statusEnded: statusEndedM4a,
  padlock: padlockM4a,
  orderSwap: orderSwapM4a,
  cast0: cast0M4a,
  cast1: cast1M4a,
  cast2: cast2M4a,
  cast3: cast3M4a,
  // verdicts
  victory: victoryM4a,
  defeat: defeatM4a,
  draw: drawM4a,
  // S10 — the Reliquary chest ritual
  reliquary: reliquaryM4a,
} as const;

export type SfxKey = keyof typeof sfxAssets;
