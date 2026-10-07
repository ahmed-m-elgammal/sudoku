// FxLayers.tsx — the three room-wide presentation layers.
//
// J2 — the Tablet shake. Two tiers: T2 (3 px, 480 ms) on any RESOLVED claim, T3
//      (6 px, 700 ms) on the "He adapts." orderSwap, the duel-ending `end`, and a boss
//      phase entry. The keyframe percentages are the web build's, copied across.
//
// J3 — the world dim. A hard-cut overlay while a Seal breaks (hit-stop, 100 ms), deeper
//      while the verdict waits (slow ink, 300 ms). No animation to kill — reduced motion
//      simply never mounts it, which lands on the same settled state.
//
// J4 — the heat vignette. `opacity: var(--heat)` on an inset-shadow overlay. Nothing else
//      in this file computes anything: the values arrive as props from the pure law in
//      `@/game/fx`.
//
// Every animated property here is `transform` or `opacity` — zero layout shift, so a
// shake can never reflow the board under the player's finger.

import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, View, useWindowDimensions } from 'react-native';
import { SHAKE_MS, type Shake } from '@/game/fx';
import { useMotionReduced } from '@/platform/display';
import type { Theme } from '@/theme/tokens';

export interface ShakeLayerProps {
  shake: Shake | null;
  children: React.ReactNode;
}

/**
 * J2 — the tiered shake. A/B nonce parity retriggers consecutive shakes without a remount,
 * which is exactly what the web CSS keyframe pairs did. The kill-list law: reduced motion
 * never shakes the Tablet — the children render plain, which IS the settled state
 * (`:root[data-motion='reduced'] .shakeT2A/.shakeT3A/... { animation: none }`).
 */
export function ShakeLayer({ shake, children }: ShakeLayerProps) {
  const motionReduced = useMotionReduced();
  const [anim] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!shake || motionReduced) return;
    const frames = shake.tier === 3 ? SHAKE_MS[3] : SHAKE_MS[2];
    anim.setValue(0);
    const anim2 = Animated.timing(anim, {
      toValue: 1,
      duration: frames,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: true,
    });
    anim2.start();
    return () => anim2.stop();
    // `nonce` is the dependency that matters: two shakes in a row must both play.
  }, [anim, shake, motionReduced]);

  if (!shake || motionReduced) return <>{children}</>;

  const amp = shake.tier === 3 ? 6 : 3;
  // The web build's keyframe percentages and offsets, copied across. T2 is the short
  // claim shake; T3 is the long, deeper one (swap / end / boss phase).
  const stops = shake.tier === 3 ? [0, 0.15, 0.35, 0.55, 0.75, 0.9, 1] : [0, 0.2, 0.45, 0.7, 0.85, 1];
  const dx =    shake.tier === 3 ? [0, -1, 1, -0.7, 0.45, -0.2, 0]     : [0, -1, 1, -0.6, 0.4, 0];
  const dy =    shake.tier === 3 ? [0, 2, -2, 1, -1, 0, 0]              : [0, 1, -1, 0, 0, 0];
  const rot =   shake.tier === 3
    ? ['0deg', '-0.35deg', '0.3deg', '-0.2deg', '0.12deg', '0deg', '0deg']
    : ['0deg', '0deg', '0deg', '0deg', '0deg', '0deg'];
  const range = stops;

  const translateX = anim.interpolate({ inputRange: range, outputRange: dx.map((m) => m * amp) });
  const translateY = anim.interpolate({ inputRange: range, outputRange: dy.map((m) => (m * amp) / 3) });
  const rotate = anim.interpolate({ inputRange: range, outputRange: rot });

  return (
    <Animated.View style={{ flex: 1, transform: [{ translateX }, { translateY }, { rotate }] }}>
      {children}
    </Animated.View>
  );
}

export interface WorldDimProps {
  /** J3 — a Seal is breaking right now */
  hit: boolean;
  /** J3 — the verdict is waiting */
  slow: boolean;
  theme: Theme;
}

/**
 * J3 — the freeze veil. `hit` dims; `slow` dims deeper. Colours are the web build's
 * `.worldDim` / `.worldDimDeep` verbatim (via `theme.worldDim*`) — a warm ink veil at
 * 0.28 / 0.42, NOT the app background at a higher opacity the first pass shipped.
 */
export function WorldDim({ hit, slow, theme }: WorldDimProps) {
  if (!hit && !slow) return null;
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, { backgroundColor: slow ? theme.worldDimDeep : theme.worldDim }]}
    />
  );
}

export interface HeatVignetteProps {
  /** J4 — 0..1, straight from `heatFromState` */
  heat: number;
  theme: Theme;
}

/**
 * J4 — the vignette. An inset box-shadow cannot exist in RN, so the depth is reproduced
 * with four stacked edge gradients driven by the same `--heat` value. Opacity only.
 * The web kill-list kills the vignette's 240 ms transition, not the vignette: reduced
 * motion lands the depth INSTANTLY (a state, never a swell).
 */
export function HeatVignette({ heat, theme }: HeatVignetteProps) {
  const { width, height } = useWindowDimensions();
  const motionReduced = useMotionReduced();
  const [anim] = useState(() => new Animated.Value(heat));

  useEffect(() => {
    if (motionReduced) {
      anim.setValue(heat);
      return;
    }
    const timing = Animated.timing(anim, {
      toValue: heat,
      duration: 240,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    });
    timing.start();
    return () => timing.stop();
  }, [anim, heat, motionReduced]);

  const edge = Math.round(Math.min(width, height) * 0.22);

  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.vignette, { opacity: anim }]}>
      <View style={[styles.edge, { top: 0, left: 0, right: 0, height: edge, borderTopWidth: edge, borderColor: theme.bg }]} />
      <View style={[styles.edge, { bottom: 0, left: 0, right: 0, height: edge, borderBottomWidth: edge, borderColor: theme.bg }]} />
      <View style={[styles.edge, { top: 0, bottom: 0, left: 0, width: edge, borderLeftWidth: edge, borderColor: theme.bg }]} />
      <View style={[styles.edge, { top: 0, bottom: 0, right: 0, width: edge, borderRightWidth: edge, borderColor: theme.bg }]} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  vignette: {},
  edge: { position: 'absolute', opacity: 0.9 },
});