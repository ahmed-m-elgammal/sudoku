// ReliquaryScreen — S10: the 4 s chest ritual (8 engraved frames at 500 ms), the
// item card with its rarity border, and the duplicate law (+40 Ink, granted once).
//
// PORT of ../src/app/game/ReliquaryScreen.tsx (98 lines). The drop table, the odds
// and the award law live in reliquaryLaw.ts so the gate can pin them — this screen's
// module-scope SVG requires are Metro-only, the documented split of proof.
//
// Translation notes (the AGENTS.md platform table, nothing more):
//  - the chest <img> sequence rides SvgUri over the 8 bundled frames, same 500 ms
//    cadence, same 4 s finish; the web's `ink-settle` entry class is page chrome no
//    mobile screen animates yet (the ResultScreen port's standing decision);
//  - `synth.reliquary()` → `audio.reliquary()` — the one-shot the web synth carries
//    and the baseline backend now honours;
//  - `<b>` on the rates line → the bold cut of the digit face (RN cannot synthesize
//    weights for the registered serif; the tokens file registers digitBold for this);
//  - REPORTED DEFECTS (web build, inherited here — report, do not fix):
//      (a) nothing in the web build ever routes to 'reliquary' — DuelScreen sets
//          lastResult.reliquaryWon and ResultScreen says "the wax is warm", but no
//          go('reliquary') exists anywhere in src/ or its history. The port
//          reproduces the shipped wiring exactly.
//      (b) 13 of the 15 DROP_TABLE art files do not exist in ../public/assets
//          (only stamp-laurel / stamp-crown resolve); the web <img> renders an
//          empty broken image. The port maps only the two files that exist and
//          degrades the rest identically — no art, the rarity + name still tell.
import { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SvgUri } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUi } from '@/state/ui';
import { useSave } from '@/state/save';
import { audio } from '@/platform/audio';
import { useDisplaySettings } from '@/platform/display';
import { recordInk } from '@/state/inkLedger';
import { fonts, layout, palette, themeFor, type as typeScale } from '@/theme/tokens';
import { i18n } from '@/i18n';
import { reliquaryAward, rarityBorderColor, rollItem, type ReliquaryItem } from './reliquaryLaw';

// Metro needs literal requires (see duelAssets.ts for the resolveAssetSource law);
// frame 0..7 of the ritual — array order IS chestAssetName(i) (pinned by the law test).
const CHEST_FRAMES = [
  require('../../../assets/game/reliquary/chest-closed.svg'), // 0 — the web's 'closed'
  require('../../../assets/game/reliquary/chest-opening-1.svg'),
  require('../../../assets/game/reliquary/chest-opening-2.svg'),
  require('../../../assets/game/reliquary/chest-opening-3.svg'),
  require('../../../assets/game/reliquary/chest-opening-4.svg'),
  require('../../../assets/game/reliquary/chest-opening-5.svg'),
  require('../../../assets/game/reliquary/chest-opening-6.svg'),
  require('../../../assets/game/reliquary/chest-open.svg'),   // 7 — the web's 'open'
] as const;

// The drop table's art, by id — the web address maps kind→dir (seals, seals/stamps,
// ui, textures), and only these two files actually exist in the shipped assets.
const ITEM_ART: Record<string, number> = {
  'stamp-laurel': require('../../../assets/game/seals/stamps/stamp-laurel.svg'),
  'stamp-crown': require('../../../assets/game/seals/stamps/stamp-crown.svg'),
};

export default function ReliquaryScreen() {
  const go = useUi((s) => s.go);
  const save = useSave((s) => s.save);
  const display = useDisplaySettings();
  const theme = useMemo(
    () => themeFor({ contrast: display.contrast, text: display.text }),
    [display.contrast, display.text],
  );
  const insets = useSafeAreaInsets();
  const fs = typeScale(theme.textScale);
  const [frame, setFrame] = useState(0);
  const [item, setItem] = useState<ReliquaryItem | null>(null);
  const [duplicate, setDuplicate] = useState(false);

  useEffect(() => {
    const iv = setInterval(() => setFrame((f) => Math.min(7, f + 1)), 500);
    audio.reliquary();
    const finish = setTimeout(() => {
      const owned = useSave.getState().save?.cosmetics.owned ?? [];
      const it = rollItem(Math.random());
      if (!it) return;
      setItem(it);
      // the award law, once: duplicate → +40 Ink; new → owned + progress reset
      const award = reliquaryAward(it, owned);
      setDuplicate(award.duplicate);
      if (award.duplicate) {
        useSave.getState().update((s) => ({ ...s, economy: { ...s.economy, ink: s.economy.ink + award.ink } }));
        recordInk({ duelId: `reliquary-${it.id}-${Date.now().toString(36)}`, mode: 'reliquary', delta: award.ink });
      } else {
        useSave.getState().update((s) => ({
          ...s,
          economy: { ...s.economy, reliquaryProgress: 0 },
          cosmetics: { ...s.cosmetics, owned: [...s.cosmetics.owned, it.id] },
        }));
      }
    }, 4000);
    return () => { clearInterval(iv); clearTimeout(finish); };
  }, []);

  if (!save) return null;
  const rarityBorder = rarityBorderColor(item?.rarity);
  const chestUri =
    Image.resolveAssetSource(CHEST_FRAMES[Math.min(frame, CHEST_FRAMES.length - 1)])?.uri ?? '';
  const itemArtUri =
    item && item.id in ITEM_ART ? Image.resolveAssetSource(ITEM_ART[item.id])?.uri ?? '' : '';

  return (
    <View
      style={[styles.root, { backgroundColor: theme.bg, paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}
    >
      <View style={styles.center}>
        <Text
          accessibilityRole="header"
          style={[styles.title, { color: theme.fg, fontSize: fs.lg, marginBottom: 14 }]}
        >
          {i18n.reliquary.title}
        </Text>
        {!item ? (
          <>
            <SvgUri uri={chestUri} width={180} height={180} />
            <Text style={[styles.ritual, { color: theme.fgDim, fontSize: fs.sm, marginTop: 10 }]}>
              {i18n.reliquary.ritual}
            </Text>
          </>
        ) : (
          <>
            {/* the item card — 2.5 px rarity border, radius 4, charcoal ground, maxWidth 300 */}
            <View style={[styles.itemCard, { borderColor: rarityBorder, backgroundColor: theme.bgRaised }]}>
              <Text style={[styles.rarity, { color: theme.fgDim, fontSize: fs.xs, letterSpacing: 0.2 * fs.xs }]}>{item.rarity.toUpperCase()}</Text>
              {itemArtUri ? (
                <View style={[styles.artFrame, { borderColor: theme.lineStrong }]}>
                  <SvgUri uri={itemArtUri} width={120} height={120} />
                </View>
              ) : null}
              <Text style={[styles.itemName, { color: theme.fg, fontSize: fs.xl }]}>{item.name}</Text>
              {duplicate && (
                <Text style={[styles.duplicate, { color: palette.brass, fontSize: fs.sm }]}>
                  {i18n.reliquary.duplicate} +40 {i18n.common.ink}
                </Text>
              )}
            </View>
            <View style={styles.actions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={i18n.common.continue}
                onPress={() => go('antechamber')}
                style={({ pressed }) => [styles.primary, { opacity: pressed ? 0.82 : 1 }]}
              >
                <Text style={[styles.btnText, { color: palette.parchmentLight, fontSize: fs.md }]}>
                  {i18n.common.continue}
                </Text>
              </Pressable>
            </View>
            <Text style={[styles.rates, { color: theme.fgDim, fontSize: fs.xs }]}>
              <Text style={{ fontFamily: fonts.digitBold }}>{i18n.reliquary.rates}: </Text>
              {i18n.reliquary.ratesBody}
            </Text>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  // web main: display grid, placeItems center, padding 20 — one centred column
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  title: { fontFamily: fonts.display },
  ritual: { fontFamily: fonts.bodyItalic, textAlign: 'center' },
  itemCard: { borderWidth: 2.5, borderRadius: layout.radius, padding: 18, width: '100%', maxWidth: 300, alignItems: 'center' },
  rarity: { fontFamily: fonts.body },
  artFrame: { borderWidth: 1, marginTop: 10 },
  itemName: { fontFamily: fonts.display, marginTop: 8, textAlign: 'center' },
  duplicate: { fontFamily: fonts.bodyItalic, marginTop: 4, textAlign: 'center' },
  actions: { flexDirection: 'row', gap: 8, justifyContent: 'center', marginTop: 16 },
  // web .btn.btn-primary
  primary: {
    minHeight: layout.touch,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderColor: palette.brass,
    borderRadius: layout.radius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: { fontFamily: fonts.display },
  // web rates p: marginTop 16, maxWidth 320, centered
  rates: { fontFamily: fonts.body, marginTop: 16, maxWidth: 320, textAlign: 'center' },
});
