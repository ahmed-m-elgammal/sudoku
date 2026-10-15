// GhostDemo.tsx — the M2 scripted lesson demos (docs/TUTORIAL_OPTIMIZATION_PLAN.md
// §5.2 T2/T7, §6.2 "GhostDemo"). Pure presentation over its own mini-board: the real
// Board/Cell tree is never touched, so no cell ever re-renders for the demo (§6.4).
//
//   kind 'rule'  (t2)  a row fills 1→9 with staggered ink, then a steady brass rule
//                      line appears — the one rule of sudoku, SHOWN before it is said.
//   kind 'claim' (t7)  a near-complete row takes its last digit, the flood tint runs —
//                      what a claim IS, before the player makes one.
//
// The stagger reuses the real cascade's cadence (motionLaw.floodDelayMs, 30 ms/cell) so
// the demo teaches the SAME visual language the live claim will use (§6.4). One shared
// progress value drives all nine cells (cell i settles at (i+1)/9 of the fill), the
// exact rhythm the live flood plays. Reduced motion starts settled — the settled state
// IS the state, so there is nothing to kill.
import { useEffect, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { i18n } from '@/i18n';
import { floodDelayMs } from '../motionLaw';
import { useMotionReduced } from '@/platform/display';
import { fonts, type Theme } from '@/theme/tokens';

export interface GhostDemoProps {
  kind: 'rule' | 'claim';
  theme: Theme;
  /** the digits the demo's row shows (the lesson's own prepared truth) */
  digits: readonly (1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9)[];
  /** optional tap-to-dismiss callback for timed demos (§5.2 T7) */
  onDismiss?: () => void;
}

const CELL_COUNT = 9;

export default function GhostDemo({ kind, theme, digits, onDismiss }: GhostDemoProps) {
  const motionReduced = useMotionReduced();
  // one shared progress value, created once with the motion law already applied
  const [progress] = useState(() => new Animated.Value(motionReduced ? 1 : 0));
  const [played, setPlayed] = useState(false);

  useEffect(() => {
    if (motionReduced) {
      progress.setValue(1);
      return;
    }
    const timing = Animated.timing(progress, {
      toValue: 1,
      duration: Math.max(220, floodDelayMs(CELL_COUNT, false)),
      easing: Easing.linear,
      useNativeDriver: false,
    });
    timing.start(({ finished }) => { if (finished) setPlayed(true); });
    return () => timing.stop();
  }, [progress, motionReduced]);

  // cell i settles at (i+1)/9 of the shared fill — the live flood's own cadence
  const settleFor = (i: number) => progress.interpolate({
    inputRange: [i / CELL_COUNT, (i + 1) / CELL_COUNT],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  const settled = motionReduced || played;

  const content = (
    <View
      accessibilityRole="text"
      accessibilityLabel={kind === 'rule' ? i18n.tutorialV2.t2Plain : i18n.tutorialV2.t7Plain}
      style={[styles.card, { borderColor: theme.lineStrong, backgroundColor: theme.bgRaised }]}
    >
      <Text style={[styles.head, { color: theme.fgBright }]}>
        {kind === 'rule' ? i18n.tutorialV2.t2Plain : i18n.tutorialV2.t7Plain}
      </Text>
      <View style={[styles.row, settled && kind === 'claim' && { backgroundColor: theme.floodYou }]}>
        {digits.slice(0, CELL_COUNT).map((d, i) => (
          <DemoCell key={i} value={d} opacity={settleFor(i)} theme={theme} isFirst={i === 0} />
        ))}
      </View>
      <Text style={[styles.ruleLine, { color: settled ? theme.focus : 'transparent' }]}>
        {kind === 'rule' ? i18n.tutorialV2.t2Flavor : i18n.tutorialV2.t7Flavor}
      </Text>
    </View>
  );

  if (onDismiss) {
    return (
      <Pressable onPress={onDismiss} accessibilityRole="button" accessibilityLabel={i18n.common.close}>
        {content}
      </Pressable>
    );
  }

  return <View pointerEvents="none">{content}</View>;
}

function DemoCell({
  value,
  opacity,
  theme,
  isFirst,
}: {
  value: number;
  opacity: Animated.AnimatedInterpolation<number>;
  theme: Theme;
  isFirst: boolean;
}) {
  return (
    <View
      style={[
        styles.cell,
        {
          borderColor: theme.lineStrong,
          borderLeftWidth: isFirst ? 1 : 0,
        },
      ]}
    >
      <Animated.Text style={[styles.digit, { color: theme.fgBright, opacity }]}>{value}</Animated.Text>
    </View>
  );
}

/** The prepared truth the rule demo shows (a valid row; deterministic, not from the puzzle). */
export const DEMO_ROW: readonly (1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9)[] = [1, 2, 3, 4, 5, 6, 7, 8, 9];

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 16,
    gap: 12,
    alignItems: 'center',
    maxWidth: '100%',
  },
  head: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  row: { flexDirection: 'row', alignSelf: 'center' },
  cell: {
    width: 30,
    height: 30,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  digit: { fontFamily: fonts.digit, fontSize: 16 },
  ruleLine: { fontFamily: fonts.bodyItalic, fontSize: 13, lineHeight: 18, textAlign: 'center' },
});
