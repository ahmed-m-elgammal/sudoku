// LexiconBody — P2.5: the glossary content without navigation chrome
// (docs/STORY_HOLD_PLAN.md P2.5).
//
// Shared by the LexiconScreen (Settings entries arrive by nav) and the duel
// pause overlay (nav would destroy the live runtime — the overlay paints the
// same body over the paused room). Entry text lives in shared/lexicon.ts;
// fiction renders in the display font, plain + value in the body face.
import { Text, View } from 'react-native';
import { LEXICON, LEXICON_SECTIONS, type LexSection } from '@shared/lexicon';
import { fonts, type Theme, type as typeScale } from '@/theme/tokens';

type Fs = ReturnType<typeof typeScale>;

const ORDER: LexSection[] = ['court', 'tablet', 'arts', 'orders', 'ladder'];

export default function LexiconBody({ theme, fs }: { theme: Theme; fs: Fs }) {
  return (
    <View>
      {ORDER.map((section) => (
        <View key={section}>
          <Text accessibilityRole="header" style={[{ color: theme.fgDim, fontSize: fs.sm }, styles.section]}>
            {LEXICON_SECTIONS[section]}
          </Text>
          {LEXICON.filter((e) => e.section === section).map((e) => (
            <View key={e.term} style={styles.entry}>
              <Text style={[{ color: theme.fg, fontSize: fs.md }, styles.fiction]}>
                {e.fiction}
                {e.value ? (
                  <Text style={[{ color: theme.fgDim, fontSize: fs.sm }, styles.value]}> · {e.value}</Text>
                ) : null}
              </Text>
              <Text style={[{ color: theme.fgDim, fontSize: fs.sm }, styles.plain]}>{e.plain}</Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

// StyleSheet.create would freeze these; they ride inline theme colors, so the
// object holds only the static law (the Chronicle's panel pattern, simplified
// to rows — a glossary is scanned, not admired).
const styles = {
  section: { fontFamily: fonts.display, marginTop: 14, marginBottom: 2 },
  entry: { marginTop: 8 },
  fiction: { fontFamily: fonts.display },
  value: { fontFamily: fonts.body },
  plain: { fontFamily: fonts.body, marginTop: 1 },
} as const;
