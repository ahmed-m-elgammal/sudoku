// SettingSlider — the port of the web SettingsScreen's `<input type="range" min={0}
// max={1} step={0.05}>` (SettingsScreen.tsx:46-52), rebuilt from RN primitives.
//
// RN ships no Slider in this stack (AGENTS.md: no new dependencies without asking),
// so the platform translation is a track + thumb at the browser's own interaction
// contract, with the math living in sliderLaw.ts (the friendLaw precedent):
//   - tap the track or drag the thumb → the value snaps to the 0.05 grid and
//     fires onChange — the web input fires onChange per step change while dragging;
//   - the thumb never overruns the track ends (the browser's geometry);
//   - accessibility: role "adjustable" (the RN word for a range input) with
//     increment/decrement actions of one step — the web input's arrow-key
//     behaviour, which is how a range input is driven without a pointer;
//   - the web input is unstyled browser chrome, so the control's look is this
//     port's own matte translation: bgSunken groove, parchment thumb, token
//     colours only.
//
// REPORTED QUIRK (web build, carried): the sliders have no visible numeric readout
// and play no tap sound (the web plays none) — the value is only heard through the
// synth volume, which the App-level settings effect applies the moment the save
// changes (the web's inline synth.setMusic/setFx calls, made redundant here by
// that effect — the haptics toggle already works the same way).
import { useMemo, useState } from 'react';
import { PanResponder, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { layout, type Theme } from '@/theme/tokens';
import { SLIDER_MAX, SLIDER_MIN, SLIDER_STEP, SLIDER_THUMB, thumbLeftFor, valueFromX } from './sliderLaw';

interface SettingSliderProps {
  value: number;
  label: string;
  onChange: (v: number) => void;
  theme: Theme;
  style?: StyleProp<ViewStyle>;
}

/** the track's natural width; onLayout keeps the math honest if a parent shrinks it. */
const TRACK_WIDTH = 148;

export default function SettingSlider({ value, label, onChange, theme, style }: SettingSliderProps) {
  const [width, setWidth] = useState(TRACK_WIDTH);

  // the gesture handlers read only `width` (state) and `onChange` (the web's
  // inline lambda, fresh every render) — both live in the memo's deps. The CHANGE
  // dedup is the screen's business (the web input reports; the handler decides —
  // see the row wiring in SettingsScreen), so no render-surviving closure here:
  // the react-hooks laws forbid one, correctly.
  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (evt) => {
          const x = evt.nativeEvent.locationX;
          if (Number.isFinite(x)) onChange(valueFromX(x, width));
        },
        onPanResponderMove: (evt) => {
          const x = evt.nativeEvent.locationX;
          if (Number.isFinite(x)) onChange(valueFromX(x, width));
        },
      }),
    [width, onChange],
  );

  const thumbLeft = thumbLeftFor(value, width);

  return (
    <View
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ min: SLIDER_MIN, max: SLIDER_MAX, now: value, text: `${Math.round(value * 100)}%` }}
      accessibilityActions={[
        { name: 'increment', label: 'increment' },
        { name: 'decrement', label: 'decrement' },
      ]}
      onAccessibilityAction={(e) => {
        const dir = e.nativeEvent.actionName === 'increment' ? SLIDER_STEP : -SLIDER_STEP;
        const v = Math.min(SLIDER_MAX, Math.max(SLIDER_MIN, Number((value + dir).toFixed(3))));
        if (v !== value) onChange(v);
      }}
      {...pan.panHandlers}
      style={[styles.root, style]}
    >
      <View
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        style={[styles.track, { width: TRACK_WIDTH, backgroundColor: theme.bgSunken }]}
      >
        <View style={[styles.thumb, { left: thumbLeft, backgroundColor: theme.fgBright }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // the web input sits in the row's control slot; the 44pt floor is the touch law
  root: {
    height: layout.touch,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // the groove — browser-default height is ~4px; the thumb centres on it
  track: {
    height: 4,
    borderRadius: 2,
    overflow: 'visible',
  },
  // the thumb — the Toggle knob's 21px circle, same design language
  thumb: {
    position: 'absolute',
    top: -8.5,
    width: SLIDER_THUMB,
    height: SLIDER_THUMB,
    borderRadius: SLIDER_THUMB / 2,
  },
});
