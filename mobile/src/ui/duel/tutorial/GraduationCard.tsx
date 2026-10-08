// GraduationCard.tsx — M2 phase t10 (docs/TUTORIAL_OPTIMIZATION_PLAN.md §5.2 T10, §6.2).
//
// The tutorial's verdict card. It finally renders the story.json tutorial lines the
// game shipped but never showed (§3.2.8) — VERBATIM canon, presented, not rewritten
// (§11.3.2) — over a rewards summary. The graduation LAW (the once-per-save +100 Ink,
// the reliquary candle) stays in the runtime economy layer (tutorialGraduation.ts);
// this card only speaks, and its rewards line is honest about which graduation this
// is: the first (paid) or a replay (already recorded).
//
// A blocking verdict overlay over a finished duel — the room behind it is dead ink.
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { i18n, storyJson } from '@/i18n';
import { fonts, layout, type Theme } from '@/theme/tokens';

export interface GraduationCardProps {
  theme: Theme;
  /** true when this duel is the save's first graduation (the +100 Ink is paid now) */
  first: boolean;
  onContinue: () => void;
}

export default function GraduationCard({ theme, first, onContinue }: GraduationCardProps) {
  return (
    <Modal transparent animationType="none" visible onRequestClose={onContinue}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={i18n.tutorialV2.gradContinue}
        onPress={onContinue}
        style={[styles.fill, { backgroundColor: theme.modalScrim }]}
      >
        <View style={[styles.card, { borderColor: theme.focus, backgroundColor: theme.bgRaised }]}>
          <Text style={[styles.title, { color: theme.fgBright }]}>{i18n.tutorialV2.gradTitle}</Text>
          {storyJson.tutorial.map((line, i) => (
            <Text key={i} style={[styles.line, { color: theme.fgDim }]}>{line}</Text>
          ))}
          <Text style={[styles.rewards, { color: theme.focus }]}>
            {first ? i18n.tutorialV2.gradRewardsFirst : i18n.tutorialV2.gradRewardsReplay}
          </Text>
          <Text style={[styles.continue, { color: theme.fg }]}>{i18n.tutorialV2.gradContinue}</Text>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', padding: layout.gutter },
  card: {
    width: '100%',
    maxWidth: 420,
    borderWidth: 1,
    borderRadius: layout.radiusLg,
    padding: layout.gutter,
    gap: 10,
  },
  title: { fontFamily: fonts.display, fontSize: 24, letterSpacing: 0.5 },
  line: { fontFamily: fonts.bodyItalic, fontSize: 14, lineHeight: 20 },
  rewards: { fontFamily: fonts.body, fontSize: 15, marginTop: 6 },
  continue: { fontFamily: fonts.display, fontSize: 14, letterSpacing: 1, alignSelf: 'flex-end' },
});
