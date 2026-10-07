// BootScreen — S01: black, one engraved line, wordmark, auto-advances within 1.2s (R1).
//
// Port of ../src/app/game/BootScreen.tsx.
// Not a menu — just a branded splash that advances to the tutorial (first play) or
// the antechamber (returning player).
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useUi } from '@/state/ui';
import { useSave } from '@/state/save';
import i18n from '@/i18n/en.json';
import { fonts, palette, type as typeScale } from '@/theme/tokens';

function advance(go: ReturnType<typeof useUi.getState>['go'], tutorialDone: boolean) {
  // Web parity (spec 1.1 / R1): returning players land in the antechamber, first
  // play lands directly in the tutorial duel. The Antechamber screen itself is
  // still a Phase A stub — the routing law is the web build's, the hub catches
  // up in Phase 2.3.
  if (tutorialDone) go('antechamber');
  else go('tutorial', { duelMode: 'tutorial' });
}

export default function BootScreen() {
  const go = useUi((s) => s.go);
  const save = useSave((s) => s.save);
  const tutorialDone = save?.tutorialDone ?? false;

  // Auto-advance after 1200ms
  useEffect(() => {
    const t = setTimeout(() => advance(go, tutorialDone), 1200);
    return () => clearTimeout(t);
  }, [go, tutorialDone]);

  return (
    <Pressable style={styles.root} onPress={() => advance(go, tutorialDone)}>
      <View style={styles.content}>
        <Text style={styles.line}>{i18n.boot.line}</Text>
        <Text style={styles.wordmark}>ASSIZE</Text>
        <Text style={styles.sub}>{i18n.boot.sub}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.inkBlack,
    padding: 24,
  },
  content: {
    alignItems: 'center',
  },
  line: {
    color: palette.brassDim,
    fontFamily: fonts.bodyItalic,
    fontSize: typeScale(1).md,
    opacity: 0.85,
    marginBottom: 24,
    textAlign: 'center',
  },
  wordmark: {
    color: palette.parchmentLight,
    fontFamily: fonts.display,
    fontSize: 52,
    letterSpacing: 8,
    fontWeight: '400',
    textAlign: 'center',
  },
  sub: {
    color: palette.brassDim,
    fontFamily: fonts.body,
    fontSize: typeScale(1).xs,
    letterSpacing: 5,
    marginTop: 18,
    textAlign: 'center',
  },
});