// WeeklyScreen (T21) — the Weekly Assize: the week's two named writs, the fixed
// presiding Shade wearing a real Magistrate arc, the Monday-turnover countdown,
// and the single-completion seal. Sit → duelMode 'weekly' (DuelScreen.finish
// mints the first-win Ink bonus and writes save.weekly.lastWeek).
//
// PORT of ../src/app/game/WeeklyScreen.tsx (87 lines). `@shared/weekly` is the
// law — the writs, the foe and the turnover are consumed, never re-derived
// (spec 4.2). The web's `useMemo(..., [])` wall-clock read moves behind the
// render-purity seam as lazy state initialisers — the screen mounts fresh per
// visit (the web's own comment: the week cannot turn mid-mount), so both are
// equally fresh. No Ribbon here — the web screen ends in a back panel-card, and
// so does this. `.page-turn` skipped (the shell-chrome law).
//
// Translation notes (the AGENTS.md platform table, nothing more):
//  - the two trailing copy lines and the '·' joiners are the web's inline JSX,
//    composed with the same tf() substitutions ({days}/{hours}, {ink}).
//  - the back button is a `.panel.card` Pressable — bg-raised, 1px line-strong,
//    the engraved ::before ring, '←' carried verbatim (WeeklyScreen.tsx:83).
//  - '→' on Sit is the web button's own literal (WeeklyScreen.tsx:64).
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUi } from '@/state/ui';
import { useSave } from '@/state/save';
import { audio } from '@/platform/audio';
import { useDisplaySettings } from '@/platform/display';
import { fonts, layout, palette, themeFor, type as typeScale } from '@/theme/tokens';
import { i18n, tf } from '@/i18n';
import { weekEndsAtMs, weeklyForWeek, weeklyInkBonus, weeklyModDefs, weekIndexFor } from '@shared/weekly';

export default function WeeklyScreen() {
  const go = useUi((s) => s.go);
  const save = useSave((s) => s.save);
  const display = useDisplaySettings();
  const theme = useMemo(
    () => themeFor({ contrast: display.contrast, text: display.text }),
    [display.contrast, display.text],
  );
  const insets = useSafeAreaInsets();
  const fs = typeScale(theme.textScale);
  // the web's useMemo-per-mount wall-clock reads, behind the render-purity seam
  const [{ week, foe, writs }] = useState(() => {
    const w = weekIndexFor(Date.now());
    return { week: w, foe: weeklyForWeek(w), writs: weeklyModDefs(w) };
  });
  const [clock] = useState(() => {
    const msLeft = Math.max(0, weekEndsAtMs(week) - Date.now());
    return {
      days: Math.floor(msLeft / 86_400_000),
      hours: Math.floor((msLeft % 86_400_000) / 3_600_000),
    };
  });

  if (!save) return null;
  const sat = save.weekly?.lastWeek === week;

  return (
    <View style={[styles.root, { backgroundColor: theme.bg }]}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 18, paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.column}>
          <Text
            accessibilityRole="header"
            style={[styles.title, { color: theme.fg, fontSize: fs.lg, letterSpacing: 0.02 * fs.lg }]}
          >
            {i18n.weekly.title}
          </Text>
          <Text style={[styles.sub, { color: theme.fgDim, fontSize: fs.sm }]}>{i18n.weekly.sub}</Text>

          {/* the week's two writs — web .panel.card, padding '14px 16px' */}
          <View style={[styles.panel, { backgroundColor: theme.bgRaised, borderColor: theme.lineStrong }]}>
            <View style={[styles.ring, { borderColor: theme.line }]} pointerEvents="none" />
            <Text style={[styles.dim, { color: theme.fgDim, fontSize: fs.xs }]}>{i18n.weekly.writsLabel}</Text>
            {writs.map((m) => (
              <View key={m.id} style={styles.writ}>
                <Text style={[styles.writName, { color: palette.brass, fontSize: fs.md, letterSpacing: 0.02 * fs.md }]}>
                  {m.name}
                </Text>
                <Text style={[styles.dim, { color: theme.fgDim, fontSize: fs.xs }]}>{m.blurb}</Text>
              </View>
            ))}
          </View>

          {/* the presiding Shade — web .panel.card */}
          <View style={[styles.panel, { backgroundColor: theme.bgRaised, borderColor: theme.lineStrong }]}>
            <View style={[styles.ring, { borderColor: theme.line }]} pointerEvents="none" />
            <Text style={[styles.dim, { color: theme.fgDim, fontSize: fs.xs }]}>{i18n.weekly.foeLabel}</Text>
            <Text style={[styles.foeName, { color: theme.fg, fontSize: fs.md, marginTop: 4, letterSpacing: 0.02 * fs.md }]}>
              {foe.name}
            </Text>
            <Text style={[styles.dim, { color: theme.fgDim, fontSize: fs.xs, marginTop: 4 }]}>
              {i18n.weekly.tierLabel} {foe.tier} · {foe.seals[1]} {i18n.weekly.sealsLabel} · {foe.bossRung} ({i18n.weekly.arcBadge})
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={i18n.weekly.sit}
              onPress={() => {
                audio.uiTap();
                go('duel', { duelMode: 'weekly', campaignDuel: null, endlessRung: null, pendingEcho: null, pendingPersonalShade: null });
              }}
              style={({ pressed }) => [
                styles.primary,
                { backgroundColor: theme.bgRaised, opacity: pressed ? 0.82 : 1 },
              ]}
            >
              <Text style={[styles.btnText, { color: palette.parchmentLight, fontSize: fs.md, letterSpacing: 0.06 * fs.md }]}>
                {i18n.weekly.sit} →
              </Text>
            </Pressable>
          </View>

          <Text style={[styles.dim, { color: sat ? palette.brass : theme.fgDim, fontSize: fs.xs }]}>
            {sat ? i18n.weekly.satLine : i18n.weekly.openLine}
          </Text>
          <Text style={[styles.dim, { color: theme.fgDim, fontSize: fs.xs }]}>
            {tf('weekly.endsLabel', { days: clock.days, hours: clock.hours })}
            {' · '}
            {tf('weekly.law', { ink: weeklyInkBonus })}
          </Text>
        </View>

        {/* the back panel-card — web button.panel.card, marginTop 16, centered */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={i18n.weekly.back}
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
          <Text style={[styles.backText, { color: theme.fgDim, fontSize: fs.md }]}>{'←'} {i18n.weekly.back}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  // web main.page-turn: padding 'calc(var(--safe-top) + 18px) 16px calc(var(--safe-bottom) + 24px)'
  scroll: { paddingHorizontal: 16 },
  // web div grid gap 10, maxWidth 560 — centred on wide screens, full width on phones
  column: { gap: 10, width: '100%', maxWidth: 560, alignSelf: 'center' },
  // web h1 inside a header wrapper with marginBottom 8 (display face, fs-lg)
  title: { fontFamily: fonts.display, marginBottom: 8 },
  // web p: fs-sm, maxWidth 520, marginBottom 14
  sub: { fontFamily: fonts.body, maxWidth: 520, marginBottom: 14 },
  // web .panel.card: padding '14px 16px' — plus the ::before engraved ring
  panel: { borderWidth: 1, borderRadius: 4, paddingVertical: 14, paddingHorizontal: 16 },
  ring: { position: 'absolute', top: 4, left: 4, right: 4, bottom: 4, borderWidth: 1, borderRadius: 2 },
  dim: { fontFamily: fonts.body },
  // web .writ wrapper: marginTop 8
  writ: { marginTop: 8 },
  // web h3: display face, brass
  writName: { fontFamily: fonts.display },
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
