// PrologueCards.tsx — M2 phase t0 (docs/TUTORIAL_OPTIMIZATION_PLAN.md §5.2 T0, §6.2).
//
// The story.json prologue shipped but was NEVER rendered on either platform (the plan's
// §3.2.8 "dead story content"). T0 finally renders two of its lines VERBATIM — this is
// presentation of existing canon, not a story change (§11.3.2) — each under one plain
// sentence from the i18n dictionary (the §11 plain-first law: the canon line stays
// untouched; the plain line carries the meaning).
//
// Full-screen blocking overlay inside the duel room: one card at a time, a tap
// anywhere advances, the second card fires onDone (the director's prologueDone gate).
// No animation to kill: the cards are static parchment, so the reduced-motion law
// needs no guard here.
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { i18n, storyJson } from '@/i18n';
import { fonts, layout, type Theme } from '@/theme/tokens';

export interface PrologueCardsProps {
  theme: Theme;
  onDone: () => void;
}

/** The two canon lines T0 renders (verbatim from story.json.prologue). */
const CARD_LINES = [storyJson.prologue[2], storyJson.prologue[3]] as const;

export default function PrologueCards({ theme, onDone }: PrologueCardsProps) {
  const [idx, setIdx] = useState(0);
  const last = idx === CARD_LINES.length - 1;
  const copy = [
    {
      title: i18n.tutorialV2.prologue1Title,
      plain: i18n.tutorialV2.prologue1Plain,
    },
    {
      title: i18n.tutorialV2.prologue2Title,
      plain: i18n.tutorialV2.prologue2Plain,
    },
  ][idx];

  const advance = () => {
    if (last) onDone();
    else setIdx(idx + 1);
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={i18n.tutorialV2.prologueTap}
      onPress={advance}
      style={[styles.fill, { backgroundColor: theme.bg }]}
    >
      <View style={[styles.card, { borderColor: theme.lineStrong, backgroundColor: theme.bgRaised }]}>
        <Text style={[styles.title, { color: theme.fgBright }]}>{copy.title}</Text>
        <Text style={[styles.plain, { color: theme.fg }]}>{copy.plain}</Text>
        <Text style={[styles.canon, { color: theme.fgDim }]}>{CARD_LINES[idx]}</Text>
        <Text style={[styles.tap, { color: theme.focus }]}>{i18n.tutorialV2.prologueTap}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', padding: layout.gutter },
  card: {
    borderWidth: 1,
    borderRadius: layout.radiusLg,
    padding: layout.gutter,
    gap: 12,
  },
  title: { fontFamily: fonts.display, fontSize: 22, letterSpacing: 0.5 },
  plain: { fontFamily: fonts.body, fontSize: 16, lineHeight: 22 },
  canon: { fontFamily: fonts.bodyItalic, fontSize: 14, lineHeight: 20 },
  tap: { fontFamily: fonts.display, fontSize: 13, letterSpacing: 1, alignSelf: 'flex-end' },
});
