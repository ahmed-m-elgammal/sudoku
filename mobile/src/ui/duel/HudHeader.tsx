// HudHeader.tsx — both portraits, the Roman medallion clock, the wax Seal pips, and the
// status chips with their drain rings.
//
// PORT of ../src/app/game/HudHeader.tsx. The clock is the engine clock shown as Roman
// minutes, the pips are the Seals that remain, and a Magistrate's 8 Seals get their own
// longer row (the web build grew `max` past 7 for exactly that reason).

import { Image, StyleSheet, Text, View } from 'react-native';
import { Svg, Circle, SvgUri } from 'react-native-svg';
import type { DuelRuntime } from '@/game/duelRuntime';
import { orderMeta } from '@shared/orders';
import { images, orderPortraits } from '@/theme/assets';
import { duelSvgs, statusSvg } from './duelAssets';
import { i18n } from '@/i18n';
import type { Theme } from '@/theme/tokens';

export interface HudHeaderProps {
  duel: DuelRuntime;
  theme: Theme;
}

const ROMAN_MIN = ['0', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
const CHIP_R = 10;
const CHIP_C = 2 * Math.PI * CHIP_R;

export default function HudHeader({ duel, theme }: HudHeaderProps) {
  const st = duel.state;
  const [me, foe] = st.players;
  const mins = Math.floor(st.clockMs / 60000);
  const medallion = mins <= 10 ? ROMAN_MIN[mins] : 'X';

  return (
    <View style={[styles.hud, { paddingTop: 44 }]}>
      <View style={styles.side}>
        <Portrait order={me.order} you theme={theme} />
        <SealPips n={me.seals} max={7} you theme={theme} />
        <StatusChips duel={duel} seat={0} theme={theme} />
      </View>

      <View style={styles.center}>
        <View style={styles.medallionWrap}>
          <SvgUri width="100%" height="100%" uri={duelSvgs.medallion} />
          <Text style={[styles.medallionText, { color: theme.fg }]} allowFontScaling={false}>
            {medallion}
          </Text>
        </View>
      </View>

      <View style={styles.side}>
        <StatusChips duel={duel} seat={1} theme={theme} />
        <SealPips n={foe.seals} max={foe.seals > 7 ? foe.seals : 7} theme={theme} />
        <Portrait order={foe.order} theme={theme} />
      </View>
    </View>
  );
}

function Portrait({ order, you, theme }: { order: Parameters<typeof orderMeta>[0]; you?: boolean; theme: Theme }) {
  const meta = orderMeta(order);
  const key = orderPortraits[order];
  // Portraits are WebP rasters, NOT SVG — an <Image>, not an <SvgUri>. Only the engraved
  // chrome (medallion, status marks, stamps) goes through react-native-svg.
  const src = key ? images[key] : null;
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={`${you ? i18n.common.you : i18n.common.theShade} portrait, ${meta.name}`}
      style={[styles.portrait, { borderColor: theme.lineStrong }]}
    >
      {src ? (
        <Image source={src} style={styles.portraitImg} resizeMode="cover" />
      ) : (
        <Text style={[styles.portraitFallback, { color: theme.fg }]} allowFontScaling={false}>
          {meta.name.slice(0, 2)}
        </Text>
      )}
    </View>
  );
}

function SealPips({ n, max, you, theme }: { n: number; max: number; you?: boolean; theme: Theme }) {
  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={`${you ? i18n.common.you : i18n.common.theShade} ${i18n.common.seals}: ${n} of ${max}`}
      style={styles.pips}
    >
      {Array.from({ length: max }, (_, i) => (
        <View
          key={i}
          style={[
            styles.pip,
            { borderColor: theme.fgDim },
            i < n && { backgroundColor: theme.accent, borderColor: theme.accent },
          ]}
        />
      ))}
    </View>
  );
}

function StatusChips({ duel, seat, theme }: { duel: DuelRuntime; seat: 0 | 1; theme: Theme }) {
  const p = duel.state.players[seat];
  if (!p.statuses.length) return null;

  return (
    <View style={styles.chips}>
      {p.statuses.map((s) => {
        const left = Math.max(0, (s.endsAtMs - duel.state.clockMs) / 1000);
        const art = statusSvg[s.type];
        return (
          <View
            key={s.uid}
            accessibilityRole="text"
            accessibilityLabel={`${i18n.duel.status[s.type]}, ${left.toFixed(0)}s`}
            style={[styles.chip, { borderColor: theme.lineStrong, backgroundColor: theme.bgRaised }]}
          >
            {art ? <SvgUri width={12} height={12} uri={duelSvgs[art]} /> : null}
            <Text style={[styles.chipLabel, { color: theme.fg }]} numberOfLines={1} allowFontScaling={false}>
              {i18n.duel.status[s.type]}
            </Text>
            <Text style={[styles.chipCount, { color: theme.fgDim }]} allowFontScaling={false}>
              {left.toFixed(0)}
            </Text>
            <View style={StyleSheet.absoluteFill} pointerEvents="none">
              <Svg width="100%" height="100%" viewBox="0 0 24 24">
                <Circle cx={12} cy={12} r={CHIP_R} fill="none" stroke={theme.cdTrack} strokeWidth={1.5} />
                <Circle
                  cx={12}
                  cy={12}
                  r={CHIP_R}
                  fill="none"
                  stroke={theme.focus}
                  strokeWidth={2}
                  strokeDasharray={`${CHIP_C} ${CHIP_C}`}
                  strokeDashoffset={CHIP_C * (1 - Math.max(0, Math.min(1, left / 10)))}
                />
              </Svg>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  hud: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingHorizontal: 12, gap: 8 },
  side: { flex: 1, alignItems: 'center', gap: 4 },
  center: { alignItems: 'center', paddingTop: 4 },
  medallionWrap: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center' },
  medallionText: { position: 'absolute', fontFamily: 'IM Fell English SC', fontSize: 17 },
  portrait: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 20,
    overflow: 'hidden',
  },
  portraitImg: { width: '100%', height: '100%' },
  portraitFallback: { fontFamily: 'IM Fell English SC', fontSize: 14 },
  pips: { flexDirection: 'row', flexWrap: 'wrap', gap: 3, justifyContent: 'center' },
  pip: { width: 10, height: 10, borderRadius: 5, borderWidth: 1.5 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 3, justifyContent: 'center', maxWidth: 132 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderWidth: 1,
    borderRadius: 3,
    paddingHorizontal: 4,
    paddingVertical: 1,
    overflow: 'hidden',
  },
  chipLabel: { fontSize: 11 },
  chipCount: { fontSize: 11 },
});

