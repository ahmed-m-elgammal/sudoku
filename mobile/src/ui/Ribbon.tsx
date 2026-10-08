// Ribbon.tsx — bottom tab ribbon for hub screens: Duel, Folios, Cabinet, Ledger
// (spec §4 NAV).
//
// PORT of ../src/app/game/Ribbon.tsx (the web build, 51 lines), verbatim in
// behaviour. Every hub screen mounts its own <Ribbon />; the duel and the result
// screen never do.
//
// Performance law: both zustand subscriptions are selector-scoped — `screen` plus the
// stable `go` action — so unrelated hub-screen store traffic (lastResult, pendingFoe,
// story, serverDuel…) never re-renders the ribbon. It re-renders only when the active
// tab can actually change. The component is stateless and effect-free: it reads the
// screen machine and nothing else, so there is no state to leak across duels or
// sessions, and the grain texture is a bundled asset, not a fetch.
//
// Translation notes (the AGENTS.md platform table, nothing more):
//  - `aria-current="page"` -> accessibilityRole="tab" + accessibilityState.selected
//    (the same mapping the duel's ToolBtn uses for aria-pressed); `<nav aria-label>`
//    -> accessibilityRole="tablist" + the same label text.
//  - the dingbat icons are `aria-hidden` spans on the web; RN hides them from both
//    platforms' access layers explicitly.
//  - `background: var(--charcoal) url(tab-ribbon.svg) cover` -> the charcoal ground
//    with the raster grain absolutely filling it (mode="cover" — the SVG word for
//    CSS cover was `slice`).
//  - the web's `zIndex: 40` is page stacking order; RN's sibling order gives the same
//    result, and each hub screen owns where the ribbon sits in its tree.
//  - the TABS table's four labels and dingbats are COMPONENT LITERALS on the web
//    (they are not in the frozen en.json), so the port carries them verbatim rather
//    than diverging the dictionary. Every colour comes from tokens.
import { useMemo } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUi } from '@/state/ui';
import { audio } from '@/platform/audio';
import { useDisplaySettings } from '@/platform/display';
import Art from '@/ui/Art';
import { fonts, palette, themeFor, type as typeScale } from '@/theme/tokens';

// Metro needs a literal require (metro.config.js: the raster twins are asset
// extensions); resolveAssetSource turns the asset id into the URI the Art seam
// paints — the same law ../duel/duelAssets.ts follows for the duel's registry.
const RIBBON = require('../../assets/game/ui/tab-ribbon.png');
const ribbonUri = Image.resolveAssetSource(RIBBON)?.uri ?? '';

const TABS = [
  { id: 'antechamber', label: 'Duel', icon: '⚔' },
  { id: 'folioMap', label: 'Folios', icon: '❧' },
  { id: 'cabinet', label: 'Cabinet', icon: '❖' },
  { id: 'ledger', label: 'Ledger', icon: '≡' },
] as const;

export default function Ribbon() {
  const screen = useUi((s) => s.screen);
  const go = useUi((s) => s.go);
  const display = useDisplaySettings();
  const theme = useMemo(
    () => themeFor({ contrast: display.contrast, text: display.text }),
    [display.contrast, display.text],
  );
  const insets = useSafeAreaInsets();
  const fs = typeScale(theme.textScale);

  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel="Hub navigation"
      style={[
        styles.ribbon,
        { backgroundColor: theme.bgRaised, borderTopColor: palette.brassDim, paddingBottom: insets.bottom },
      ]}
    >
      <Art
        uri={ribbonUri}
        width="100%"
        height="100%"
        mode="cover"
        style={StyleSheet.absoluteFill}
      />
      {TABS.map((t) => {
        const active = screen === t.id || (t.id === 'antechamber' && screen === 'duel');
        const tint = { color: active ? palette.brass : theme.fgDim };
        return (
          <Pressable
            key={t.id}
            accessibilityRole="tab"
            accessibilityLabel={t.label}
            accessibilityState={{ selected: active }}
            onPress={() => {
              audio.uiTap();
              go(t.id);
            }}
            style={[styles.tab, { borderBottomColor: active ? palette.brass : 'transparent' }]}
          >
            <Text
              accessibilityElementsHidden
              importantForAccessibility="no"
              style={[styles.tabIcon, tint]}
            >
              {t.icon}
            </Text>
            <Text style={[styles.tabLabel, tint, { fontSize: fs.sm, letterSpacing: 0.08 * fs.sm }]}>
              {t.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  // edge-to-edge at the screen's bottom; paddingBottom is the REAL safe inset
  // (web: var(--safe-bottom)) — the home indicator sits over the grain.
  ribbon: {
    flexDirection: 'row',
    borderTopWidth: 1.5,
  },
  tab: {
    flex: 1, // web grid repeat(4, 1fr)
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
    paddingTop: 8,
    paddingBottom: 10,
    // web minHeight: 52 — itself above the 44pt touch law
    minHeight: 52,
    borderBottomWidth: 2,
  },
  tabIcon: { fontSize: 16 },
  tabLabel: { fontFamily: fonts.display },
});
