// StoryCard — S13: full-screen engraved plate, caption revealed line by line, tap to
// advance, Skip.
//
// PORT of ../src/app/game/StoryCard.tsx. The beat arrives as data in ui.story (its
// producers are DuelScreen.finish for the interludes/reveal and EndingChoice for the
// endings); the successor screen lives INSIDE the payload (`story.then` + optional
// campaignIndex), so advancing is one atomic go() — the spec's 3.1 law.
//
// Translation notes (the AGENTS.md platform table, nothing more):
//  - the web does its missing-story redirect during render (web:12). A store write
//    during render is a defect under React Native's runtime, so the effect below
//    performs the same `go('antechamber')` one frame later — same outcome.
//  - the `.page-turn` entry animation is shell-wide page chrome, not screen content
//    (the same decision the DuelScreen and ResultScreen ports made); no mobile
//    screen animates its own entry.
//  - the web grid `auto 1fr auto` becomes a flex column: skip row (auto), plate area
//    (flex 1) whose image fills it up to the web's `max-height: 52vh` cap
//    (`object-fit: cover` -> resizeMode cover), captions (auto) at the bottom.
//  - `imageForPath` maps the payload's web asset path onto the bundled file; an
//    unmapped path degrades to the hairline frame — never a crash.
//  - the Skip row's coarse-pointer guard (`@media (pointer: coarse)`: min 44) is the
//    layout.touch target; the nested Pressable is the web's stopPropagation.
import { useEffect, useMemo, useState } from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUi } from '@/state/ui';
import { audio } from '@/platform/audio';
import { useDisplaySettings } from '@/platform/display';
import { fonts, layout, palette, themeFor, type as typeScale } from '@/theme/tokens';
import { i18n } from '@/i18n';
import { imageForPath } from '@/theme/assets';

export default function StoryCard() {
  const story = useUi((s) => s.story);
  const go = useUi((s) => s.go);
  const [line, setLine] = useState(0);
  const display = useDisplaySettings();
  const theme = useMemo(
    () => themeFor({ contrast: display.contrast, text: display.text }),
    [display.contrast, display.text],
  );
  const insets = useSafeAreaInsets();
  const fs = typeScale(theme.textScale);
  const { height: winH } = useWindowDimensions();

  // web:12 — the same redirect, one frame later (no store writes during render).
  useEffect(() => {
    if (!story) go('antechamber');
  }, [story, go]);

  if (!story) return null;

  // The successor is inside the payload — one atomic go() from every exit path.
  const advanceToThen = () =>
    go(story.then, story.campaignIndex ? { campaignDuel: story.campaignIndex } : undefined);

  const advance = () => {
    audio.pageTurn(); // web:15 synth.pageTurn() per reveal; go() adds its own on the last
    if (line < story.lines.length - 1) setLine(line + 1);
    else advanceToThen();
  };

  // web:43 maxHeight '52vh'
  const plateMax = Math.round(winH * 0.52);
  const plateSource = imageForPath(story.plate);

  return (
    <Pressable
      onPress={advance}
      style={[
        styles.root,
        {
          backgroundColor: palette.inkBlack,
          paddingTop: insets.top + 10,
          paddingHorizontal: 18,
          paddingBottom: insets.bottom + 18,
        },
      ]}
    >
      <View style={styles.skipRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={i18n.common.skip}
          onPress={advanceToThen}
          style={styles.skip}
        >
          <Text style={[styles.skipText, { color: theme.fgDim, fontSize: fs.sm }]}>
            {i18n.common.skip}
          </Text>
        </Pressable>
      </View>

      <View style={styles.plateArea}>
        {plateSource ? (
          <Image
            source={plateSource}
            resizeMode="cover"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={[styles.plate, { borderColor: theme.lineStrong, maxHeight: plateMax }]}
          />
        ) : (
          <View style={[styles.plateEmpty, { borderColor: theme.lineStrong, maxHeight: plateMax }]} />
        )}
      </View>

      <View style={styles.captionBlock}>
        {story.lines.slice(0, line + 1).map((l, i) => (
          <Text key={i} style={[styles.line, { color: theme.fg, fontSize: fs.md }]}>
            {l}
          </Text>
        ))}
        <Text style={[styles.hint, { color: theme.lineStrong, fontSize: fs.xs }]}>
          {i18n.common.tapToContinue}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // web minHeight '100dvh' + padding 'calc(var(--safe-top) + 10px) 18px
  // calc(var(--safe-bottom) + 18px)' — the safe-area terms ride the insets inline.
  root: { flex: 1 },
  skipRow: { flexDirection: 'row', justifyContent: 'flex-end' },
  skip: {
    minHeight: layout.touch,
    paddingHorizontal: 8,
    justifyContent: 'center',
  },
  skipText: { fontFamily: fonts.body, textDecorationLine: 'underline' },
  plateArea: { flex: 1 },
  plate: { width: '100%', flex: 1, borderWidth: 1 },
  plateEmpty: { width: '100%', flex: 1, borderWidth: 1 },
  // web padding '18px 4px', textAlign center
  captionBlock: { paddingVertical: 18, paddingHorizontal: 4, alignItems: 'center' },
  // web fontStyle italic, margin '6px 0'
  line: { fontFamily: fonts.bodyItalic, marginVertical: 6, textAlign: 'center' },
  hint: { fontFamily: fonts.body, marginTop: 12, textAlign: 'center' },
});
