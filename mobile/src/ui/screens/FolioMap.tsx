// FolioMap — S11: engraved plate map of Novem with nine Roman-numeral nodes, fog on
// locked ones.
//
// PORT of ../src/app/game/FolioMap.tsx. Node state reads straight off the save each
// render (spec 3.3): done = folio < campaign.folioIdx, current = equal, locked =
// greater — never re-derived, never cached. A node tap hands FolioDetail the campaign
// pointer ({ folio: i, duel: current folio's duelIdx or 0 }) in one atomic go().
//
// Translation notes (the AGENTS.md platform table, nothing more):
//  - the web's translate(-50%,-50%) has no RN percentage-transform equivalent: each
//    node is an absolute %-positioned wrapper whose 44x44 child offsets itself by
//    -22,-22 — identical geometry.
//  - `filter: grayscale(1)` on locked nodes has no RN equivalent for a text node and
//    no effective visual there anyway (the locked node shows only the line-strong ✕
//    at opacity 0.5 on charcoal-2 — already monochrome). Reported, not invented.
//  - '✕', the 'Folio {numeral} (locked)' aria-label and the plate alt 'The walled
//    city of Novem' are web component literals (FolioMap.tsx:29/:39/:52) with no
//    dictionary keys — carried verbatim (the Ribbon tab-label law).
//  - the spec's lazy-load note is a web concern: the 1.15 MB plate is a bundled
//    asset here, decoded natively with no DOM fetch cost.
//  - hub.foliosSub's '{done}' placeholder runs through tf() — the same substitution
//    the web does with String.replace.
//  - the map plate is exactly 1080x1600, so the web's aspectRatio carries verbatim;
//    resizeMode cover is pixel-identical to the web's object-fit cover at that box.
import { useMemo } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FOLIOS } from '@shared/orders';
import { useUi } from '@/state/ui';
import { useSave } from '@/state/save';
import { audio } from '@/platform/audio';
import { useDisplaySettings } from '@/platform/display';
import { fonts, palette, themeFor, type as typeScale } from '@/theme/tokens';
import { i18n, tf } from '@/i18n';
import { images } from '@/theme/assets';
import Ribbon from '@/ui/Ribbon';

// node positions in % of the plate (matches manifest folio-map record)
const NODES = [
  { x: 50, y: 12 }, { x: 72, y: 22 }, { x: 78, y: 45 },
  { x: 66, y: 64 }, { x: 50, y: 74 }, { x: 33, y: 64 },
  { x: 22, y: 45 }, { x: 28, y: 22 }, { x: 50, y: 42 },
];

export default function FolioMap() {
  const go = useUi((s) => s.go);
  const save = useSave((s) => s.save);
  const display = useDisplaySettings();
  const theme = useMemo(
    () => themeFor({ contrast: display.contrast, text: display.text }),
    [display.contrast, display.text],
  );
  const insets = useSafeAreaInsets();
  const fs = typeScale(theme.textScale);

  if (!save) return null;
  const done = save.campaign.folioIdx * 3 + save.campaign.duelIdx;

  return (
    <View style={[styles.root, { backgroundColor: theme.bg }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
          {/* browser-default h1: 2em x the 15px body -> 2 * fs.md, display face, 0.02em */}
          <Text
            accessibilityRole="header"
            style={[styles.title, { color: theme.fg, fontSize: 2 * fs.md, letterSpacing: 0.02 * 2 * fs.md }]}
          >
            {i18n.hub.folios}
          </Text>
          <Text style={[styles.sub, { color: theme.fgDim, fontSize: fs.md }]}>
            {tf('hub.foliosSub', { done })}
          </Text>
        </View>

        {/* web width min(94vw, 420px), margin '8px auto', aspectRatio 1080/1600 */}
        <View style={styles.plate}>
          <Image
            source={images.folioMap}
            resizeMode="cover"
            accessibilityLabel="The walled city of Novem"
            style={[StyleSheet.absoluteFill, { borderColor: theme.lineStrong }]}
          />
          {NODES.map((n, i) => {
            const locked = i > save.campaign.folioIdx;
            const current = i === save.campaign.folioIdx;
            const isDone = i < save.campaign.folioIdx;
            const frameColor = isDone ? palette.brass : current ? palette.oxblood : theme.lineStrong;
            const nodeInk = locked ? theme.lineStrong : isDone ? palette.brass : palette.parchmentLight;
            return (
              // absolute %-positioned wrapper; the child self-offsets -22,-22 =
              // the web's translate(-50%,-50%) for a fixed 44x44 node
              <View key={i} style={[styles.nodeWrap, { left: `${n.x}%`, top: `${n.y}%` }]}>
                <Pressable
                  disabled={locked}
                  accessibilityRole="button"
                  accessibilityLabel={`Folio ${FOLIOS[i].numeral}${locked ? ' (locked)' : ''}`}
                  onPress={() => {
                    audio.uiTap();
                    go('folioDetail', {
                      campaignDuel: {
                        folio: i,
                        duel: save.campaign.folioIdx === i ? save.campaign.duelIdx : 0,
                      },
                    });
                  }}
                  style={[
                    styles.node,
                    {
                      marginLeft: -22,
                      marginTop: -22,
                      borderColor: frameColor,
                      backgroundColor: locked ? theme.bgSunken : theme.bgRaised,
                      opacity: locked ? 0.5 : 1,
                    },
                  ]}
                >
                  <Text style={[styles.nodeText, { color: nodeInk, fontSize: fs.md }]}>
                    {locked ? '✕' : FOLIOS[i].numeral}
                  </Text>
                </Pressable>
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
  // web header padding 'calc(var(--safe-top) + 14px) 16px 6px', textAlign center
  header: { alignItems: 'center', paddingHorizontal: 16, paddingBottom: 6 },
  title: { fontFamily: fonts.display },
  sub: { fontFamily: fonts.bodyItalic, textAlign: 'center' },
  plate: {
    width: '94%',
    maxWidth: 420,
    aspectRatio: 1080 / 1600,
    alignSelf: 'center',
    marginVertical: 8,
    borderWidth: 2,
    overflow: 'hidden',
  },
  nodeWrap: { position: 'absolute' },
  // web 44x44 circle, 2px border, min 44 touch guard — the -22 offsets ride inline
  node: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nodeText: { fontFamily: fonts.display },
});
