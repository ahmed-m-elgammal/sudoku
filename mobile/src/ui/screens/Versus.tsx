// Versus — S07: tarot cards slam together, stakes, 3-2-1 sealed-tablet reveal, then the duel.
//
// PORT of ../src/app/game/Versus.tsx (specs/17 phase 4.5). The phase ladder is the
// web's verbatim: 0 slam -> 1 stakes -> 2..4 countdown -> go at 3300 ms, with the
// same audio cues (stamp on the II, taps on the I and the go). The slam keyframes
// (±70vw, ∓14°, 700 ms cubic-bezier(.2,.8,.2,1)) ride a native-driver transform —
// transform/opacity only, zero layout shift — and reduced motion renders the cards
// settled (the data-motion kill-list law). pendingFoe is set by Matchmaking; if it is
// somehow absent the screen holds the ink-black ground instead of navigating blind.
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Animated, Easing, Image, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUi } from '@/state/ui';
import { useSave } from '@/state/save';
import { audio } from '@/platform/audio';
import { useDisplaySettings, useMotionReduced } from '@/platform/display';
import { fonts, layout, palette, themeFor, type as typeScale } from '@/theme/tokens';
import { i18n } from '@/i18n';
import { imageForPath } from '@/theme/assets';
import { orderMeta } from '@shared/orders';
import type { OrderId } from '@shared/config';

export default function Versus() {
  const go = useUi((s) => s.go);
  const foe = useUi((s) => s.pendingFoe);
  const save = useSave((s) => s.save);
  const display = useDisplaySettings();
  const theme = useMemo(
    () => themeFor({ contrast: display.contrast, text: display.text }),
    [display.contrast, display.text],
  );
  const insets = useSafeAreaInsets();
  const fs = typeScale(theme.textScale);
  const { width } = useWindowDimensions();
  const [phase, setPhase] = useState(0); // 0 slam, 1 stakes, 2..4 countdown, 5 go
  // the phase ladder only runs with a foe plate in the machine — the web returned null
  // here with its timers still armed (blind navigation on an unreachable path); this
  // hold is the same ink-black ground, but never navigates
  const ready = !!(foe && save);

  useEffect(() => {
    if (!ready) return;
    const timers = [
      setTimeout(() => setPhase(1), 700),
      setTimeout(() => { setPhase(2); audio.stamp(); }, 1500),
      setTimeout(() => { setPhase(3); audio.uiTap(); }, 2100),
      setTimeout(() => { setPhase(4); audio.uiTap(); }, 2700),
      setTimeout(() => go('duel'), 3300),
    ];
    return () => timers.forEach(clearTimeout);
  }, [go, ready]);

  if (!foe || !save) {
    // no foe plate in the machine: hold the ink-black ground (never navigate blind)
    return <View style={[styles.root, { backgroundColor: theme.bg }]} />;
  }

  const mine = orderMeta(save.order);
  const theirs = orderMeta(foe.order as OrderId);
  const myPortrait = imageForPath(mine.portrait);
  const theirPortrait = imageForPath(theirs.portrait);

  return (
    <View style={[styles.root, { backgroundColor: theme.bg, paddingTop: insets.top }]}>
      <View style={styles.column}>
        <View style={styles.row}>
          {/* my card: brass-dim frame (web img mine, 128x160) */}
          <SlamCard side="left" travel={0.7 * width}>
            <View style={[styles.card, { borderColor: palette.brassDim }]}>
              {myPortrait ? <Image source={myPortrait} style={styles.cardImg} resizeMode="cover" accessibilityLabel={mine.name} /> : null}
            </View>
          </SlamCard>
          {/* their card: ash frame for a Shade (at 0.85), oxblood for a human */}
          <SlamCard side="right" travel={0.7 * width}>
            <View style={[styles.card, { borderColor: foe.shade ? palette.ash : palette.oxblood, opacity: foe.shade ? 0.85 : 1 }]}>
              {theirPortrait ? <Image source={theirPortrait} style={styles.cardImg} resizeMode="cover" accessibilityLabel={foe.name} /> : null}
            </View>
          </SlamCard>
        </View>

        <Text style={[styles.names, { color: theme.fg, fontSize: fs.md, marginTop: 10 }]}>
          {save.name} <Text style={{ color: palette.brass }}>·</Text> {foe.name}
          {foe.shade ? <Text style={[styles.echo, { color: palette.ash, fontSize: fs.xs }]}> ink-echo</Text> : null}
        </Text>

        {phase >= 1 ? (
          <Text style={[styles.stakes, { color: theme.fgDim, fontSize: fs.sm }]}>
            {i18n.versus.stakes.replace('{tier}', foe.tier ?? 'Ranked').replace('{rating}', String(save.standing))}
          </Text>
        ) : null}

        {phase >= 2 ? (
          <Text
            accessibilityRole="text"
            accessibilityLabel={i18n.versus.countdown[phase - 2]}
            style={[styles.count, { color: palette.brass, fontSize: 64, marginTop: 6 }]}
          >
            {i18n.versus.countdown[phase - 2]}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

/**
 * The web's `.slam-left` / `.slam-right`: translateX(±70vw) rotate(∓14deg) -> none,
 * 700 ms cubic-bezier(.2,.8,.2,1), played once at mount. Reduced motion never starts
 * the value off-settle — the settled state IS the render (the kill-list law).
 */
function SlamCard({
  side, travel, children,
}: {
  side: 'left' | 'right';
  travel: number;
  children: ReactNode;
}) {
  const motionReduced = useMotionReduced();
  const sign = side === 'left' ? -1 : 1;
  // useState lazy init (the FxLayers convention) — stable animated value, no ref
  // access during render.
  const [anim] = useState(() => new Animated.Value(motionReduced ? 1 : 0));

  useEffect(() => {
    if (motionReduced) return;
    const a = Animated.timing(anim, {
      toValue: 1,
      duration: 700,
      easing: Easing.bezier(0.2, 0.8, 0.2, 1),
      useNativeDriver: true,
    });
    a.start();
    return () => a.stop();
  }, [anim, motionReduced]);

  const translateX = anim.interpolate({ inputRange: [0, 1], outputRange: [sign * travel, 0] });
  const rotate = anim.interpolate({ inputRange: [0, 1], outputRange: [`${sign * 14}deg`, '0deg'] });
  return (
    <Animated.View style={{ transform: [{ translateX }, { rotate }] }}>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  // web main: grid placeItems center; inner column maxWidth 480
  column: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    width: '100%',
    maxWidth: layout.hubMax,
    paddingHorizontal: 16,
    overflow: 'hidden',
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  // web img: 128x160, 2px frame, radius 3
  card: { width: 128, height: 160, borderWidth: 2, borderRadius: 3, overflow: 'hidden', backgroundColor: palette.charcoal },
  cardImg: { width: '100%', height: '100%' },
  names: { fontFamily: fonts.display, textAlign: 'center' },
  echo: { fontFamily: fonts.body },
  stakes: { fontFamily: fonts.body },
  // web `.roman digits` at 64px — the later `.roman` rule wins, so the display face
  count: { fontFamily: fonts.display },
});
