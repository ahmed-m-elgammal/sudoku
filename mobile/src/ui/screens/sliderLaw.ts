// sliderLaw.ts — the pure law of the settings volume sliders.
//
// The web build's SettingsScreen mounts two native `<input type="range" min={0}
// max={1} step={0.05}>` inputs (:46-52). The browser owns that input's math; RN
// has no Slider in the stack (AGENTS.md: no new dependencies without asking), so
// SettingSlider rebuilds the control from primitives and THIS file owns the math
// the browser was doing — extracted (the friendLaw/seasonLaw precedent) so the
// gate can pin it without native chrome:
//
//   - drag/tap position → value, respecting the thumb's travel (the thumb never
//     overruns the track ends — the browser's own geometry),
//   - snap to the step grid the way the browser reports values (0.05 steps,
//     float error rounded away — a browser never reports 0.30000000000000004).

/** the web inputs' attributes, verbatim (SettingsScreen.tsx:46/50). */
export const SLIDER_MIN = 0;
export const SLIDER_MAX = 1;
export const SLIDER_STEP = 0.05;

/** the thumb's diameter — SettingToggle's knob size (web Toggle <i>: 21px). */
export const SLIDER_THUMB = 21;

/**
 * Snap a raw value onto the step grid and clamp to [min, max] — the browser's
 * `<input type=range>` value law. The final `Number(…toFixed(3))` rounds away
 * the float error the browser never surfaces (0.05 * 7 = 0.35000000000000003).
 */
export function snapToStep(raw: number, min = SLIDER_MIN, max = SLIDER_MAX, step = SLIDER_STEP): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return min;
  const clamped = Math.min(max, Math.max(min, raw));
  const steps = Math.round((clamped - min) / step);
  return Number((min + steps * step).toFixed(3));
}

/**
 * Gesture x (within the track) → value. The thumb CENTRE travels the track
 * minus one thumb-width (the browser's geometry): a tap at the very left edge
 * yields exactly min, at the very right edge exactly max.
 */
export function valueFromX(x: number, trackWidth: number, min = SLIDER_MIN, max = SLIDER_MAX, step = SLIDER_STEP): number {
  const usable = Math.max(1, trackWidth - SLIDER_THUMB);
  const fraction = (x - SLIDER_THUMB / 2) / usable;
  return snapToStep(min + fraction * (max - min), min, max, step);
}

/** The thumb's left offset for a value — the inverse of valueFromX. */
export function thumbLeftFor(value: number, trackWidth: number, min = SLIDER_MIN, max = SLIDER_MAX): number {
  const usable = Math.max(1, trackWidth - SLIDER_THUMB);
  const fraction = (Math.min(max, Math.max(min, value)) - min) / (max - min);
  return fraction * usable;
}
