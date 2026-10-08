// Spotlight.tsx — the M2 spotlight scrim (docs/TUTORIAL_OPTIMIZATION_PLAN.md §5.3).
//
// Four dim rects around a punched-out hole (the geometry is the pure law in
// spotlight.ts). NO blur, NO glow — matte ink at the world-dim veil, per the style
// bible. The scrim ABSORBS taps on dimmed ground (empty Pressables) and lets taps
// through the hole (the layer is box-none; the hole has no view in it), so the taught
// target is the only thing touchable — which is also how the t3/t4 gates are enforced.
//
// The steady brass outline marks the hole; reduced motion gets the same steady outline
// (there is deliberately no pulse animation to kill — the settled state IS the state).
import { Pressable, StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { dimRectsAround, type Rect } from './spotlight';
import type { Theme } from '@/theme/tokens';

export interface SpotlightProps {
  /** the target container's rect in WINDOW coordinates (measureInWindow) */
  container: { x: number; y: number; w: number; h: number };
  /** the hole, in the CONTAINER's own coordinates */
  hole: Rect | null;
  theme: Theme;
  style?: StyleProp<ViewStyle>;
}

export default function Spotlight({ container, hole, theme, style }: SpotlightProps) {
  const rects = dimRectsAround(hole, { w: container.w, h: container.h });
  return (
    <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, style]}>
      {rects.map((r, i) => {
        const abs: ViewStyle = {
          position: 'absolute',
          left: container.x + r.x,
          top: container.y + r.y,
          width: r.w > 0 ? r.w : 0,
          height: r.h > 0 ? r.h : 0,
        };
        if (r.w <= 0 || r.h <= 0) return null;
        return (
          <Pressable
            key={i}
            onPress={() => { /* absorbed: the scrim swallows taps on dimmed ground */ }}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={[styles.dim, abs, { backgroundColor: theme.worldDimDeep }]}
          />
        );
      })}
      {hole ? (
        <View
          pointerEvents="none"
          style={[
            styles.hole,
            {
              left: container.x + hole.x,
              top: container.y + hole.y,
              width: hole.w,
              height: hole.h,
              borderColor: theme.focus,
            },
          ]}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  dim: { position: 'absolute' },
  hole: {
    position: 'absolute',
    borderWidth: 2,
    borderRadius: 4,
  },
});
