// sliderLaw — the pure law of the settings volume sliders (specs/17 phase 5.7).
//
// The web build's `<input type="range" min={0} max={1} step={0.05}>` hands its
// math to the browser; the port's SettingSlider owns it, here. These tests pin
// the browser behaviours the control must reproduce:
//
//   SLIDE-1  the value snaps to the 0.05 grid exactly as a browser reports it
//            (0.05 steps, float error rounded away — never 0.30000000000000004)
//   SLIDE-2  hostile input fails closed to the minimum (the browser can't be
//            hostile; a gesture plane can — NaN locationX happens)
//   SLIDE-3  the thumb never overruns the track: a tap at the very left edge is
//            exactly 0, at the very right edge exactly 1, midpoints interpolate
//   SLIDE-4  the thumb's LEFT for a value is the exact inverse of valueFromX —
//            a round trip lands the thumb on the grid point it was drawn for
//   SLIDE-5  the thumb travel is the track minus one thumb width (the browser's
//            geometry: the thumb centre spans [thumb/2, width − thumb/2])
import { describe, it, expect } from 'vitest';
import {
  SLIDER_MIN, SLIDER_MAX, SLIDER_STEP, SLIDER_THUMB,
  snapToStep, valueFromX, thumbLeftFor,
} from '@/ui/screens/sliderLaw';

describe('sliderLaw · the browser range-input law, pinned', () => {
  it('SLIDE-1 snaps to the 0.05 grid with the float error rounded away', () => {
    expect(SLIDER_MIN).toBe(0);
    expect(SLIDER_MAX).toBe(1);
    expect(SLIDER_STEP).toBe(0.05);
    expect(snapToStep(0.3)).toBe(0.3);
    expect(snapToStep(0.34)).toBe(0.35);
    expect(snapToStep(0.36)).toBe(0.35);
    expect(snapToStep(0.07)).toBe(0.05);
    // 0.05 * 7 IS 0.35000000000000003 — a browser never reports it
    expect(snapToStep(0.35000000000000003)).toBe(0.35);
    expect(snapToStep(1)).toBe(1);
  });

  it('SLIDE-2 hostile input fails closed to the minimum, out-of-range clamps', () => {
    expect(snapToStep(Number.NaN)).toBe(0);
    expect(snapToStep(Number.POSITIVE_INFINITY)).toBe(0);
    expect(snapToStep(-3)).toBe(0);
    expect(snapToStep(5)).toBe(1);
  });

  it('SLIDE-3 the edges are exact and midpoints interpolate', () => {
    const W = 200;
    expect(valueFromX(0, W)).toBe(0);
    expect(valueFromX(W, W)).toBe(1);
    expect(valueFromX(W / 2, W)).toBe(0.5);
    // one grid up from the left edge
    expect(valueFromX(SLIDER_THUMB / 2 + 0.05 * (W - SLIDER_THUMB), W)).toBe(0.05);
    // zero-width track cannot divide by zero
    expect(valueFromX(0.5, 0)).toBe(0);
  });

  it('SLIDE-4 thumbLeftFor is the exact inverse of valueFromX', () => {
    const W = 260;
    for (let i = 0; i <= 20; i++) {
      const v = i * 0.05;
      const left = thumbLeftFor(v, W);
      expect(valueFromX(left + SLIDER_THUMB / 2, W)).toBeCloseTo(v, 10);
    }
    // hostile values clamp to the ends, they do not run past them
    expect(thumbLeftFor(-2, W)).toBe(0);
    expect(thumbLeftFor(9, W)).toBe(W - SLIDER_THUMB);
  });

  it('SLIDE-5 the thumb travel is the track minus one thumb width', () => {
    const W = 300;
    expect(thumbLeftFor(0, W)).toBe(0);
    expect(thumbLeftFor(1, W)).toBe(W - SLIDER_THUMB);
  });
});
