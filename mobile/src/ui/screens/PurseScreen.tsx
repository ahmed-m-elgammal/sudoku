// PurseScreen — S20 "The Clerk's Purse": explains Ink, Sigils and Reliquaries in
// 3 lines; a tap anywhere turns the page back to the Antechamber.
//
// PORT of ../src/app/game/PurseScreen.tsx (37 lines — specs/17 phase 5.5; the
// spec's "Patron's Pouch is TODO(T5)" lives in the Cabinet, already stubbed
// there). The icons ride the ledgerArt seam (the cabinetArt law — the tests
// mock the seam, the real screens render under vitest).
//
// Translation notes (the AGENTS.md platform table, nothing more):
//  - the whole page is the web's click target — one Pressable root wrapping the
//    panel, labelled with the footer's tapToContinue copy;
//  - the `page-turn` entry class is page chrome no mobile screen animates yet
//    (the ResultScreen port's standing decision, as on the Reliquary);
//  - the spec 5.5 done-when reads "balances match the save and the server" —
//    this screen carries the EXPLAINER copy only, exactly like the web: the
//    balances themselves are read live where the web reads them (the
//    Antechamber/Cabinet headers off the save; the Great Ledger's T13 line off
//    the server), and both are pinned by their own gates.
//
// REPORTED DEFECT (web build, inherited — report, do not fix): nothing in the
// web build ever routes to 'purse' — no go('purse') exists anywhere in src/ or
// its history, so the Clerk's Purse is rendered by GameShell yet unreachable in
// the flow. The port wires it exactly the same (the Reliquary precedent).
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Art from '@/ui/Art';
import { useUi } from '@/state/ui';
import { audio } from '@/platform/audio';
import { useDisplaySettings } from '@/platform/display';
import { fonts, layout, palette, themeFor, type as typeScale } from '@/theme/tokens';
import { i18n } from '@/i18n';
import { purseArt } from './ledgerArt';

const EXPLAINER: { icon: 'inkDrop' | 'sigilCoin' | 'chestClosed'; copy: string }[] = [
  { icon: 'inkDrop', copy: i18n.purse.ink },
  { icon: 'sigilCoin', copy: i18n.purse.sigils },
  { icon: 'chestClosed', copy: i18n.purse.reliquary },
];

export default function PurseScreen() {
  const go = useUi((s) => s.go);
  const display = useDisplaySettings();
  const theme = useMemo(
    () => themeFor({ contrast: display.contrast, text: display.text }),
    [display.contrast, display.text],
  );
  const fs = typeScale(theme.textScale);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={i18n.common.tapToContinue}
      onPress={() => { audio.uiTap(); go('antechamber'); }}
      style={[styles.root, { backgroundColor: palette.inkBlack }]}
    >
      {/* web div.panel: maxWidth 360, padding 24, textAlign center */}
      <View style={[styles.panel, { backgroundColor: theme.bgRaised, borderColor: theme.lineStrong }]}>
        <View style={[styles.ring, { borderColor: theme.line }]} pointerEvents="none" />
        <Text accessibilityRole="header" style={[styles.title, { color: theme.fg, fontSize: fs.lg, letterSpacing: 0.02 * fs.lg }]}>
          {i18n.purse.title}
        </Text>
        {/* web div: grid gap 14, margin '18px 0', textAlign left */}
        <View style={styles.rows}>
          {EXPLAINER.map((row) => (
            // web p: flex, gap 10, center
            <View key={row.icon} style={styles.row}>
              <Art uri={purseArt(row.icon)} width={26} height={26} />
              <Text style={[styles.rowText, { color: theme.fg, fontSize: fs.md }]}>{row.copy}</Text>
            </View>
          ))}
        </View>
        <Text style={[styles.footer, { color: theme.lineStrong, fontSize: fs.xs }]}>
          {i18n.common.tapToContinue}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // web main: min-height 100dvh, grid placeItems center, padding 24
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  // web div.panel: maxWidth 360, padding 24, textAlign center
  panel: {
    width: '100%',
    maxWidth: 360,
    padding: 24,
    borderWidth: 1,
    borderRadius: layout.radius,
    alignItems: 'center',
  },
  // web .panel::before: absolute inset 4, 1px var(--line), radius 2
  ring: { position: 'absolute', top: 4, left: 4, right: 4, bottom: 4, borderWidth: 1, borderRadius: 2 },
  title: { fontFamily: fonts.display, textAlign: 'center' },
  rows: { alignSelf: 'stretch', gap: 14, marginVertical: 18 },
  row: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  rowText: { fontFamily: fonts.body, flex: 1 },
  // web p: color var(--line-strong), fs-xs
  footer: { fontFamily: fonts.body },
});
