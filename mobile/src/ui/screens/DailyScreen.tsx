// DailyScreen — S14: today's puzzle card, the countdown to next, streak,
// Offer-a-Candle, and the top-100 leaderboard.
//
// PORT of ../src/app/game/DailyScreen.tsx (115 lines; leaderboard extracted to
// DailyBoard.tsx to hold the ~300-line ceiling). The duel itself is unchanged —
// this is a launcher: the Start button routes duelMode 'daily' and the already-
// ported DuelScreen.finish records streak/times/lastDate (and, since this task,
// posts net.dailyResult like web:157-160).
//
// Translation notes (the AGENTS.md platform table, nothing more):
//  - the web re-reads `todayUtcKey()` every render (its 1 s countdown tick makes
//    it re-evaluate, so the card flips to `attempted` exactly at UTC midnight).
//    The render-purity law moves the clock read out of render; the 1 s tick now
//    re-keys the state, reproducing the midnight flip + refetch one tick later.
//  - `.page-turn` (entry animation) is skipped — the established shell-chrome law.
//  - `alert(i18n.daily.candleNote)` → RN `Alert.alert` with the same single
//    argument (the note as the body; RN's dialog chrome is platform UI).
//  - `.btn-ghost` is the `.btn` geometry with border line-strong + transparent
//    ground (global.css:81/:101); '🕯' and the '(n/3)' suffix are web component
//    literals (DailyScreen.tsx:73), carried verbatim.
//  - the candle SVGs are this screen's own literal requires (Metro bundling
//    law, the Antechamber port's pattern); `Tier` is a web literal.
//  - the fetch effect adds an unmount guard (RN warns on setState after unmount;
//    the web's net.daily already never throws — both catches are the web's).
//  - the Ribbon is the column's last child (the web's position:fixed ribbon +
//    .hub pad, the Antechamber port's established translation).
import { useEffect, useMemo, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Art from '@/ui/Art';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUi } from '@/state/ui';
import { useSave } from '@/state/save';
import { net } from '@/game/net/client';
import { audio } from '@/platform/audio';
import { useDisplaySettings } from '@/platform/display';
import { fonts, palette, themeFor, type as typeScale } from '@/theme/tokens';
import { i18n } from '@/i18n';
// tierForDailyDate + todayUtcKey ride the @shared barrel (screens ban
// @shared/sudoku and @shared/rng directly — this is copy/derivation surface).
import { tierForDailyDate, todayUtcKey } from '@shared';
import Ribbon from '@/ui/Ribbon';
import DailyBoard, { type DailyData } from './DailyBoard';
import { fmtCountdown } from './dailyFormat';

const CANDLE_LIT = require('../../../assets/game/reliquary/candle-lit.png');
const CANDLE_UNLIT = require('../../../assets/game/reliquary/candle-unlit.png');
const candleUri = (lit: boolean) => Image.resolveAssetSource(lit ? CANDLE_LIT : CANDLE_UNLIT)?.uri ?? '';

export default function DailyScreen() {
  const go = useUi((s) => s.go);
  const save = useSave((s) => s.save);
  const display = useDisplaySettings();
  const theme = useMemo(
    () => themeFor({ contrast: display.contrast, text: display.text }),
    [display.contrast, display.text],
  );
  const insets = useSafeAreaInsets();
  const fs = typeScale(theme.textScale);
  const [data, setData] = useState<DailyData | null>(null);
  const [countdown, setCountdown] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  // lazy initialiser — the render-purity seam (the web reads the clock in render)
  const [key, setKey] = useState(() => todayUtcKey());
  const done = save?.daily.lastDate === key;

  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const d = (await net.daily(key)) as DailyData | null;
        if (live) setData(d);
      } catch {
        if (live) setError(true);
      }
      if (live) setLoading(false);
    })();
    return () => { live = false; };
  }, [key]);

  useEffect(() => {
    const iv = setInterval(() => {
      const now = new Date();
      const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
      const s = Math.max(0, Math.floor((next - now.getTime()) / 1000));
      setCountdown(fmtCountdown(s));
      // the web's per-render todayUtcKey() re-evaluated on every tick; this is
      // that law moved into the tick — same value 86399 s a day, flips at midnight
      setKey(todayUtcKey());
    }, 1000);
    return () => clearInterval(iv);
  }, []);

  if (!save) return null;

  return (
    <View style={[styles.root, { backgroundColor: theme.bg }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
          {/* browser-default h1: 2em x the 15px body -> 2 * fs.md, display face, 0.02em */}
          <Text
            accessibilityRole="header"
            style={[styles.title, { color: theme.fg, fontSize: 2 * fs.md, letterSpacing: 0.02 * 2 * fs.md }]}
          >
            {i18n.daily.title}
          </Text>
          <Text style={[styles.sub, { color: theme.fgDim, fontSize: fs.md }]}>{i18n.daily.sub}</Text>
        </View>

        {/* web section.panel.page-turn: margin '8px 16px', padding 14, textAlign center */}
        <View
          style={[styles.panel, { marginHorizontal: 16, marginVertical: 8, backgroundColor: theme.bgRaised, borderColor: theme.lineStrong }]}
        >
          <View style={[styles.ring, { borderColor: theme.line }]} pointerEvents="none" />
          <Art uri={candleUri(done)} width={40} height={40} />
          <Text style={[styles.center, { color: theme.fg, fontSize: fs.md, marginTop: 6 }]}>
            <Text style={[styles.bold, { color: theme.fg, fontSize: fs.md }]}>{key}</Text>
            {` · Tier ${tierForDailyDate(key)}`}
          </Text>
          <Text style={[styles.center, { color: theme.fgDim, fontSize: fs.sm }]}>{i18n.daily.mistakeNote}</Text>
          <Text style={[styles.center, { color: theme.fgDim, fontSize: fs.sm }]}>
            {i18n.daily.streak}: {save.daily.streak} · {i18n.daily.countdown} {countdown}
          </Text>
          {done ? (
            <>
              <Text style={[styles.center, { color: palette.brass, fontSize: fs.md, marginTop: 8 }]}>
                {i18n.daily.attempted}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${i18n.daily.candle} (${save.daily.candlesToday}/3)`}
                onPress={() => Alert.alert(i18n.daily.candleNote)}
                style={({ pressed }) => [
                  styles.ghost,
                  { borderColor: theme.lineStrong, opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <Text style={[styles.btnText, { color: theme.fg, fontSize: fs.md, letterSpacing: 0.06 * fs.md }]}>
                  🕯 {i18n.daily.candle} ({save.daily.candlesToday}/3)
                </Text>
              </Pressable>
            </>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={i18n.daily.start}
              onPress={() => {
                audio.stamp();
                go('duel', { duelMode: 'daily' });
              }}
              style={({ pressed }) => [
                styles.primary,
                { backgroundColor: theme.bgRaised, opacity: pressed ? 0.82 : 1 },
              ]}
            >
              <Text style={[styles.btnText, { color: palette.parchmentLight, fontSize: fs.md, letterSpacing: 0.06 * fs.md }]}>
                {i18n.daily.start}
              </Text>
            </Pressable>
          )}
        </View>

        <DailyBoard theme={theme} fs={fs} data={data} loading={loading} error={error} />
      </ScrollView>
      {/* web .hub pads under the fixed ribbon; here the Ribbon is the column's last child */}
      <Ribbon />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingBottom: 16 },
  // web header: padding 'calc(var(--safe-top) + 14px) 16px 6px', textAlign center
  header: { alignItems: 'center', paddingHorizontal: 16, paddingBottom: 6 },
  title: { fontFamily: fonts.display }, // 2em + 0.02em ride inline
  sub: { fontFamily: fonts.bodyItalic },
  // web .panel: bg-raised, 1px line-strong, radius — plus the ::before engraved ring
  panel: { borderWidth: 1, borderRadius: 4, padding: 14, alignItems: 'center' },
  ring: { position: 'absolute', top: 4, left: 4, right: 4, bottom: 4, borderWidth: 1, borderRadius: 2 },
  center: { fontFamily: fonts.body, textAlign: 'center' },
  bold: { fontFamily: fonts.body, fontWeight: '700' }, // web <b>{key}</b>
  // web .btn.btn-primary: padding '10px 18px', 1.5 brass border, charcoal ground
  primary: {
    minHeight: 44,
    marginTop: 10,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderColor: palette.brass,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // web .btn.btn-ghost: same geometry, border line-strong, transparent ground
  ghost: {
    minHeight: 44,
    marginTop: 6,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: { fontFamily: fonts.display }, // .btn letter-spacing 0.06em rides inline
});
