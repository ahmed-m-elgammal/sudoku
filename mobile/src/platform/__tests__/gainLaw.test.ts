// gainLaw.test.ts — the mixer's maths, pinned to the web synth's own numbers.
//
// The web build drove `GainNode.setTargetAtTime` with the constants these tests
// freeze: the drone bed at 0.16, tension at tension*0.5 (tc 1.5 s), the J4 murmur at
// heat*0.07 (tc 0.9 s), mute as a 0/1 master. If one of these constants moves, the
// sound design has changed — that is a specs/07 decision, not a tuning pass.
import { describe, it, expect } from 'vitest';
import {
  DRONE_GAIN, TENSION_CEIL, MURMUR_CEIL, TIME_CONSTANT, CAST_VARIANTS,
  approach, castVariant, clampUnit, fxVolume, masterGain, murmurSource,
  musicBusVolume, tensionSource,
} from '@/platform/gainLaw';

describe('gainLaw — the web synth\'s constants', () => {
  it('freezes the bed gains to the web graph', () => {
    expect(DRONE_GAIN).toBe(0.16);
    expect(TENSION_CEIL).toBe(0.5);
    expect(MURMUR_CEIL).toBe(0.07);
    expect(TIME_CONSTANT).toEqual({ bus: 0.05, drone: 0.05, tension: 1.5, murmur: 0.9 });
    expect(CAST_VARIANTS).toBe(4);
  });
});

describe('clampUnit — the Number.isFinite law', () => {
  it('clamps and collapses non-finite input to 0 (the web\'s isFinite law — Infinity included)', () => {
    expect(clampUnit(-0.4)).toBe(0);
    expect(clampUnit(0.27)).toBe(0.27);
    expect(clampUnit(7)).toBe(1);
    expect(clampUnit(NaN)).toBe(0);
    expect(clampUnit(Infinity)).toBe(0);
  });
});

describe('approach — the setTargetAtTime one-pole', () => {
  it('matches the exponential law exactly', () => {
    // 0 → 1 with tc 1.5 after 1.5 s is 1 - e^-1
    expect(approach(0, 1, 1.5, 1.5)).toBeCloseTo(1 - Math.exp(-1), 12);
    // 0.5 → 0 with tc 0.9 after 0.9 s is 0.5 * e^-1
    expect(approach(0.5, 0, 0.9, 0.9)).toBeCloseTo(0.5 * Math.exp(-1), 12);
  });

  it('lands exactly on the target for a non-positive tc or dt', () => {
    expect(approach(0.2, 0.9, 0, 0.1)).toBe(0.9);
    expect(approach(0.2, 0.9, 1.5, 0)).toBe(0.9);
  });

  it('never overshoots: walks toward the target from either side', () => {
    const up = approach(0, 0.5, 1.5, 0.1);
    const down = approach(0.5, 0, 0.9, 0.1);
    expect(up).toBeGreaterThan(0);
    expect(up).toBeLessThan(0.5);
    expect(down).toBeGreaterThan(0);
    expect(down).toBeLessThan(0.5);
  });
});

describe('the bus law — source * musicVol * master', () => {
  it('mutes to true silence, not a whisper', () => {
    expect(masterGain(true)).toBe(0);
    expect(masterGain(false)).toBe(1);
    expect(musicBusVolume(DRONE_GAIN, 0.3, true)).toBe(0);
    expect(fxVolume(0.7, true)).toBe(0);
  });

  it('multiplies the source by the music volume', () => {
    expect(musicBusVolume(DRONE_GAIN, 0.3, false)).toBeCloseTo(0.048, 12);
    expect(musicBusVolume(tensionSource(1), 1, false)).toBeCloseTo(0.5, 12);
  });

  it('the fx volume clamps and rides its own bus', () => {
    expect(fxVolume(0.7, false)).toBeCloseTo(0.7, 12);
    expect(fxVolume(2, false)).toBe(1);
    expect(fxVolume(NaN, false)).toBe(0);
  });
});

describe('the J4 laws — tension and heat ceilings', () => {
  it('tension scales by 0.5 and clamps', () => {
    expect(tensionSource(0)).toBe(0);
    expect(tensionSource(0.5)).toBeCloseTo(0.25, 12);
    expect(tensionSource(2)).toBe(0.5);
    expect(tensionSource(-1)).toBe(0);
    expect(tensionSource(NaN)).toBe(0);
  });

  it('heat scales by 0.07 — heat 0 is silent, full heat is a murmur', () => {
    expect(murmurSource(0)).toBe(0);
    expect(murmurSource(1)).toBeCloseTo(0.07, 12);
    expect(murmurSource(0.5)).toBeCloseTo(0.035, 12);
  });
});

describe('castVariant — the web\'s base = 340 + kind*40, folded to four files', () => {
  it('maps the four orders in order', () => {
    expect([0, 1, 2, 3].map((k) => castVariant(k))).toEqual([0, 1, 2, 3]);
  });

  it('folds out-of-range kinds into the disk set, never out of it', () => {
    expect(castVariant(4)).toBe(0);
    expect(castVariant(7)).toBe(3);
    expect(castVariant(-1)).toBe(3);
    expect(castVariant(-5)).toBe(3);
    expect(castVariant(NaN)).toBe(0);
    for (let k = -20; k <= 20; k++) {
      expect(castVariant(k)).toBeGreaterThanOrEqual(0);
      expect(castVariant(k)).toBeLessThan(4);
    }
  });
});
