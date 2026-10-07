// FolioDetail — S12: portrait, challenge text, three duels with stars, loadout hint,
// Begin.
//
// PORT of ../src/app/game/FolioDetail.tsx. The folio pointer arrives in
// ui.campaignDuel (set by FolioMap's node taps, or by a story interlude's advance);
// per-duel stars and the lock law read the save every render (spec 3.4):
// locked = duel beyond the save's duelIdx in this folio, or the folio itself is
// beyond campaign.folioIdx. Begin routes with duelMode 'campaign' + the pointer —
// the exact payload DuelScreen's specFromUi already consumes.
//
// Translation notes (the AGENTS.md platform table, nothing more):
//  - '(Shade)', 'Seals', both Loadout lines and the '{stars} of 3 stars' aria-label
//    are web component literals (FolioDetail.tsx:47/:50/:52/:57) with no dictionary
//    keys — carried verbatim (the Ribbon tab-label law).
//  - story.json is indexed through two typed accessors: strict TS cannot prove a
//    folio key inside the nine-key union, and the web build needed the same casts.
//  - every .panel here (the challenge blockquote and the duel rows) carries the
//    engraved ::before ring: an absolute View at inset 4, 1px theme.line, radius 2,
//    pointerEvents none — the ResultScreen port's established translation.
//  - the magistrate portrait is 512x640 in the web's 92x115 box (both exactly 4:5),
//    so resizeMode cover is pixel-identical to the web's object-fit cover.
//  - the web's ol grid stretches the Begin button to full row width; a plain
//    column child stretches the same way here.
import { useMemo } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FOLIOS, orderMeta } from '@shared/orders';
import { useUi } from '@/state/ui';
import { useSave } from '@/state/save';
import { audio } from '@/platform/audio';
import { useDisplaySettings } from '@/platform/display';
import { fonts, layout, palette, themeFor, type as typeScale } from '@/theme/tokens';
import { i18n, storyJson } from '@/i18n';
import { imageForPath } from '@/theme/assets';
import Ribbon from '@/ui/Ribbon';

const folioCopy = (key: string): { title: string; sub: string } =>
  (storyJson.folios as Record<string, { title: string; sub: string }>)[key];
const magCopy = (
  key: string,
): { challenge: string[]; defeat: string[]; taunt: string[]; folio: string } =>
  (storyJson.mag as Record<string, { challenge: string[]; defeat: string[]; taunt: string[]; folio: string }>)[
    key
  ];

export default function FolioDetail() {
  const go = useUi((s) => s.go);
  const ptr = useUi((s) => s.campaignDuel) ?? { folio: 0, duel: 0 };
  const save = useSave((s) => s.save);
  const display = useDisplaySettings();
  const theme = useMemo(
    () => themeFor({ contrast: display.contrast, text: display.text }),
    [display.contrast, display.text],
  );
  const insets = useSafeAreaInsets();
  const fs = typeScale(theme.textScale);

  if (!save) return null;

  const folio = FOLIOS[ptr.folio];
  const mag = folio.duels[2];
  const magText = magCopy(folio.key);
  const copy = folioCopy(folio.key);
  const portrait = imageForPath(`/assets/portraits/mag-${folio.key}.webp`);

  return (
    <View style={[styles.root, { backgroundColor: theme.bg }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
          {/* web img 92x115, 2px brass-dim frame, radius 3, object-fit cover */}
          <View style={[styles.portraitFrame, { borderColor: palette.brassDim }]}>
            {portrait ? (
              <Image
                source={portrait}
                resizeMode="cover"
                style={styles.portrait}
                accessibilityLabel={mag.name}
              />
            ) : null}
          </View>
          <View style={styles.headerMain}>
            <Text accessibilityRole="header" style={[styles.title, { color: theme.fg, fontSize: fs.lg, letterSpacing: 0.02 * fs.lg }]}>
              {copy.title}
            </Text>
            <Text style={[styles.sub, { color: theme.fgDim, fontSize: fs.sm }]}>{copy.sub}</Text>
          </View>
        </View>

        {/* web blockquote.panel: margin '8px 16px', padding 12, italic */}
        <View
          style={[styles.panel, styles.challenge, { marginHorizontal: 16, marginVertical: 8, backgroundColor: theme.bgRaised, borderColor: theme.lineStrong }]}
        >
          <View style={[styles.panelRing, { borderColor: theme.line }]} pointerEvents="none" />
          {magText.challenge.map((l, i) => (
            <Text key={i} style={[styles.challengeLine, { color: theme.fg, fontSize: fs.md }]}>
              {l}
            </Text>
          ))}
        </View>

        {/* web ol: grid gap 8, padding '4px 16px' */}
        <View style={styles.duels}>
          {folio.duels.map((d, i) => {
            const stars = save.campaign.stars[`${ptr.folio}-${i}`] ?? 0;
            const locked = i > save.campaign.duelIdx || ptr.folio > save.campaign.folioIdx;
            const current = i === save.campaign.duelIdx && ptr.folio === save.campaign.folioIdx;
            return (
              <View
                key={i}
                style={[
                  styles.panel,
                  styles.duel,
                  { backgroundColor: theme.bgRaised, borderColor: theme.lineStrong, opacity: locked ? 0.55 : 1 },
                ]}
              >
                <View style={[styles.panelRing, { borderColor: theme.line }]} pointerEvents="none" />
                <View style={styles.duelRow}>
                  <Text style={[styles.duelName, { color: theme.fg, fontSize: fs.md }]}>
                    {d.shadeKind === 'magistrate' ? mag.name : `${d.name} (Shade)`}
                  </Text>
                  <Text style={[styles.duelMeta, { color: theme.fgDim, fontSize: fs.xs }]}>
                    {d.tier} · {d.seals} Seals · {orderMeta(d.order).name}
                  </Text>
                  <Text
                    accessibilityLabel={`${stars} of 3 stars`}
                    style={[styles.stars, { color: palette.brass, fontSize: fs.md }]}
                  >
                    {'★'.repeat(stars)}{'☆'.repeat(3 - stars)}
                  </Text>
                </View>
                <Text style={[styles.loadout, { color: theme.fgDim, fontSize: fs.xs }]}>
                  {d.shadeKind === 'magistrate' ? 'Loadout: their own Order, 8 Seals.' : 'Loadout hint: their Order, 7 Seals.'}
                </Text>
                {current && !locked && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={i18n.common.begin}
                    onPress={() => {
                      audio.stamp();
                      go('duel', { duelMode: 'campaign', campaignDuel: { folio: ptr.folio, duel: i } });
                    }}
                    style={({ pressed }) => [
                      styles.begin,
                      { backgroundColor: theme.bgRaised, opacity: pressed ? 0.82 : 1 },
                    ]}
                  >
                    <Text style={[styles.beginText, { color: palette.parchmentLight, fontSize: fs.md, letterSpacing: 0.06 * fs.md }]}>
                      {i18n.common.begin}
                    </Text>
                  </Pressable>
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>
      {/* web .hub pads under the fixed ribbon; here the Ribbon is the column's last
          child — the same always-visible result (the Antechamber port's decision). */}
      <Ribbon />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingBottom: 16 },
  // web header: flex, gap 12, padding 'calc(var(--safe-top) + 14px) 16px 8px',
  // align-items flex-start
  header: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingBottom: 8, alignItems: 'flex-start' },
  portraitFrame: { width: 92, height: 115, borderRadius: 3, borderWidth: 2, overflow: 'hidden' },
  portrait: { width: '100%', height: '100%' },
  headerMain: { flex: 1, minWidth: 0 },
  title: { fontFamily: fonts.display }, // h1: 0.02em rides inline
  sub: { fontFamily: fonts.bodyItalic, marginTop: 2 },
  // web .panel: bg-raised, 1px line-strong, radius — plus the ::before engraved ring
  panel: { borderWidth: 1, borderRadius: layout.radius },
  panelRing: { position: 'absolute', top: 4, left: 4, right: 4, bottom: 4, borderWidth: 1, borderRadius: 2 },
  challenge: { padding: 12 }, // web blockquote inline padding 12; lines ride line-height only
  challengeLine: { fontFamily: fonts.bodyItalic },
  duels: { gap: 8, paddingHorizontal: 16, paddingTop: 4 },
  duel: { padding: 10, gap: 4 },
  duelRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  duelName: { fontFamily: fonts.display, flexShrink: 1 },
  duelMeta: { fontFamily: fonts.body, flexShrink: 1 },
  stars: { fontFamily: fonts.body, marginLeft: 'auto', letterSpacing: 2 },
  loadout: { fontFamily: fonts.body },
  // web .btn.btn-primary stretched to the grid row's full width
  begin: {
    minHeight: layout.touch,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderColor: palette.brass,
    borderRadius: layout.radius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  beginText: { fontFamily: fonts.display }, // 0.06em rides inline
});
