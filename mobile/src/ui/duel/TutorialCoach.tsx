// TutorialCoach.tsx — the tutorial's margin note, docked in the layout flow.
//
// M1 hotfix (docs/TUTORIAL_OPTIMIZATION_PLAN.md G1/G3/G4):
//
//  · G3 — the note used to be an absolute overlay clamped 238–318 px above the
//    bottom edge (zIndex 10, pointerEvents "none"), which painted it OVER the
//    board's lower rows on every phone — dead centre in landscape — while taps
//    fell "through" the text onto invisible target cells. It is now a flow child:
//    below the board / above the toolbar in portrait, a full-width strip under the
//    room in landscape (the landscape controls column has no spare height). It can
//    never cover a cell again.
//
//  · G4 — the skip chip used to sit absolutely at top-right, overlapping the HUD's
//    right cluster (the Shade's Seal pips), so mis-taps quit the tutorial. It is
//    now a quiet button in the banner row.
//
//  · G1 — the free Augur is granted only after the augur note has been readable
//    for 2.5 s. The old screen effect granted on the note's FIRST frame, which
//    flipped the note to 'end' before it could be read. The first Augur-tile tap
//    grants sooner — that path lives in LocalDuel.ability().
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import type { DuelRuntime } from '@/game/duelRuntime';
import { i18n } from '@/i18n';
import { fonts, layout, type Theme } from '@/theme/tokens';

/** How long the augur note must be readable before the free rite lands (G1). */
const AUGUR_NOTE_MIN_VISIBLE_MS = 2500;

export interface TutorialCoachProps {
  duel: DuelRuntime;
  /** the latched note id from `duel.tutorialNote()` */
  note: string;
  theme: Theme;
  onSkip: () => void;
  /** the landscape dock adds its own insets/margins under the room */
  style?: StyleProp<ViewStyle>;
}

export default function TutorialCoach({ duel, note, theme, onSkip, style }: TutorialCoachProps) {
  // G1 — hold the augur note on screen for its minimum read time, THEN grant.
  // The grant flips the note to 'end', so the timer only runs while 'augur' is up;
  // the cleanup withdraws it if the player taps the Augur tile first (the runtime
  // grants idempotently, so a late fire is harmless either way).
  useEffect(() => {
    if (note !== 'augur' || duel.freeAugurGranted) return;
    const t = setTimeout(() => duel.grantFreeAugur(), AUGUR_NOTE_MIN_VISIBLE_MS);
    return () => clearTimeout(t);
  }, [note, duel]);

  const copy = i18n.tutorial.notes[note as keyof typeof i18n.tutorial.notes];

  return (
    <View style={[styles.row, { backgroundColor: theme.fg, borderColor: theme.bg }, style]}>
      <Text style={[styles.note, { color: theme.bg }]} numberOfLines={2}>
        {copy}
      </Text>
      <Pressable
        onPress={onSkip}
        accessibilityRole="button"
        accessibilityLabel={i18n.tutorial.skip}
        style={[styles.skip, { borderColor: theme.bg }]}
      >
        <Text style={[styles.skipText, { color: theme.bg }]}>{i18n.tutorial.skip}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: layout.touch + 4,
    borderWidth: 1,
    borderRadius: layout.radius,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 4,
  },
  note: { flex: 1, fontFamily: fonts.body, fontSize: 13, lineHeight: 17 },
  skip: {
    paddingHorizontal: 8,
    minHeight: layout.touch,
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: layout.radius,
  },
  skipText: { fontFamily: fonts.display, fontSize: 11, textDecorationLine: 'underline' },
});
