// DailyBoard — S14's leaderboard panel: the top-100 for today's Daily Assize.
//
// PORT of ../src/app/game/DailyScreen.tsx's second <section className="panel">.
// States ride the web's exact branches: loading → a parchment skeleton block,
// error → the offline line, empty data → daily.emptyBoard, else the ranked rows.
//
// Translation notes (the AGENTS.md platform table, nothing more):
//  - the web's `ol { maxHeight: 260; overflowY: auto }` becomes an inner
//    ScrollView with the same 260 cap and nestedScrollEnabled (same-direction
//    nesting needs the flag on Android; iOS scrolls natively).
//  - `.digits` is fonts.digit; the rank's `<b className="digits">` is the
//    registered bold cut of that face (RN cannot synthesize weights).
//  - the "you" row wash is theme.youRowWash — the web's inline
//    rgba(165,136,73,0.12), lifted into tokens verbatim.
//  - the skeleton's `.skeleton-parchment::after` repeating stripe
//    (rgba(205,185,146,0.05) every 34px) has no RN repeating-gradient
//    equivalent and is sub-perceptual at 5% alpha — reported, not invented.
//  - '✗' is a web component literal (DailyScreen.tsx:106), carried verbatim.
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { fonts, palette, themeFor, type as typeScale } from '@/theme/tokens';
import { i18n } from '@/i18n';
import { fmtClock } from './dailyFormat';

export interface DailyRow {
  name: string;
  timeMs: number;
  mistakes: number;
  rank: number;
  you?: boolean;
}

export interface DailyData {
  dateKey: string;
  tier: string;
  leaderboard: DailyRow[];
  yourRank: number | null;
  streak: number;
}

type Theme = ReturnType<typeof themeFor>;
type Fs = ReturnType<typeof typeScale>;

export default function DailyBoard({
  theme,
  fs,
  data,
  loading,
  error,
}: {
  theme: Theme;
  fs: Fs;
  data: DailyData | null;
  loading: boolean;
  error: boolean;
}) {
  return (
    <View
      style={[styles.panel, { marginHorizontal: 16, marginVertical: 10, backgroundColor: theme.bgRaised, borderColor: theme.lineStrong }]}
    >
      <View style={[styles.ring, { borderColor: theme.line }]} pointerEvents="none" />
      <Text style={[styles.title, { color: theme.fg, fontSize: fs.md, letterSpacing: 0.02 * fs.md }]}>
        {i18n.daily.leaderboard}
      </Text>
      {loading && (
        <View style={[styles.skeleton, { backgroundColor: palette.charcoal, marginTop: 8 }]} />
      )}
      {error && (
        <Text style={[styles.dimItalic, { color: theme.fgDim, fontSize: fs.sm, marginTop: 8 }]}>
          {i18n.offline.body}
        </Text>
      )}
      {data && data.leaderboard.length === 0 && (
        <Text style={[styles.dim, { color: theme.fgDim, fontSize: fs.sm, marginTop: 8 }]}>
          {i18n.daily.emptyBoard}
        </Text>
      )}
      {/* data && leaderboard.length > 0 — web ol: maxHeight 260, overflowY auto */}
      {data && data.leaderboard.length > 0 && (
        <ScrollView style={[styles.board, { marginTop: 8 }]} nestedScrollEnabled>
          {data.leaderboard.slice(0, 100).map((row) => (
            <View
              key={row.rank}
              style={[
                styles.row,
                { borderBottomColor: theme.line, backgroundColor: row.you ? theme.youRowWash : 'transparent' },
              ]}
            >
              <Text style={[styles.rank, { color: theme.fg, fontSize: fs.sm }]}>{row.rank}</Text>
              <Text numberOfLines={1} ellipsizeMode="tail" style={[styles.name, { color: theme.fg, fontSize: fs.sm }]}>
                {row.name}
                {row.you ? ` (${i18n.daily.you})` : ''}
              </Text>
              <Text style={[styles.digits, { color: theme.fg, fontSize: fs.sm }]}>{fmtClock(row.timeMs)}</Text>
              <Text style={[styles.mistakes, { color: theme.fgDim, fontSize: fs.sm }]}>
                {row.mistakes} ✗
              </Text>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // web .panel + inline margin '10px 16px', padding 14
  panel: { borderWidth: 1, borderRadius: 4, padding: 14 },
  // web .panel::before — the engraved inner ring, inset 4, 1px var(--line), radius 2
  ring: { position: 'absolute', top: 4, left: 4, right: 4, bottom: 4, borderWidth: 1, borderRadius: 2 },
  title: { fontFamily: fonts.display },
  // web .skeleton-parchment: the charcoal block, height 60 (stripes reported above)
  skeleton: { height: 60 },
  dimItalic: { fontFamily: fonts.bodyItalic },
  dim: { fontFamily: fonts.body },
  board: { maxHeight: 260 },
  // web li: flex, gap 8, padding '5px 6px', 1px bottom border
  row: { flexDirection: 'row', gap: 8, paddingVertical: 5, paddingHorizontal: 6, borderBottomWidth: 1 },
  // web b.digits width 34
  rank: { fontFamily: fonts.digitBold, width: 34 },
  // web span flex:1, ellipsis
  name: { fontFamily: fonts.body, flex: 1 },
  digits: { fontFamily: fonts.digit },
  // web width 44, right-aligned
  mistakes: { fontFamily: fonts.digit, width: 44, textAlign: 'right' },
});
