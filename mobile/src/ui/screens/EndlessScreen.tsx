// EndlessScreen (T18) — the Endless Assize: the current rung, the best ever
// cleared, the foe waiting on this rung (deterministically derived from the
// save's salt) and the next-three queue. Ascend → duelMode 'endless' with the
// rung; DuelScreen.finish applies the ladder law (endlessOnWin/OnLoss — best
// never decreases) and mints the rung-scaled Ink bonus.
//
// PORT of ../src/app/game/EndlessScreen.tsx (83 lines). `@shared/endless` is the
// law — the foe/queue derivation is consumed verbatim (spec 4.3), memoised per
// save exactly like the web's useMemo. No Ribbon here — the web screen ends in
// a back panel-card, and so does this. `.page-turn` skipped (the shell-chrome
// law).
//
// Translation notes (the AGENTS.md platform table, nothing more):
//  - the rung/best figures are the web's `.digits` spans whose INLINE
//    fontFamily display wins over the class (CSS specificity: inline > class) —
//    so they ride fonts.display here, not the digit face.
//  - `· ${i18n.endless.bossBadge}` composes only when foe.bossRung is truthy,
//    verbatim; queue names join ' · ' (EndlessScreen.tsx:57).
//  - '→' on Ascend and '←' on back are the web buttons' own literals.
//  - the back button is a `.panel.card` Pressable with the engraved ring.
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUi } from '@/state/ui';
import { useSave } from '@/state/save';
import { audio } from '@/platform/audio';
import { useDisplaySettings } from '@/platform/display';
import { fonts, layout, palette, themeFor, type as typeScale } from '@/theme/tokens';
import { i18n } from '@/i18n';
import { endlessFoe } from '@shared/endless';

export default function EndlessScreen() {
  const go = useUi((s) => s.go);
  const save = useSave((s) => s.save);
  const display = useDisplaySettings();
  const theme = useMemo(
    () => themeFor({ contrast: display.contrast, text: display.text }),
    [display.contrast, display.text],
  );
  const insets = useSafeAreaInsets();
  const fs = typeScale(theme.textScale);
  const ladder = save?.endless;
  const current = ladder?.current;
  const salt = ladder?.salt;

  // the rung ladder is pure derivation — memo it per save (no clock reads here);
  // the deps are the two properties the derivation reads (the React Compiler
  // rejects object-identity deps it cannot verify — primitives preserve it)
  const { foe, queue } = useMemo(() => {
    if (current === undefined || salt === undefined) {
      return { foe: null, queue: [] as ReturnType<typeof endlessFoe>[] };
    }
    const f = endlessFoe(current, salt);
    const q = [1, 2, 3].map((k) => endlessFoe(current + k, salt));
    return { foe: f, queue: q };
  }, [current, salt]);

  if (!save || !ladder || !foe) return null;
  const rungNo = ladder.current + 1;

  return (
    <View style={[styles.root, { backgroundColor: theme.bg }]}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 18, paddingBottom: insets.bottom + 24 }]}>
        <Text
          accessibilityRole="header"
          style={[styles.title, { color: theme.fg, fontSize: fs.lg, letterSpacing: 0.02 * fs.lg }]}
        >
          {i18n.endless.title}
        </Text>
        <Text style={[styles.sub, { color: theme.fgDim, fontSize: fs.sm }]}>{i18n.endless.sub}</Text>

        <View style={styles.column}>
          {/* rung + best — web .panel.card, flex row baseline, gap 18 */}
          <View style={[styles.panel, styles.ladder, { backgroundColor: theme.bgRaised, borderColor: theme.lineStrong }]}>
            <View style={[styles.ring, { borderColor: theme.line }]} pointerEvents="none" />
            <View>
              <Text style={[styles.dim, { color: theme.fgDim, fontSize: fs.xs }]}>{i18n.endless.rungLabel}</Text>
              <Text style={[styles.figure, { color: palette.brass, fontSize: fs.xxl }]}>{rungNo}</Text>
            </View>
            <View>
              <Text style={[styles.dim, { color: theme.fgDim, fontSize: fs.xs }]}>{i18n.endless.bestLabel}</Text>
              <Text style={[styles.figure, { color: theme.fg, fontSize: fs.xxl }]}>{ladder.best}</Text>
            </View>
          </View>

          {/* the waiting foe + queue — web .panel.card */}
          <View style={[styles.panel, { backgroundColor: theme.bgRaised, borderColor: theme.lineStrong }]}>
            <View style={[styles.ring, { borderColor: theme.line }]} pointerEvents="none" />
            <Text style={[styles.dim, { color: theme.fgDim, fontSize: fs.xs }]}>{i18n.endless.nextLabel}</Text>
            <Text style={[styles.foeName, { color: theme.fg, fontSize: fs.md, marginTop: 4, letterSpacing: 0.02 * fs.md }]}>
              {foe.name}
            </Text>
            <Text style={[styles.dim, { color: theme.fgDim, fontSize: fs.xs, marginTop: 4 }]}>
              {foe.tier} · {foe.seals[1]} {i18n.endless.seals}
              {foe.bossRung ? ` · ${i18n.endless.bossBadge}` : ''}
            </Text>
            <Text style={[styles.dim, { color: theme.fgDim, fontSize: fs.xs, marginTop: 6 }]}>
              {i18n.endless.queueLabel} {queue.map((q) => q.name).join(' · ')}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={i18n.endless.ascend}
              onPress={() => {
                audio.uiTap();
                go('duel', { duelMode: 'endless', endlessRung: ladder.current, campaignDuel: null, pendingEcho: null, pendingPersonalShade: null });
              }}
              style={({ pressed }) => [
                styles.primary,
                { backgroundColor: theme.bgRaised, opacity: pressed ? 0.82 : 1 },
              ]}
            >
              <Text style={[styles.btnText, { color: palette.parchmentLight, fontSize: fs.md, letterSpacing: 0.06 * fs.md }]}>
                {i18n.endless.ascend} →
              </Text>
            </Pressable>
          </View>

          <Text style={[styles.dim, { color: theme.fgDim, fontSize: fs.xs }]}>{i18n.endless.law}</Text>
        </View>

        {/* the back panel-card — web button.panel.card, marginTop 16, centered */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={i18n.endless.back}
          onPress={() => {
            audio.uiTap();
            go('antechamber');
          }}
          style={({ pressed }) => [
            styles.panel,
            styles.back,
            { backgroundColor: theme.bgRaised, borderColor: theme.lineStrong, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <View style={[styles.ring, { borderColor: theme.line }]} pointerEvents="none" />
          <Text style={[styles.backText, { color: theme.fgDim, fontSize: fs.md }]}>{'←'} {i18n.endless.back}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  // web main.page-turn: padding 'calc(var(--safe-top) + 18px) 16px calc(var(--safe-bottom) + 24px)'
  scroll: { paddingHorizontal: 16 },
  // web h1 fontFamily display, fontSize var(--fs-lg)
  title: { fontFamily: fonts.display, marginBottom: 8 },
  // web p: fs-sm, maxWidth 520, marginBottom 14
  sub: { fontFamily: fonts.body, maxWidth: 520, marginBottom: 14 },
  // web div grid gap 10, maxWidth 560 — centred on wide screens, full width on phones
  column: { gap: 10, width: '100%', maxWidth: 560, alignSelf: 'center' },
  // web .panel.card: padding '14px 16px' — plus the ::before engraved ring
  panel: { borderWidth: 1, borderRadius: 4, paddingVertical: 14, paddingHorizontal: 16 },
  ring: { position: 'absolute', top: 4, left: 4, right: 4, bottom: 4, borderWidth: 1, borderRadius: 2 },
  // web ladder panel: display flex, gap 18, alignItems baseline
  ladder: { flexDirection: 'row', gap: 18, alignItems: 'baseline' },
  dim: { fontFamily: fonts.body },
  // the .digits span whose inline fontFamily display wins over the class
  figure: { fontFamily: fonts.display },
  foeName: { fontFamily: fonts.display },
  // web .btn.btn-primary: marginTop 12, width 100%, minHeight 44
  primary: {
    minHeight: layout.touch,
    marginTop: 12,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderColor: palette.brass,
    borderRadius: layout.radius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: { fontFamily: fonts.display }, // 0.06em rides inline
  // web back button: marginTop 16, maxWidth 560, width 100%, textAlign center
  back: { marginTop: 16, width: '100%', maxWidth: 560, alignItems: 'center', justifyContent: 'center' },
  backText: { fontFamily: fonts.body },
});
