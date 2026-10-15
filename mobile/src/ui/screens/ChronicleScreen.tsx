// ChronicleScreen — P2.4: the re-readable Ledger of what happened
// (docs/STORY_HOLD_PLAN.md P2.4).
//
// A reading screen over save.campaign.chronicleSeen: every reached beat shows
// its title, its canon lines verbatim, and its plate thumbnail; unreached
// beats render as locked rows (spoiler-guarded labels + "—"), so the list
// doubles as a progress map of the story, not the grind. Read-only: no taps
// here write anything. Back-nav may land here (not in DEAD_ENDS).
import { useMemo } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSave } from '@/state/save';
import { useDisplaySettings } from '@/platform/display';
import { fonts, layout, themeFor, type as typeScale } from '@/theme/tokens';
import { i18n } from '@/i18n';
import { imageForPath } from '@/theme/assets';
import Ribbon from '@/ui/Ribbon';
import {
  CHRONICLE_ORDER, chronicleBeat, chronicleLockedLabel, isChronicleSeen,
} from './chronicleLaw';

export default function ChronicleScreen() {
  const save = useSave((s) => s.save);
  const display = useDisplaySettings();
  const theme = useMemo(
    () => themeFor({ contrast: display.contrast, text: display.text }),
    [display.contrast, display.text],
  );
  const insets = useSafeAreaInsets();
  const fs = typeScale(theme.textScale);

  if (!save) return null;
  const seen = save.campaign.chronicleSeen ?? [];

  return (
    <View style={[styles.root, { backgroundColor: theme.bg }]}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 14 }]}>
        <View style={styles.header}>
          <Text accessibilityRole="header" style={[styles.title, { color: theme.fg, fontSize: fs.xl }]}>
            {i18n.duel.chronicle.title}
          </Text>
          <Text style={[styles.sub, { color: theme.fgDim, fontSize: fs.sm }]}>
            {i18n.duel.chronicle.sub}
          </Text>
        </View>

        {CHRONICLE_ORDER.map((id) => {
          const beat = chronicleBeat(id);
          if (!beat) return null;
          const unlocked = isChronicleSeen(seen, id);
          if (!unlocked) {
            return (
              <View
                key={id}
                style={[styles.row, styles.locked, { borderColor: theme.lineStrong, backgroundColor: theme.bgSunken }]}
              >
                <Text style={[styles.lockedText, { color: theme.fgDim, fontSize: fs.md }]}>
                  {chronicleLockedLabel(id)} —
                </Text>
              </View>
            );
          }
          const plate = beat.plate ? imageForPath(beat.plate) : null;
          return (
            <View key={id} style={[styles.row, { borderColor: theme.lineStrong, backgroundColor: theme.bgRaised }]}>
              <View style={[styles.panelRing, { borderColor: theme.line }]} pointerEvents="none" />
              {plate ? (
                <Image
                  source={plate}
                  resizeMode="cover"
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                  style={[styles.plate, { borderColor: theme.lineStrong }]}
                />
              ) : null}
              <Text accessibilityRole="header" style={[styles.beatTitle, { color: theme.fg, fontSize: fs.md }]}>
                {beat.title}
              </Text>
              {beat.sub ? (
                <Text style={[styles.beatSub, { color: theme.fgDim, fontSize: fs.sm }]}>{beat.sub}</Text>
              ) : null}
              {beat.lines.map((l, i) => (
                <Text key={i} style={[styles.line, { color: theme.fg, fontSize: fs.sm }]}>{l}</Text>
              ))}
            </View>
          );
        })}
      </ScrollView>
      <Ribbon />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingBottom: 16 },
  header: { alignItems: 'center', paddingHorizontal: 16, paddingBottom: 6 },
  title: { fontFamily: fonts.display },
  sub: { fontFamily: fonts.bodyItalic, textAlign: 'center', marginTop: 2 },
  // the engraved panel law (FolioDetail/ResultScreen): frame + 4px inset ring
  row: { marginHorizontal: 16, marginTop: 10, padding: 12, borderWidth: 1, borderRadius: layout.radius },
  panelRing: { position: 'absolute', top: 4, left: 4, right: 4, bottom: 4, borderWidth: 1, borderRadius: 2 },
  locked: { opacity: 0.6, paddingVertical: 12 },
  lockedText: { fontFamily: fonts.body, textAlign: 'center' },
  plate: { width: '100%', height: 120, borderWidth: 1, borderRadius: 3, marginBottom: 8 },
  beatTitle: { fontFamily: fonts.display },
  beatSub: { fontFamily: fonts.bodyItalic, marginTop: 2 },
  // StoryCard caption law: centered italic lines
  line: { fontFamily: fonts.bodyItalic, marginTop: 6, textAlign: 'center' },
});
