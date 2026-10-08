// SettingsScreen - PHASE A STUB.
//
// OWNED BY: screens agent (A5)
// Port ../src/app/game/SettingsScreen.tsx
//
// The real implementation replaces this file entirely. This stub only exists so
// Phase A compiles and the app boots to a live screen. Do not treat it as a design
// to follow - port the web build's component, not this placeholder.
//
// G13 (docs/TUTORIAL_OPTIMIZATION_PLAN.md M1 item 7) — one real row already lives
// here: the tutorial replay entry. The lesson used to be unreachable forever once
// `tutorialDone` was written; the plan's fix is a "Relearn the Reckoning" row in the
// Antechamber AND here, both reading the single `tutorial.relearn` dictionary key and
// both routing through the one shared payload law in ./replayEntry. When the full
// settings port lands, this row survives verbatim.
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useUi } from '@/state/ui';
import { i18n } from '@/i18n';
import { fonts, layout, palette, type as typeScale } from '@/theme/tokens';
import { tutorialReplayPayload } from './replayEntry';

export default function SettingsScreen() {
  const go = useUi((s) => s.go);
  // G13 — bumped so a replay always remounts the duel with a fresh runtime.
  const duelNonce = useUi((s) => s.duelNonce);
  return (
    <View style={styles.root}>
      <Text style={styles.label}>SettingsScreen</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={i18n.tutorial.relearn}
        onPress={() => go('tutorial', tutorialReplayPayload(duelNonce))}
        style={styles.relearn}
      >
        <Text style={styles.relearnText}>{i18n.tutorial.relearn}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.inkBlack, gap: 16 },
  label: { color: palette.parchmentDim, fontSize: typeScale(1).sm, fontFamily: fonts.display, letterSpacing: 2 },
  // the one live row: hub-card framing (line-strong border, raised ground) at the
  // 44 pt touch minimum, matching the Antechamber entry's affordance
  relearn: {
    minHeight: layout.touch,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderWidth: 1,
    borderRadius: layout.radius,
    borderColor: palette.brassDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  relearnText: { color: palette.parchmentLight, fontFamily: fonts.display, fontSize: typeScale(1).md },
});
