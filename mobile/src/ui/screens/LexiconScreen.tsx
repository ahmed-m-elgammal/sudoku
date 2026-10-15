// LexiconScreen — P2.5: the Clerk's Lexicon as a reading screen
// (docs/STORY_HOLD_PLAN.md P2.5).
//
// Reached from Settings ("Lexicon"); the duel pause sheet paints the same
// LexiconBody as an overlay instead (nav would destroy the live runtime).
// Read-only, Ribbon-navigated, deliberately NOT in DEAD_ENDS.
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSave } from '@/state/save';
import { useDisplaySettings } from '@/platform/display';
import { fonts, themeFor, type as typeScale } from '@/theme/tokens';
import { i18n } from '@/i18n';
import Ribbon from '@/ui/Ribbon';
import LexiconBody from './LexiconBody';

export default function LexiconScreen() {
  const save = useSave((s) => s.save);
  const display = useDisplaySettings();
  const theme = useMemo(
    () => themeFor({ contrast: display.contrast, text: display.text }),
    [display.contrast, display.text],
  );
  const insets = useSafeAreaInsets();
  const fs = typeScale(theme.textScale);

  if (!save) return null;

  return (
    <View style={[styles.root, { backgroundColor: theme.bg }]}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 14 }]}>
        <View style={styles.header}>
          <Text accessibilityRole="header" style={[styles.title, { color: theme.fg, fontSize: fs.xl }]}>
            {i18n.duel.lexicon.title}
          </Text>
          <Text style={[styles.sub, { color: theme.fgDim, fontSize: fs.sm }]}>
            {i18n.duel.lexicon.sub}
          </Text>
        </View>
        <View style={styles.body}>
          <LexiconBody theme={theme} fs={fs} />
        </View>
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
  body: { paddingHorizontal: 16 },
});
