// ResultScreen — S09: engraved banner, the Ledger of this Duel, rewards,
// Rematch/Antechamber, share card.
//
// PORT of ../src/app/game/ResultScreen.tsx (the web build, 94 lines). This screen is
// the town crier, not the clerk: it only READS `ui.lastResult`. The Ink minting is
// NOT here and must never be here — DuelScreen.finish() records exactly one ledger
// entry per duel (`recordInk`, deduped by duelId in the MMKV-backed pending queue,
// which is why the award survives an app kill). Rendering this screen twice — a
// remount, an Android back-pop — replays the fanfare and nothing else.
//
// Translation notes (the AGENTS.md platform table, nothing more):
//  - `<polyline>` sparkline -> react-native-svg, which is already a dependency.
//    The web svg is width:100% with NO viewBox, so its points land in px space and
//    the trace spans the left 300px of a wider panel. Reproduced as-is — fidelity,
//    not repair (AGENTS.md: report defects, do not fix them here).
//  - the 600x336 share canvas + `<a download>` -> the native share sheet, same
//    user-visible outcome, no new dependency. Only the player's own verdict fields
//    go into the message: banner, claims, mistakes, time, standing. No identity,
//    no auth material, no server state.
//  - the ink-drop icon rides SvgUri the same way the duel's SVGs do (see
//    ../duel/duelAssets.ts for the resolveAssetSource law this file follows).
//  - the web's `.page-turn` banner animation is shell-wide page chrome, not screen
//    content; no mobile screen animates its own entry yet, so this one doesn't
//    either (same decision the DuelScreen port made).
//  - the share message's 'ASSIZE' wordmark and the reliquary line's '— the wax is
//    warm.' are component literals on the web too (ResultScreen.tsx:36/:81) — the
//    dictionary has no key for them, so the port carries them verbatim rather than
//    diverging the frozen en.json.
import { useEffect, useMemo } from 'react';
import { Image, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Polyline, SvgUri } from 'react-native-svg';
import { useUi } from '@/state/ui';
import { useSave } from '@/state/save';
import { audio } from '@/platform/audio';
import { useDisplaySettings } from '@/platform/display';
import { fonts, layout, palette, themeFor, type as typeScale } from '@/theme/tokens';
import { i18n } from '@/i18n';

// Metro needs a literal require (see metro.config.js: svg is an asset extension);
// resolveAssetSource turns the asset id into the URI SvgUri renders.
const INK_DROP = require('../../../assets/game/icons/ink-drop.svg');
const inkDropUri = Image.resolveAssetSource(INK_DROP)?.uri ?? '';

export default function ResultScreen() {
  const ui = useUi();
  const save = useSave((s) => s.save);
  const display = useDisplaySettings();
  const theme = useMemo(
    () => themeFor({ contrast: display.contrast, text: display.text }),
    [display.contrast, display.text],
  );
  const insets = useSafeAreaInsets();
  const r = ui.lastResult;
  const fs = typeScale(theme.textScale);

  // The fanfare, one per mount of one result — exactly the web's effect (web:15).
  useEffect(() => {
    if (!r) return;
    if (r.winner === 0) audio.victory();
    else if (r.winner === 'draw') audio.draw();
    else audio.defeat();
  }, [r]);

  if (!r || !save) return null;

  const won = r.winner === 0;
  const draw = r.winner === 'draw';
  const banner = draw ? i18n.result.draw : won ? i18n.result.victory : i18n.result.defeat;
  const mins = Math.floor(r.timeMs / 60000);
  const secs = Math.floor((r.timeMs % 60000) / 1000);
  const spark =
    r.sealTimeline.map(([t, seals]) => `${(t / r.timeMs) * 300},${34 - seals * 4.5}`).join(' ') ||
    '0,34 300,34';

  // T18/T21 law, verbatim from web:87 — an endless rung rematches on the stair
  // itself, a weekly sitting returns to the writs. Everything else goes back through
  // matchmaking — EXCEPT the tutorial (M1 G10): a tutorial verdict replays the
  // lesson; it used to re-queue the child into a real calibrated Shade duel.
  const rematch = () => {
    if (ui.duelMode === 'endless') {
      ui.go('endless');
      return;
    }
    if (ui.duelMode === 'weekly') {
      ui.go('weekly');
      return;
    }
    if (ui.duelMode === 'tutorial') {
      ui.go('tutorial', { duelNonce: ui.duelNonce + 1, lastResult: null, serverDuel: null });
      return;
    }
    ui.go('matchmaking', { duelMode: ui.duelMode });
  };

  const share = () => {
    const standing =
      r.ratingDelta !== null
        ? `${i18n.result.rating} ${r.ratingDelta >= 0 ? '+' : ''}${r.ratingDelta}`
        : i18n.result.shadeTag;
    void Share.share({
      message: [
        'ASSIZE',
        banner,
        `${i18n.result.claims} ${r.claims[0]}–${r.claims[1]} · ${i18n.result.mistakes} ${r.mistakes[0]}–${r.mistakes[1]} · ${mins}:${String(secs).padStart(2, '0')}`,
        standing,
      ].join('\n'),
    });
  };

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[
        styles.content,
        { backgroundColor: theme.bg, paddingTop: insets.top + 20, paddingBottom: insets.bottom + 24 },
      ]}
    >
      {/* the engraved banner — brass for a win, oxblood for a loss or a draw (web:53-61) */}
      <View style={[styles.banner, { borderBottomColor: won ? palette.brass : palette.oxblood }]}>
        <Text
          accessibilityRole="header"
          style={[
            styles.bannerTitle,
            {
              color: won ? palette.brass : draw ? theme.fgDim : palette.oxblood,
              fontSize: fs.xxl,
              letterSpacing: 0.2 * fs.xxl,
            },
          ]}
        >
          {banner}
        </Text>
        {r.shadeDuel ? (
          <Text style={[styles.shadeTag, { color: palette.ash, fontSize: fs.xs }]}>
            {i18n.result.shadeTag}
          </Text>
        ) : null}
      </View>

      {/* the Ledger of this Duel — the five-row account (web:63-76) */}
      <View style={[styles.panel, { marginTop: 14, backgroundColor: theme.bgRaised, borderColor: theme.lineStrong }]}>
        <View style={[styles.panelInner, { borderColor: theme.line }]}>
          <Text
            accessibilityRole="header"
            style={[styles.h2, { color: theme.fg, fontSize: fs.md, letterSpacing: 0.02 * fs.md }]}
          >
            {i18n.result.ledger}
          </Text>
          <View style={styles.ledger}>
            <LedgerRow theme={theme} fs={fs} label={i18n.result.claims} value={`${r.claims[0]} – ${r.claims[1]}`} />
            <LedgerRow theme={theme} fs={fs} label={i18n.result.mistakes} value={`${r.mistakes[0]} – ${r.mistakes[1]}`} />
            <LedgerRow theme={theme} fs={fs} label={i18n.result.abilities} value={`${r.abilities[0]} – ${r.abilities[1]}`} />
            <LedgerRow theme={theme} fs={fs} label={i18n.result.time} value={`${mins}:${String(secs).padStart(2, '0')}`} />
            <LedgerRow
              theme={theme}
              fs={fs}
              label={i18n.result.rating}
              value={r.ratingDelta !== null ? `${r.ratingDelta >= 0 ? '+' : ''}${r.ratingDelta}` : '—'}
            />
          </View>
          <View accessible accessibilityLabel={i18n.result.sparkline} style={styles.spark}>
            <Svg width="100%" height={40}>
              <Polyline points={spark} fill="none" stroke={palette.brass} strokeWidth={1.5} />
            </Svg>
          </View>
        </View>
      </View>

      {/* the Clerk's Purse — the Ink earned, and the warm wax every third win (web:78-82) */}
      <View style={[styles.panel, { marginTop: 10, backgroundColor: theme.bgRaised, borderColor: theme.lineStrong }]}>
        <View style={[styles.panelInner, styles.rewards, { borderColor: theme.line }]}>
          <Text
            accessibilityRole="header"
            style={[styles.h2, { color: theme.fg, fontSize: fs.md, letterSpacing: 0.02 * fs.md }]}
          >
            {i18n.result.rewards}
          </Text>
          <View style={styles.inkRow}>
            <Text style={[styles.inkValue, { color: palette.brass, fontSize: fs.lg }]}>+{r.ink}</Text>
            <SvgUri uri={inkDropUri} width={16} height={16} />
          </View>
          {r.reliquaryWon ? (
            <Text style={[styles.reliquary, { color: palette.brass, fontSize: fs.sm }]}>
              {i18n.reliquary.title} — the wax is warm.
            </Text>
          ) : null}
        </View>
      </View>

      <View style={styles.btnRow}>
        <Btn label={i18n.result.rematch} variant="primary" theme={theme} onPress={rematch} />
        <Btn label={i18n.result.antechamber} variant="default" theme={theme} onPress={() => ui.go('antechamber')} />
        <Btn label={i18n.result.share} variant="ghost" theme={theme} onPress={share} />
      </View>
    </ScrollView>
  );
}

/** One account row of the Ledger: label left, digits right (web's dt/dd pair). */
function LedgerRow({
  label,
  value,
  theme,
  fs,
}: {
  label: string;
  value: string;
  theme: ReturnType<typeof themeFor>;
  fs: ReturnType<typeof typeScale>;
}) {
  return (
    <View style={styles.ledgerRow}>
      <Text style={[styles.ledgerLabel, { color: theme.fg, fontSize: fs.sm }]}>{label}</Text>
      <Text style={[styles.ledgerValue, { color: theme.fg, fontSize: fs.sm }]}>{value}</Text>
    </View>
  );
}

/**
 * One verdict button. The web's `.btn` / `.btn-primary` / `.btn-ghost` (global.css
 * 81-101): charcoal ground, brass frames, display face. The `:active` background
 * swap is not in the token set, so the press reads through opacity instead.
 */
function Btn({
  label,
  variant,
  theme,
  onPress,
}: {
  label: string;
  variant: 'primary' | 'default' | 'ghost';
  theme: ReturnType<typeof themeFor>;
  onPress: () => void;
}) {
  const fs = typeScale(theme.textScale);
  const frame =
    variant === 'primary'
      ? { borderColor: palette.brass, backgroundColor: theme.bgRaised }
      : variant === 'ghost'
        ? { borderColor: theme.lineStrong, backgroundColor: 'transparent' }
        : { borderColor: palette.brassDim, backgroundColor: theme.bgRaised };
  const color = variant === 'primary' ? palette.parchmentLight : theme.fg;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.btn, frame, { opacity: pressed ? 0.82 : 1 }]}
    >
      <Text style={[styles.btnText, { color, fontSize: fs.md, letterSpacing: 0.06 * fs.md }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  // top/bottom are injected inline from useSafeAreaInsets (web: safe-top+20 / 24)
  content: { flexGrow: 1, paddingHorizontal: 16 },
  banner: {
    alignItems: 'center',
    paddingTop: 26,
    paddingBottom: 26,
    paddingHorizontal: 10,
    borderBottomWidth: 2,
  },
  bannerTitle: { fontFamily: fonts.display },
  shadeTag: { fontFamily: fonts.body, marginTop: 4 },
  // web `.panel`: bg-raised ground, line-strong frame — and its ::before ring,
  // the engraved inner line: 4px inset, 1px var(--line). Outer padding 4 + inner
  // padding 10 puts the ring 4px inside the frame and the content 14px inside it,
  // exactly the web's geometry.
  panel: { borderWidth: 1, borderRadius: layout.radius, padding: 4 },
  panelInner: { borderWidth: 1, borderRadius: 2, padding: 10 },
  h2: { fontFamily: fonts.display },
  ledger: { marginTop: 8 },
  ledgerRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  ledgerLabel: { fontFamily: fonts.body },
  ledgerValue: { fontFamily: fonts.digit },
  spark: { marginTop: 8 },
  rewards: { alignItems: 'center' },
  inkRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  inkValue: { fontFamily: fonts.digit },
  reliquary: { fontFamily: fonts.body, textAlign: 'center', marginTop: 4 },
  btnRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
    paddingTop: 14,
    paddingBottom: 20,
  },
  btn: {
    minHeight: layout.touch,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderRadius: layout.radius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: { fontFamily: fonts.display },
});
