// OrderSelect — S04: horizontal snap carousel of four tarot cards; locked orders show
// conditions.
//
// PORT of ../src/app/game/OrderSelect.tsx. The lock state is READ FROM THE SAVE
// (`save.unlockedOrders`, written only by DuelScreen.finish on the Folio II / Folio IV
// clears — spec 3.2); this screen never re-derives it. Picking an Order only stages
// locally; `Take this Order` writes `save.order` and routes on with the duel mode this
// screen was opened under (practice stays practice, everything else becomes a shade).
//
// Translation notes (the AGENTS.md platform table, nothing more):
//  - `scroll-snap-type: x mandatory` + `scroll-snap-align: center` becomes a
//    horizontal ScrollView: snapToInterval = 240px card + 14px gap, center snap
//    alignment, fast deceleration — the same one-card-centers feel.
//  - the Q/W/E kbd letters stay: the duel's AbilityBar already carries them (the
//    AGENTS.md key law scopes hardware-key INPUT to iPad; the label is the web's).
//  - 'after Folio II' / 'after Folio IV' are web component literals
//    (OrderSelect.tsx:59). The dictionary's `orders.lockedFormat` exists but the web
//    build never reads it, so the port carries the literals verbatim rather than
//    diverging the frozen en.json (same law as the Ribbon's tab labels).
//  - the Take routing's `mode === 'practice' ? 'matchmaking' : 'matchmaking'`
//    ternary is the web build's own quirk — both arms go to matchmaking (web:73).
//    Ported verbatim; reported, not repaired (AGENTS.md: report defects).
//  - web `<b>` asks for weight 700 on a face with no bold cut loaded (IM Fell), so it
//    already degrades to regular there; the nested Text does the same here.
//  - order portraits are exactly 4:5 (512x640) inside the web's 200x250 box, so
//    resizeMode cover is pixel-identical to the web's default fill.
import { useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SvgUri } from 'react-native-svg';
import { ORDERS, type OrderMeta } from '@shared/orders';
import { useUi } from '@/state/ui';
import { useSave } from '@/state/save';
import { audio } from '@/platform/audio';
import { useDisplaySettings } from '@/platform/display';
import { fonts, layout, palette, themeFor, type as typeScale } from '@/theme/tokens';
import { i18n } from '@/i18n';
import { imageForPath } from '@/theme/assets';
import { sigilSvg } from '@/ui/duel/duelAssets';
import Ribbon from '@/ui/Ribbon';

// web 240px card + 14px gap — the snap interval
const CARD_W = 240;
const CARD_GAP = 14;

/** i18n.orders[o.id].abilities[a.id] — strict TS cannot prove a given ability id
 *  inside THIS order's three keys across the four-order union, so the lookup runs
 *  through one typed accessor. Zero runtime difference from the web's indexing. */
const abilityCopy = (o: OrderMeta, id: string): { name: string; desc: string } =>
  (i18n.orders[o.id].abilities as Record<string, { name: string; desc: string }>)[id];

export default function OrderSelect() {
  const go = useUi((s) => s.go);
  const duelMode = useUi((s) => s.duelMode);
  const save = useSave((s) => s.save);
  const display = useDisplaySettings();
  const theme = useMemo(
    () => themeFor({ contrast: display.contrast, text: display.text }),
    [display.contrast, display.text],
  );
  const insets = useSafeAreaInsets();
  const fs = typeScale(theme.textScale);
  // web:14 — the hook reads the save before the null check below (hook order first).
  const [chosen, setChosen] = useState(save?.order ?? 'scholar');

  if (!save) return null;

  return (
    <View style={[styles.root, { backgroundColor: theme.bg }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
          {/* browser-default h1: 2em x the 15px body -> 2 * fs.md, display face, 0.02em */}
          <Text
            accessibilityRole="header"
            style={[styles.title, { color: theme.fg, fontSize: 2 * fs.md, letterSpacing: 0.02 * 2 * fs.md }]}
          >
            {i18n.orders.select}
          </Text>
          <Text style={[styles.sub, { color: theme.fgDim, fontSize: fs.md }]}>
            {i18n.orders.selectSub}
          </Text>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={CARD_W + CARD_GAP}
          snapToAlignment="center"
          decelerationRate="fast"
          contentContainerStyle={styles.carousel}
        >
          {ORDERS.map((o) => {
            const locked = !save.unlockedOrders.includes(o.id);
            const selected = chosen === o.id;
            const portrait = imageForPath(o.portrait);
            return (
              <Pressable
                key={o.id}
                accessibilityRole="button"
                accessibilityLabel={o.name}
                accessibilityState={{ selected }}
                onPress={() => {
                  audio.uiTap();
                  if (!locked) setChosen(o.id);
                }}
                style={[
                  styles.card,
                  {
                    backgroundColor: theme.bgRaised,
                    borderColor: selected ? palette.brass : theme.lineStrong,
                    opacity: locked ? 0.55 : 1,
                  },
                ]}
              >
                <View style={[styles.portraitFrame, { borderColor: theme.lineStrong }]}>
                  {portrait ? (
                    <Image
                      source={portrait}
                      resizeMode="cover"
                      style={styles.portrait}
                      accessibilityLabel={o.name}
                    />
                  ) : null}
                </View>
                <Text style={[styles.orderName, { color: theme.fg, fontSize: fs.lg, letterSpacing: 0.02 * fs.lg }]}>
                  {o.name}
                </Text>
                <Text style={[styles.epithet, { color: palette.brass, fontSize: fs.xs, letterSpacing: 0.12 * fs.xs }]}>
                  {o.epithet}
                </Text>
                <Text style={[styles.passive, { color: theme.fg, fontSize: fs.sm }]}>
                  <Text style={styles.bold}>{i18n.orders.passive}:</Text> {i18n.orders[o.id].passive}
                </Text>
                <View style={styles.abilities}>
                  {o.abilities.map((a, i) => {
                    const sigil = sigilSvg(a.icon);
                    const copy = abilityCopy(o, a.id);
                    return (
                      <View key={a.id} style={styles.ability}>
                        {sigil ? <SvgUri uri={sigil} width={22} height={22} /> : null}
                        <Text style={[styles.abilityText, { color: theme.fg, fontSize: fs.sm }]}>
                          <Text style={styles.bold}>{copy.name}</Text> · {copy.desc}
                        </Text>
                        <Text style={[styles.kbd, { color: theme.lineStrong, fontSize: fs.sm }]}>
                          {['Q', 'W', 'E'][i]}
                        </Text>
                      </View>
                    );
                  })}
                </View>
                {locked && (
                  <Text style={[styles.locked, { color: palette.oxblood, fontSize: fs.sm }]}>
                    {i18n.common.locked} — {o.unlockAfter === 'folio-2' ? 'after Folio II' : 'after Folio IV'}
                  </Text>
                )}
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.takeRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={i18n.orders.take}
            onPress={() => {
              audio.stamp();
              useSave.getState().update((s) => ({ ...s, order: chosen }));
              const mode = duelMode === 'practice' ? 'practice' : 'shade';
              // web:73 verbatim — the web's own ternary always lands on matchmaking.
              go(mode === 'practice' ? 'matchmaking' : 'matchmaking', { duelMode: mode });
            }}
            style={({ pressed }) => [
              styles.takeBtn,
              { backgroundColor: theme.bgRaised, opacity: pressed ? 0.82 : 1 },
            ]}
          >
            <Text style={[styles.takeText, { color: palette.parchmentLight, fontSize: fs.md, letterSpacing: 0.06 * fs.md }]}>
              {i18n.orders.take}
            </Text>
          </Pressable>
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
  // web .order-carousel: flex, gap 14, padding '14px 24px 10px'
  carousel: { gap: CARD_GAP, paddingLeft: 24, paddingRight: 24, paddingTop: 14, paddingBottom: 10 },
  // web .panel.order-card: bg-raised, 1px line-strong, radius, 240px, padding 14
  card: {
    width: CARD_W,
    padding: 14,
    borderWidth: 1,
    borderRadius: layout.radius,
    alignItems: 'center',
  },
  // web img 200x250, borderRadius 3, 1px line-strong
  portraitFrame: { width: 200, height: 250, borderRadius: 3, borderWidth: 1, overflow: 'hidden' },
  portrait: { width: '100%', height: '100%' },
  orderName: { fontFamily: fonts.display, marginTop: 8, textAlign: 'center' }, // h2: 0.02em rides inline
  epithet: { fontFamily: fonts.body, textAlign: 'center' }, // 0.12em rides inline
  passive: { fontFamily: fonts.bodyItalic, marginVertical: 6, textAlign: 'center' },
  bold: { fontWeight: '700' },
  // web ul: grid gap 4, fs-sm, text left
  abilities: { gap: 4, alignSelf: 'stretch' },
  ability: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  abilityText: { fontFamily: fonts.body, flex: 1 },
  kbd: { fontFamily: fonts.digit, marginLeft: 'auto' },
  locked: { fontFamily: fonts.body, marginTop: 8, textAlign: 'center' },
  // web .btn.btn-primary, place-items center, padding '8px 0 20px'
  takeRow: { alignItems: 'center', paddingTop: 8, paddingBottom: 20 },
  takeBtn: {
    minHeight: layout.touch,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderColor: palette.brass,
    borderRadius: layout.radius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  takeText: { fontFamily: fonts.display }, // 0.06em rides inline
});
