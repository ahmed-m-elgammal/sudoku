// ledgerGraph.tsx — the Standing graph panel of the Great Ledger (S17), extracted
// from the screen (the friendPanels/ledgerRecovery split — the no-god-files law):
// the spark polyline over the last 20 standings and the four-counter readout.
//
// PORT of the first <section className="panel"> in ../src/app/game/LedgerProfile.tsx
// (:78-89). The point math lives in ledgerLaw.sparkPoints (pinned, not re-derived).
import { Svg, Polyline } from 'react-native-svg';
import { StyleSheet, Text, View } from 'react-native';
import { fonts, layout, palette, type Theme, type as typeScale } from '@/theme/tokens';
import { i18n } from '@/i18n';
import { sparkPoints } from './ledgerLaw';

type Fs = ReturnType<typeof typeScale>;

export interface StandingGraphProps {
  /** the save's stats.standingHistory — the law slices the last 20 */
  history: number[];
  stats: { duels: number; wins: number; losses: number; longestStreak: number };
  theme: Theme;
  fs: Fs;
}

export default function StandingGraph({ history, stats, theme, fs }: StandingGraphProps) {
  return (
    <View style={[styles.section, { backgroundColor: theme.bgRaised, borderColor: theme.lineStrong }]}>
      <View style={[styles.ring, { borderColor: theme.line }]} pointerEvents="none" />
      <Text accessibilityRole="header" style={[styles.h2, { color: theme.fg, fontSize: fs.md, letterSpacing: 0.02 * fs.md }]}>
        {i18n.ledger.standingGraph}
      </Text>
      {/* web svg: width 100%, height 76, marginTop 6; polyline brass 1.5, fill none */}
      <Svg width="100%" height={76} style={styles.graph}>
        <Polyline fill="none" stroke={palette.brass} strokeWidth={1.5} points={sparkPoints(history)} />
      </Svg>
      {/* web dl: repeat(4, 1fr), gap 6, marginTop 8, centered, fs-sm */}
      <View style={[styles.statsRow, { marginTop: 8 }]}>
        <View style={styles.stat}>
          <Text style={[styles.body, { color: theme.fg, fontSize: fs.sm }]}>{i18n.ledger.duels}</Text>
          <Text style={[styles.digits, { color: theme.fg, fontSize: fs.sm }]}>{stats.duels}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={[styles.body, { color: theme.fg, fontSize: fs.sm }]}>{i18n.ledger.wins}</Text>
          <Text style={[styles.digits, { color: theme.fg, fontSize: fs.sm }]}>{stats.wins}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={[styles.body, { color: theme.fg, fontSize: fs.sm }]}>{i18n.ledger.losses}</Text>
          <Text style={[styles.digits, { color: theme.fg, fontSize: fs.sm }]}>{stats.losses}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={[styles.body, { color: theme.fg, fontSize: fs.sm }]}>{i18n.ledger.streak}</Text>
          <Text style={[styles.digits, { color: theme.fg, fontSize: fs.sm }]}>{stats.longestStreak}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // web section.panel: margin '8px 16px' (the 8 rides sectionFirst on the caller), padding 12
  section: {
    marginHorizontal: 16,
    padding: 12,
    borderWidth: 1,
    borderRadius: layout.radius,
  },
  // web .panel::before: absolute inset 4, 1px var(--line), radius 2
  ring: { position: 'absolute', top: 4, left: 4, right: 4, bottom: 4, borderWidth: 1, borderRadius: 2 },
  // web h2: font-display, fs-md (0.02em tracking rides the inline style)
  h2: { fontFamily: fonts.display },
  graph: { marginTop: 6 },
  // web dl: repeat(4, 1fr), gap 6, centered
  statsRow: { flexDirection: 'row', gap: 6 },
  stat: { flex: 1, alignItems: 'center', gap: 6 },
  body: { fontFamily: fonts.body },
  digits: { fontFamily: fonts.digit },
});
