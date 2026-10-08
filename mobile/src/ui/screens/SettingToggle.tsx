// SettingToggle — the port of the web SettingsScreen's inline Toggle
// (SettingsScreen.tsx:29-37): a 52×30 switch, oxblood when on / charcoal-2 when
// off, a 21px parchment knob that slides 3px → 26px over var(--t-fast).
//
// It gets its own file for one reason: the knob animates. The no-god-files law
// gives any component with its own animation a file (the "no anonymous inline
// components for anything with state or fx" rule), and the web's `transition:
// left var(--t-fast)` is an animation. RN's law (AGENTS.md layout rules) is to
// animate transform/opacity/backgroundColor only — never left — so the knob's
// 23px travel is a translateX over the same motion.fast duration.
//
// Translation notes (the AGENTS.md platform table, nothing more):
//  - `role="switch" aria-checked` → accessibilityRole="switch" +
//    accessibilityState.checked; the web's aria-label rides along;
//  - the web's onClick plays synth.uiTap() BEFORE the toggle lands — the same
//    order here (the uiTap is the knob's own sound, not the setting's);
//  - the web's `:root[data-motion='reduced']` kill-list and the media query's
//    `transition-duration: 0.01ms` both land the knob instantly under reduced
//    motion — useMotionReduced() is that same guard, duration 0.
import { useEffect, useState } from 'react';
import { Animated, Pressable, StyleSheet } from 'react-native';
import { audio } from '@/platform/audio';
import { useMotionReduced } from '@/platform/display';
import { motion, palette, type Theme } from '@/theme/tokens';

interface SettingToggleProps {
  on: boolean;
  label: string;
  onToggle: () => void;
  theme: Theme;
}

/** the knob's travel: left 3 → left 26 (web Toggle <i>), i.e. 23px of x. */
const KNOB_TRAVEL = 23;

export default function SettingToggle({ on, label, onToggle, theme }: SettingToggleProps) {
  const reduced = useMotionReduced();
  // the animated node is built once (lazy useState — a useRef().current read in
  // render trips the render-phase ref law)
  const [knob] = useState(() => new Animated.Value(on ? 1 : 0));

  useEffect(() => {
    Animated.timing(knob, {
      toValue: on ? 1 : 0,
      duration: reduced ? 0 : motion.fast,
      useNativeDriver: true,
    }).start();
  }, [on, reduced, knob]);

  const x = knob.interpolate({ inputRange: [0, 1], outputRange: [0, KNOB_TRAVEL] });

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: on }}
      accessibilityLabel={label}
      onPress={() => {
        audio.uiTap();
        onToggle();
      }}
      style={[styles.track, { backgroundColor: on ? palette.oxblood : palette.charcoal2, borderColor: theme.lineStrong }]}
    >
      <Animated.View style={[styles.knob, { backgroundColor: palette.parchmentLight, transform: [{ translateX: x }] }]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // web button: width 52, height 30, radius 15, border 1.5px line-strong,
  // minHeight 30 (RN borders sit inside the box — the same paint)
  track: {
    width: 52,
    height: 30,
    borderRadius: 15,
    borderWidth: 1.5,
    justifyContent: 'center',
  },
  // web <i>: 21×21 circle, absolute top 3 left 3; the slide is the transform
  knob: {
    position: 'absolute',
    left: 3,
    width: 21,
    height: 21,
    borderRadius: 10.5,
  },
});
