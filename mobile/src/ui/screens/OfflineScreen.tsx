// OfflineScreen — S19: engraved error plate with human copy. Offline still allows
// M0/M1/M5/Shade (specs/17 phase 5.8).
//
// PORT of ../src/app/game/OfflineScreen.tsx (40 lines). The recovery law is the
// web's own: poll `net.connect()` — immediately on mount, then every 8 s — and the
// moment a connect succeeds the screen routes itself to the Antechamber. No
// expo-network listener is added: the spec's note names one, but the web source is
// the porting authority (AGENTS.md fidelity contract), the net client IS this
// port's connectivity seam, and AGENTS.md forbids adding dependencies without
// asking. The web build's 8 s setInterval is carried verbatim.
//
// Translation notes (the AGENTS.md platform table, nothing more):
//  - `main minHeight 100dvh, grid placeItems center, background var(--ink-black)`
//    → the flex root (the ink-black literal does not move under high contrast —
//    the web's var(--ink-black) doesn't either); `div.plate page-turn` → the
//    panel chrome settled (the ResultScreen/Reliquary standing decision on
//    entry-animation chrome);
//  - the theme rides themeFor() like every hub screen — the CSS cascade behind
//    var(--bg-raised)/var(--line-strong)/var(--fg-dim) responds to the contrast
//    setting, so the port's tokens must too; var(--oxblood) and
//    var(--parchment-dim) are pigment literals on the web (unaffected by
//    contrast) and stay palette reads here;
//  - the wordmark is a literal on the web (fontSize 34 FIXED — var(--fs-2xl) is
//    NOT used — with 0.14em tracking) — carried verbatim as px values;
//  - the body <p> carries no fontSize on the web, so it inherits the document's
//    var(--fs-md) — the port's fs.md;
//  - the three buttons' labels — 'Tutorial', 'Folios', 'Shade duel' — are
//    COMPONENT LITERALS on the web (they are not in the frozen en.json), so the
//    port carries them verbatim rather than diverging the dictionary (the Ribbon
//    TABS precedent); their routes are the web's exact payloads;
//  - the footer's trailing '…' is the web's own literal, carried;
//  - the web's `useEffect(..., [ui])` re-subscribes on the whole ui store; the
//    port subscribes to the stable `go` action — the same effect, run once;
//  - .btn base: 1.5px brass-dim border, charcoal ground, fg text; .btn-primary
//    overrides to brass border + parchment-light text — the web's own class
//    values, per-button.
//
// REPORTED DEFECT (web build, inherited — report, do not fix): nothing ever routes
// to 'offline' — no go('offline') exists anywhere in the web build (the same class
// of unreachable-wiring defect reported for 'purse' in phase 5.5): GameShell
// renders the screen, and the matchmaking screen falls back to a local Shade duel
// instead of routing here. The port wires it exactly the same: rendered by
// GameShell at case 'offline', reachable by nothing — the defect travels with the
// port instead of being silently fixed by it.
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useUi } from '@/state/ui';
import { i18n } from '@/i18n';
import { net } from '@/game/net/client';
import { useDisplaySettings } from '@/platform/display';
import { fonts, layout, palette, themeFor, type as typeScale } from '@/theme/tokens';

/** the web's fixed wordmark: fontSize 34 with 0.14em tracking (0.14 × 34). */
const WORDMARK_SIZE = 34;
const WORDMARK_TRACKING = 0.14 * WORDMARK_SIZE;

export default function OfflineScreen() {
  const go = useUi((s) => s.go);
  const display = useDisplaySettings();
  const theme = useMemo(
    () => themeFor({ contrast: display.contrast, text: display.text }),
    [display.contrast, display.text],
  );
  const fs = typeScale(theme.textScale);
  const [online, setOnline] = useState(false);

  useEffect(() => {
    let alive = true;
    const probe = async () => {
      const ok = await net.connect();
      if (!alive) return;
      setOnline(ok);
      if (ok) go('antechamber');
    };
    void probe();
    const iv = setInterval(probe, 8000);
    return () => {
      alive = false;
      clearInterval(iv);
    };
  }, [go]);

  return (
    <View style={styles.root}>
      {/* web div.plate: maxWidth 380, bg-raised, 1px line-strong, padding 26, center */}
      <View style={[styles.plate, { backgroundColor: theme.bgRaised, borderColor: theme.lineStrong }]}>
        <Text style={styles.wordmark}>ASSIZE</Text>
        <Text accessibilityRole="header" style={[styles.title, { color: palette.oxblood, fontSize: fs.lg }]}>
          {i18n.offline.title}
        </Text>
        <Text style={[styles.body, { color: theme.fgDim, fontSize: fs.md }]}>{i18n.offline.body}</Text>
        <View style={styles.actions}>
          {/* web .btn.btn-primary: charcoal ground, brass border, parchment-light text */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Tutorial"
            onPress={() => go('tutorial', { duelMode: 'tutorial' })}
            style={[styles.btn, { backgroundColor: palette.charcoal, borderColor: palette.brass }]}
          >
            <Text style={[styles.btnText, { color: palette.parchmentLight, fontSize: fs.md }]}>Tutorial</Text>
          </Pressable>
          {/* web .btn base: charcoal ground, brass-dim border, fg text */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Folios"
            onPress={() => go('folioMap')}
            style={[styles.btn, { backgroundColor: palette.charcoal, borderColor: palette.brassDim }]}
          >
            <Text style={[styles.btnText, { color: theme.fg, fontSize: fs.md }]}>Folios</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Shade duel"
            onPress={() => go('matchmaking', { duelMode: 'shade' })}
            style={[styles.btn, { backgroundColor: palette.charcoal, borderColor: palette.brassDim }]}
          >
            <Text style={[styles.btnText, { color: theme.fg, fontSize: fs.md }]}>Shade duel</Text>
          </Pressable>
        </View>
        <Text style={[styles.footer, { color: theme.lineStrong, fontSize: fs.xs }]}>
          {online ? i18n.common.continue : i18n.offline.retry}…
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // web main: min-height 100dvh, grid placeItems center, background var(--ink-black), padding 24
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.inkBlack, padding: 24 },
  // web div.plate.page-turn: maxWidth 380, padding 26, center, radius
  plate: {
    width: '100%',
    maxWidth: 380,
    padding: 26,
    borderWidth: 1,
    borderRadius: layout.radius,
    alignItems: 'center',
  },
  // web .wordmark: 34px fixed, 0.14em tracking, var(--parchment-dim), center, marginBottom 14
  wordmark: {
    fontFamily: fonts.display,
    fontSize: WORDMARK_SIZE,
    letterSpacing: WORDMARK_TRACKING,
    color: palette.parchmentDim,
    textAlign: 'center',
    marginBottom: 14,
  },
  // web h1: font-display, fs-lg, var(--oxblood)
  title: { fontFamily: fonts.display, textAlign: 'center' },
  // web p (no fontSize — inherits the document's fs-md): fg-dim, italic, margin '10px 0 16px'
  body: {
    fontFamily: fonts.bodyItalic,
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 16,
  },
  // web div: grid gap 8
  actions: { alignSelf: 'stretch', gap: 8 },
  // web .btn: 1.5px border, radius, padding '10px 18px', display face — the 44pt floor
  btn: {
    minHeight: layout.touch,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderRadius: layout.radius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // web .btn: letter-spacing 0.06em
  btnText: { fontFamily: fonts.display, letterSpacing: 0.06 },
  // web p: marginTop 14, fs-xs, var(--line-strong)
  footer: { fontFamily: fonts.body, marginTop: 14, textAlign: 'center' },
});
