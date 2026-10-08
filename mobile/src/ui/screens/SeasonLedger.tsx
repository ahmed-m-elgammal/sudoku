// SeasonLedger — S16: 30 tiers, free + Patron tracks, progress, claim buttons,
// season timer (specs/17 phase 5.3).
//
// PORT of ../src/app/game/SeasonLedger.tsx (80 lines). The tier math, the weeks
// read, the reward law and the award-once claim live in seasonLaw.ts so the gate
// can pin them; this screen is the composition only.
//
// Translation notes (the AGENTS.md platform table, nothing more):
//  - `synth.uiTap()` → `audio.uiTap()`;
//  - the header <p> is italic (web fontStyle) → the registered italic cut of the
//    body face (fonts.bodyItalic — RN cannot synthesize italics);
//  - the tier's `<b className="roman">{n}</b>` → the bold cut of the registered
//    serif (fonts.digitBold — RN cannot synthesize weights; the Reliquary rates
//    line set this translation);
//  - the web's 36 px claim buttons rise to the 44 pt floor (layout.touch) — the
//    fidelity table's only sanctioned touch fix, as on the shelf's chit buttons;
//  - `+{n * 10} Ink` / `+{⌈n/4⌉} Sigils` / `Free` / `Patron` compose from the
//    dictionary keys that carry the IDENTICAL copy (i18n.common.ink, common.sigils,
//    season.free, season.patron); 'Cosmetic — the Cabinet', the locked button's
//    '{cost} ink' and the '·' separators are the web screen's own literals
//    (SeasonLedger.tsx:50,71) — no key exists, carried verbatim, not reworded;
//  - the weeks-left read happens once per mount, in a lazy state initialiser —
//    the render-purity seam the hub uses; the screen remounts per navigation, so
//    the timer is as fresh as the web's per-render read;
//  - the claim's idempotence is structural here (claimTier refuses `f${n}` twice)
//    where the web leans on the button's disabled attribute alone — the same
//    user-visible outcome, pinned by the law test (seasonLaw.ts header note).
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSave } from '@/state/save';
import { audio } from '@/platform/audio';
import { useDisplaySettings } from '@/platform/display';
import { recordInk } from '@/state/inkLedger';
import { fonts, layout, palette, themeFor, type as typeScale } from '@/theme/tokens';
import { i18n, tf } from '@/i18n';
import Ribbon from '@/ui/Ribbon';
import {
  claimTier, cumulative, progressFraction, seasonInkDuelId, tierFromInk,
  tierTypeOf, weeksLeftIn, type TierType,
} from './seasonLaw';

// the web screen's own literal (SeasonLedger.tsx:50) — the dictionary has no key for it
const COSMETIC_LINE = 'Cosmetic — the Cabinet';

export default function SeasonLedger() {
  const save = useSave((s) => s.save);
  const display = useDisplaySettings();
  const theme = useMemo(
    () => themeFor({ contrast: display.contrast, text: display.text }),
    [display.contrast, display.text],
  );
  const insets = useSafeAreaInsets();
  const fs = typeScale(theme.textScale);
  const [now] = useState(() => Date.now());

  if (!save) return null;
  const tiers = i18n.season.tiers;
  const currentTier = tierFromInk(save.season.ink);
  const nextCost = cumulative(currentTier + 1);
  const weeksLeft = weeksLeftIn(save.season.endsAt, now);
  const fill = progressFraction(save.season.ink, nextCost);

  const claim = (n: number, type: TierType) => {
    audio.uiTap();
    const cur = useSave.getState().save;
    if (!cur) return;
    const next = claimTier(cur, n, type);
    if (!next) return; // the award-once law refused it
    useSave.getState().update((s) => ({
      ...s,
      season: { ...s.season, claimed: next.claimed },
      economy: { ...s.economy, ink: next.economy.ink, sigils: next.economy.sigils },
    }));
    // the ledger tracks ink grants only — the web's own call site (SeasonLedger.tsx:68)
    if (type === 'ink') {
      recordInk({ duelId: seasonInkDuelId(n), mode: 'season', delta: n * 10 });
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.bg }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* web header: padding 'calc(var(--safe-top) + 14px) 16px 6px', textAlign center */}
        <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
          <Text accessibilityRole="header" style={[styles.title, { color: theme.fg, fontSize: fs.lg }]}>
            {i18n.season.title}
          </Text>
          <Text style={[styles.timer, { color: theme.fgDim, fontSize: fs.sm }]}>
            {tf('season.timeLeft', { weeks: weeksLeft })} · {tf('season.progress', { ink: Math.max(0, nextCost - save.season.ink), next: currentTier + 1 })}
          </Text>
          {/* web: height 8, 1px line-strong border, marginTop 8, brass fill */}
          <View style={[styles.bar, { borderColor: theme.lineStrong }]}>
            <View style={[styles.fill, { width: `${fill * 100}%`, backgroundColor: palette.brass }]} />
          </View>
        </View>

        {/* web ol: grid gap 6, padding '10px 16px' */}
        <View style={styles.list}>
          {tiers.map((t, i) => {
            const n = i + 1;
            const unlocked = save.season.ink >= cumulative(n);
            const claimedFree = save.season.claimed.includes(`f${n}`);
            const claimable = unlocked && !claimedFree;
            const reward = t.type === 'ink'
              ? `+${n * 10} ${i18n.common.ink}`
              : t.type === 'sigil'
                ? `+${Math.ceil(n / 4)} ${i18n.common.sigils}`
                : COSMETIC_LINE;
            return (
              // web li.panel: padding '8px 10px', flex row, gap 10, opacity unlocked ? 1 : 0.55
              <View
                key={n}
                style={[
                  styles.tier,
                  { backgroundColor: theme.bgRaised, borderColor: theme.lineStrong, opacity: unlocked ? 1 : 0.55 },
                ]}
              >
                <View style={[styles.ring, { borderColor: theme.line }]} pointerEvents="none" />
                <Text style={[styles.tierNum, { color: theme.fg, width: 30 }]}>
                  {n}
                </Text>
                <View style={styles.tierMain}>
                  <Text style={[styles.tierName, { color: theme.fg, fontSize: fs.md }]}>{t.name}</Text>
                  <Text style={[styles.tierReward, { color: theme.fgDim, fontSize: fs.xs }]}>
                    {reward} · {i18n.season.free} / {save.season.patron ? i18n.season.patron : i18n.season.patronUnlock}
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${claimedFree ? i18n.season.claimed : claimable ? i18n.season.claim : `${cumulative(n)} ink`}: ${t.name}`}
                  disabled={!claimable}
                  onPress={() => claim(n, tierTypeOf(t.type))}
                  style={[styles.claimBtn, { opacity: claimable ? 1 : 0.45 }]}
                >
                  <Text style={[styles.claimText, { color: theme.fg, fontSize: fs.xs }]}>
                    {claimedFree ? i18n.season.claimed : claimable ? i18n.season.claim : `${cumulative(n)} ink`}
                  </Text>
                </Pressable>
              </View>
            );
          })}
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
  // web p: fg-dim, italic
  timer: { fontFamily: fonts.bodyItalic, textAlign: 'center', marginTop: 2 },
  bar: { height: 8, borderWidth: 1, marginTop: 8, alignSelf: 'stretch' },
  fill: { height: '100%' },
  list: { gap: 6, paddingHorizontal: 16, paddingVertical: 10 },
  // web li.panel
  tier: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderRadius: layout.radius,
  },
  // web .panel::before: absolute inset 4, 1px var(--line), radius 2
  ring: { position: 'absolute', top: 4, left: 4, right: 4, bottom: 4, borderWidth: 1, borderRadius: 2 },
  // web b.roman: width 30, textAlign center, the bold serif cut
  tierNum: { fontFamily: fonts.digitBold, textAlign: 'center' },
  tierMain: { flex: 1, minWidth: 0 },
  tierName: { fontFamily: fonts.display },
  tierReward: { fontFamily: fonts.body, marginTop: 1 },
  // web .btn: minHeight 36 → the 44 pt floor; border 1.5 brass-dim, radius, padding '10px 18px'
  claimBtn: {
    minHeight: layout.touch,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1.5,
    borderColor: palette.brassDim,
    borderRadius: layout.radius,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.charcoal,
  },
  claimText: { fontFamily: fonts.display },
});
