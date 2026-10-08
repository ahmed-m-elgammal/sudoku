// ASSIZE mobile — the GAIN LAW (pure; the mixer's maths, not its machinery).
//
// The web build drove three continuous gains through `GainNode.setTargetAtTime`
// (an exponential one-pole approach) and two bus gains (music bus, fx bus) under a
// master mute. React Native's expo-audio players expose a single `volume` each and
// there is no node graph, so the buses become MULTIPLICATION and the time constants
// become an explicit one-pole stepped by the mixer's timer. The laws live here,
// pure and testable, exactly like sliderLaw/friendLaw/seasonLaw before it:
//
//   drone   = 0.16 (fixed bed gain)                        → music bus
//   tension = clamp01(tension) * 0.5                       → music bus  (tc 1.5 s)
//   murmur  = clamp01(heat)    * 0.07                      → music bus  (tc 0.9 s)
//   music bus = source * musicVol * (muted ? 0 : 1)
//   fx one-shot = fxVol * (muted ? 0 : 1)                  (applied at trigger time)
//
// Constants are the web synth's own numbers (src/audio/synth.ts) — they are the
// audio design's signed values, not tuning knobs for this port to move.

/** The courtroom drone's fixed bed gain (synth.ts startDrone: gain 0.16). */
export const DRONE_GAIN = 0.16;

/** The tension layer's ceiling (synth.ts tickMusic: tension * 0.5). */
export const TENSION_CEIL = 0.5;

/** The gallery murmur's ceiling at full heat (synth.ts setHeat: heat * 0.07). */
export const MURMUR_CEIL = 0.07;

/** The web's smoothing time constants, in seconds (setTargetAtTime tc). */
export const TIME_CONSTANT = {
  /** mute/musicVol ride the bus (0.05 s — effectively immediate) */
  bus: 0.05,
  /** the drone bed follows volume changes at the bus constant */
  drone: 0.05,
  /** tickMusic's swell (1.5 s — claims swell the room, never jump it) */
  tension: 1.5,
  /** setHeat's murmur (0.9 s) */
  murmur: 0.9,
} as const;

/** Clamp to [0, 1]; non-finite input collapses to 0 (the web's Number.isFinite law). */
export function clampUnit(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(1, v));
}

/**
 * The one-pole behind setTargetAtTime: after `dt` seconds approaching `target`
 * with time constant `tc`, the value is `target + (current - target) * e^(-dt/tc)`.
 * A non-positive tc (or dt) lands exactly on the target.
 */
export function approach(current: number, target: number, tcSeconds: number, dtSeconds: number): number {
  if (tcSeconds <= 0 || dtSeconds <= 0) return target;
  return target + (current - target) * Math.exp(-dtSeconds / tcSeconds);
}

/** The master mute: 1 open, 0 silenced (synth.ts setMuted). */
export function masterGain(muted: boolean): number {
  return muted ? 0 : 1;
}

/** A music-bus source's effective player volume: source * musicVol * master. */
export function musicBusVolume(sourceGain: number, musicVol: number, muted: boolean): number {
  return sourceGain * clampUnit(musicVol) * masterGain(muted);
}

/** A one-shot's effective player volume at trigger time: fxVol * master. */
export function fxVolume(fxVol: number, muted: boolean): number {
  return clampUnit(fxVol) * masterGain(muted);
}

/** The tension layer's source gain from the duel's tension 0..1. */
export function tensionSource(tension: number): number {
  return clampUnit(tension) * TENSION_CEIL;
}

/** The murmur's source gain from the duel's J4 heat 0..1. */
export function murmurSource(heat: number): number {
  return clampUnit(heat) * MURMUR_CEIL;
}

/** The cast variants on disk (cast-0..cast-3.wav cover the four Orders' rites). */
export const CAST_VARIANTS = 4;

/** cast(kind) → which file plays: the web's base = 340 + kind*40, folded to disk. */
export function castVariant(kind: number, count: number = CAST_VARIANTS): number {
  const k = Number.isFinite(kind) ? Math.trunc(kind) : 0;
  return ((k % count) + count) % count;
}
