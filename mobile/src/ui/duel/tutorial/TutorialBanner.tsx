// TutorialBanner.tsx — the M2 coach's docked banner (docs/TUTORIAL_OPTIMIZATION_PLAN.md
// §5.3). The M1 docked note's laws carry over and stay test-pinned:
//
//   · IN FLOW, never absolutely positioned — it docks below the board / above the
//     toolbar (or as a full-width strip under the room in landscape) and can never
//     cover a cell (G3; COACH-7 pins the v1 note, TUTORIAL-B pins this one).
//   · the skip chip lives in the banner row, never over the HUD (G4).
//   · copy is plain-first, flavor-second (§11), all from the i18n dictionary.
//
// What v2 adds: a progress-dots row (Step n of 9), the two CTA gates (t1 Continue,
// t2 Try it), the t6 sub-step copy (read from the runtime's spotlight TARGET, which
// already encodes the sub-step — the director object stays encapsulated), the t9
// telegraph line ("The Shade eyes Row 3…"), and the t8 free-Augur grant timer (the
// M1 G1 law: the note must be readable for 2.5 s before the rite lands).
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import type { DuelRuntime, TutorialSpotTarget, TutorialTelegraph } from '@/game/duelRuntime';
import { i18n, tf } from '@/i18n';
import { fonts, layout, type Theme } from '@/theme/tokens';
import { phaseStep, type TutorialPhase } from '@/game/tutorialDirector';

export interface TutorialBannerProps {
  duel: DuelRuntime;
  phase: TutorialPhase;
  target: TutorialSpotTarget;
  telegraph: TutorialTelegraph | null;
  theme: Theme;
  onGate: (gate: 'continue' | 'tryIt') => void;
  onSkip: () => void;
  /** the landscape dock adds its own insets/margins under the room */
  style?: StyleProp<ViewStyle>;
}

/** How long the augur note must be readable before the free rite lands (G1's v2 law). */
const AUGUR_NOTE_MIN_VISIBLE_MS = 2500;

const UNIT_KEY = { row: 'unitRow', col: 'unitCol', box: 'unitBox' } as const;

export default function TutorialBanner({ duel, phase, target, telegraph, theme, onGate, onSkip, style }: TutorialBannerProps) {
  // G1 in v2 — hold the Eye's note on screen for its minimum read time, THEN grant.
  useEffect(() => {
    if (phase !== 't8' || duel.freeAugurGranted) return;
    const t = setTimeout(() => duel.grantFreeAugur(), AUGUR_NOTE_MIN_VISIBLE_MS);
    return () => clearTimeout(t);
  }, [phase, duel]);

  const copy = copyFor(phase, target);
  const step = phaseStep(phase);
  const cta = phase === 't1' ? { label: i18n.tutorialV2.t1Cta, gate: 'continue' as const }
    : phase === 't2' ? { label: i18n.tutorialV2.t2Cta, gate: 'tryIt' as const }
    : null;

  return (
    <View style={[styles.row, { backgroundColor: theme.fg, borderColor: theme.bg }, style]}>
      <View style={styles.textCol}>
        {step > 0 ? (
          <View style={styles.dots} accessibilityRole="text" accessibilityLabel={tf('tutorialV2.step', { n: step, total: 9 })}>
            {Array.from({ length: 9 }, (_, i) => (
              <View key={i} style={[styles.dot, { borderColor: theme.bg }, i < step && { backgroundColor: theme.bg }]} />
            ))}
          </View>
        ) : null}
        <Text style={[styles.plain, { color: theme.bg }]} numberOfLines={2}>
          {telegraph
            ? tf('tutorialV2.telegraph', { unit: tf(`tutorialV2.${UNIT_KEY[telegraph.unit]}`, { n: telegraph.n }) })
            : copy.plain}
        </Text>
        {copy.flavor ? (
          <Text style={[styles.flavor, { color: theme.bg }]} numberOfLines={1}>{copy.flavor}</Text>
        ) : null}
      </View>
      {cta ? (
        <Pressable
          onPress={() => onGate(cta.gate)}
          accessibilityRole="button"
          accessibilityLabel={cta.label}
          style={[styles.chip, { borderColor: theme.bg }]}
        >
          <Text style={[styles.chipText, { color: theme.bg }]}>{cta.label}</Text>
        </Pressable>
      ) : null}
      <Pressable
        onPress={onSkip}
        accessibilityRole="button"
        accessibilityLabel={i18n.tutorial.skip}
        style={[styles.chip, { borderColor: theme.bg }]}
      >
        <Text style={[styles.chipText, { color: theme.bg }]}>{i18n.tutorial.skip}</Text>
      </Pressable>
    </View>
  );
}

/** The banner's plain+flavor pair for the live phase; t6 walks its three sub-steps. */
function copyFor(phase: TutorialPhase, target: TutorialSpotTarget): { plain: string; flavor: string | null } {
  const v = i18n.tutorialV2;
  switch (phase) {
    case 't1': return { plain: v.t1Plain, flavor: v.t1Flavor };
    case 't2': return { plain: v.t2Plain, flavor: v.t2Flavor };
    case 't3': return { plain: v.t3Plain, flavor: v.t3Flavor };
    case 't4': return { plain: v.t4Plain, flavor: v.t4Flavor };
    case 't5': return { plain: v.t5Plain, flavor: v.t5Flavor };
    case 't6': {
      if (target?.kind === 'toolbar') return { plain: v.t6Plain, flavor: v.t6Flavor };
      if (target?.kind === 'erase') return { plain: v.t6Erase, flavor: null };
      return { plain: v.t6Notes, flavor: null };
    }
    case 't7': return { plain: v.t7Plain, flavor: v.t7Flavor };
    case 't8': return { plain: v.t8Plain, flavor: v.t8Flavor };
    case 't9': return { plain: v.t9Plain, flavor: v.t9Flavor };
    default: return { plain: v.t1Plain, flavor: null }; // t0/t10 render their own surfaces
  }
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: layout.touch + 8,
    borderWidth: 1,
    borderRadius: layout.radius,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 4,
  },
  textCol: { flex: 1, gap: 2 },
  dots: { flexDirection: 'row', gap: 3, marginBottom: 1 },
  dot: { width: 6, height: 6, borderRadius: 3, borderWidth: 1 },
  plain: { fontFamily: fonts.body, fontSize: 13, lineHeight: 17 },
  flavor: { fontFamily: fonts.bodyItalic, fontSize: 12, lineHeight: 16 },
  chip: {
    paddingHorizontal: 8,
    minHeight: layout.touch,
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: layout.radius,
  },
  chipText: { fontFamily: fonts.display, fontSize: 11 },
});
