// EndingChoice — S19 (TODO T6): the Balance / Burn verdict after the Orsolo reveal.
//
// PORT of ../src/app/game/EndingChoice.tsx. The screen is reached only through the
// Orsolo reveal story (DuelScreen.finish fires it on the FIRST clear of Folio IX,
// duel III — the first-clear guard; replays skip the beat and never land here). Two
// engraved plates, one irreversible choice: pick arms a panel, Seal writes
// `save.campaign.ending`, then the chosen ending plays as a StoryCard whose payload
// carries its own successor — the one-atomic-go law (spec 3.1). The confirm sheet
// lives in ./EndingConfirm (the ~300-line ceiling's extraction).
//
// Translation notes (the AGENTS.md platform table, nothing more):
//  - the web main is a `min-height: 100dvh` grid the body scrolls; its auto-fit
//    panel grid (`minmax(min(260px, 86vw), 1fr)`) collapses to ONE column on every
//    phone width, so here the page is a ScrollView and the panels wrap to two-up
//    only when both 260px track minima fit (the web's auto-fit line, hand-derived).
//  - `synth.sealBreak()` has no counterpart in the 18-method mobile audio contract;
//    the wax-stamp break is the stamp's voice (`audio.stamp()`), the same
//    nearest-cue mapping the FolioDetail Begin press uses.
//  - web Escape = "put the pen down" (`setChosen(null)` + antechamber, web:56). The
//    shell-wide hardware-back would pop to `prev` — the CONSUMED Orsolo reveal —
//    which is exactly the stale-screen residue this port refuses, so this screen
//    registers its own BackHandler (registered after GameShell's, runs first,
//    consumes) and implements the web's Esc verbatim.
//  - `aria-pressed` -> `accessibilityState.selected` (the Ribbon's aria-current law).
//  - DEFECT REPORT (not fixed, port law): spec 17 §3.5 says the ending "closes into
//    `endless`", but the shipped web build closes into `antechamber` (web:43, cited
//    to docs/STORY.md). The code is canon: 'antechamber'.
//  - DEFECT REPORT (not fixed): the web's armed transition (border-color/transform
//    140ms) is reduced-motion-suppressed decoration; RN renders the armed state
//    instantly — same information, no transition law broken.
//  - '▸ ' is a web component literal (web:130) with no dictionary key — carried
//    verbatim (the Ribbon tab-label law).
import { useEffect, useMemo, useState } from 'react';
import {
  BackHandler,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUi } from '@/state/ui';
import { useSave } from '@/state/save';
import { audio } from '@/platform/audio';
import { useDisplaySettings } from '@/platform/display';
import { fonts, palette, themeFor, type as typeScale } from '@/theme/tokens';
import { i18n, storyJson } from '@/i18n';
import { imageForPath } from '@/theme/assets';
import EndingConfirm from './EndingConfirm';

type Ending = 'balance' | 'burn';

// web:15-28 — module-scope record. The accents are the web vars `--brass` /
// `--oxblood`, which the high-contrast cascade never redefines, so they ride
// `palette` (the OrderSelect/FolioDetail law); the plates stay web paths — data,
// resolved through imageForPath like every story payload.
const ENDINGS: Record<Ending, { plate: string; title: string; desc: string; accent: string }> = {
  balance: {
    plate: '/assets/plates/plate-ending-balance.webp',
    title: i18n.endingChoice.balanceTitle,
    desc: i18n.endingChoice.balanceDesc,
    accent: palette.brass,
  },
  burn: {
    plate: '/assets/plates/plate-ending-burn.webp',
    title: i18n.endingChoice.burnTitle,
    desc: i18n.endingChoice.burnDesc,
    accent: palette.oxblood,
  },
};

// both ending plates measure exactly 1080x720 — the web's `width: 100%` +
// `object-fit: cover` box is an aspectRatio box that the 34vh cap crops.
const PLATE_RATIO = 1.5;
// the web panel track minimum (260px) x 2 — two-up needs both to fit.
const TRACK_MIN = 260;

export default function EndingChoice() {
  const go = useUi((s) => s.go);
  const [chosen, setChosen] = useState<Ending | null>(null);
  const display = useDisplaySettings();
  const theme = useMemo(
    () => themeFor({ contrast: display.contrast, text: display.text }),
    [display.contrast, display.text],
  );
  const insets = useSafeAreaInsets();
  const fs = typeScale(theme.textScale);
  const { width: winW, height: winH } = useWindowDimensions();

  const pick = (e: Ending) => {
    audio.uiTap();
    setChosen(e);
  };

  // web:36-48 — the verdict is written straight into the save via getState() (no
  // subscription: this screen never re-renders off it), then the ending beat plays.
  const seal = (e: Ending) => {
    audio.stamp(); // web synth.sealBreak() — nearest voice in the 18-method contract
    useSave.getState().update((cur) => ({ ...cur, campaign: { ...cur.campaign, ending: e } }));
    go('story', {
      story: {
        lines: [...(e === 'balance' ? storyJson.endings.balance : storyJson.endings.burn)],
        plate: ENDINGS[e].plate,
        then: 'antechamber',
      },
      lastResult: null,
      serverDuel: null,
    });
  };

  // web:51-60 — 1/2/Enter have no phone, but Escape does: hardware back puts the pen
  // down. Registered AFTER GameShell's listener, so it runs first and consumes.
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setChosen(null);
      go('antechamber');
      return true;
    });
    return () => sub.remove();
  }, [go]);

  // web padding clamp(14px, 4vw, 32px) and group gap clamp(10px, 2.5vw, 22px)
  const padX = Math.min(32, Math.max(14, Math.round(winW * 0.04)));
  const gap = Math.min(22, Math.max(10, Math.round(winW * 0.025)));
  // web img maxHeight '34vh'
  const plateMax = Math.round(winH * 0.34);
  // web sub maxWidth '52ch' — 52 half-em advances of the body face (approximation)
  const subMax = Math.round(fs.sm * 26);
  const twoUp = winW - padX * 2 >= TRACK_MIN * 2 + gap;

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[
          {
            paddingTop: insets.top + 22,
            paddingBottom: insets.bottom + 22,
            paddingHorizontal: padX,
            rowGap: 14, // web main gap 14
          },
        ]}
      >
        <View style={styles.header}>
          <Text
            accessibilityRole="header"
            style={[styles.title, { color: palette.parchmentLight, fontSize: fs.xl, letterSpacing: 0.14 * fs.xl }]}
          >
            {i18n.endingChoice.title}
          </Text>
          <Text style={[styles.sub, { color: theme.fgDim, fontSize: fs.sm, maxWidth: subMax }]}>
            {i18n.endingChoice.sub}
          </Text>
        </View>

        {/* web role="group" aria-label = the title */}
        <View accessible accessibilityLabel={i18n.endingChoice.title} style={[styles.group, { gap }]}>
          {(['balance', 'burn'] as Ending[]).map((e) => {
            const meta = ENDINGS[e];
            const armed = chosen === e;
            const plate = imageForPath(meta.plate);
            return (
              <Pressable
                key={e}
                accessibilityRole="button"
                accessibilityLabel={meta.title}
                accessibilityState={{ selected: armed }}
                onPress={() => pick(e)}
                style={[
                  styles.verdict,
                  {
                    backgroundColor: palette.charcoal, // web var(--charcoal) — HC never redefines it
                    borderColor: armed ? meta.accent : theme.lineStrong,
                    transform: armed ? [{ translateY: -2 }] : undefined,
                    flexGrow: 1,
                    flexBasis: twoUp ? '48%' : '100%',
                  },
                ]}
              >
                {plate ? (
                  <Image
                    source={plate}
                    resizeMode="cover"
                    style={[styles.plate, { borderColor: theme.lineStrong, maxHeight: plateMax }]}
                    accessibilityElementsHidden
                    importantForAccessibility="no-hide-descendants"
                  />
                ) : (
                  <View style={[styles.plateEmpty, { borderColor: theme.lineStrong, maxHeight: plateMax }]} />
                )}
                <Text
                  accessibilityRole="header"
                  style={[styles.verdictTitle, { color: meta.accent, fontSize: fs.lg, letterSpacing: 0.1 * fs.lg }]}
                >
                  {meta.title}
                </Text>
                <Text style={[styles.verdictDesc, { color: theme.fgDim, fontSize: fs.sm }]}>{meta.desc}</Text>
                <Text style={[styles.armed, { color: palette.ash, fontSize: fs.xs }]}>
                  {armed ? '▸ ' + i18n.endingChoice.confirm : ''}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.hint, { color: palette.ash, fontSize: fs.xs }]}>{i18n.endingChoice.hint}</Text>
      </ScrollView>

      {chosen && (
        <EndingConfirm
          accent={ENDINGS[chosen].accent}
          title={ENDINGS[chosen].title}
          onSeal={() => seal(chosen)}
          onReturn={() => setChosen(null)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // web main background var(--ink-black), minHeight 100dvh
  root: { flex: 1, backgroundColor: palette.inkBlack },
  header: { alignItems: 'center' },
  title: { fontFamily: fonts.display, textAlign: 'center' }, // 0.14em rides inline
  // web margin '6px auto 0', fontStyle italic -> the italic family
  sub: { fontFamily: fonts.bodyItalic, textAlign: 'center', marginTop: 6 },
  // web grid `repeat(auto-fit, minmax(min(260px,86vw),1fr))` -> a wrapping row; the
  // 980px cap is a desktop nicety a phone never meets
  group: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'stretch', alignSelf: 'stretch' },
  verdict: {
    borderWidth: 2,
    borderRadius: 6,
    padding: 12,
    gap: 8, // web grid rows 'auto auto auto 1fr', gap 8
  },
  plate: { width: '100%', aspectRatio: PLATE_RATIO, borderWidth: 1, borderRadius: 3 },
  plateEmpty: { width: '100%', aspectRatio: PLATE_RATIO, borderWidth: 1, borderRadius: 3 },
  verdictTitle: { fontFamily: fonts.display, textAlign: 'center' }, // 0.1em rides inline
  verdictDesc: { fontFamily: fonts.bodyItalic, textAlign: 'center' },
  // web alignSelf 'end' in the 1fr row -> rides to the panel's bottom edge
  armed: { fontFamily: fonts.body, textAlign: 'center', marginTop: 'auto' },
  hint: { fontFamily: fonts.body, textAlign: 'center' },
});
