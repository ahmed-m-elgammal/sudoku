// CabinetScreen — S15: tabs (Board Themes, Seal Waxes, Frames, Numerals, Claim
// Stamps, Victory Banners), shop with Ink/Sigil pricing, preview, equip; the
// Patron's Pouch stays a payments stub, TODO(T5) (specs/17 phase 5.4).
//
// PORT of ../src/app/game/CabinetScreen.tsx (177 lines). The 26-item table, the
// tab→slot law and the buy/equip laws live in cabinetLaw.ts so the gate can pin
// them; the preview art rides cabinetArt.ts (the Metro-only seam — literal
// requires, mockable in tests, the duelAssets.ts law drawn one file thinner).
//
// Translation notes (the AGENTS.md platform table, nothing more):
//  - `synth.uiTap()/reliquary()/error()` → `audio.*` — the web's own call sites;
//  - the 2-col CSS grid becomes chunked rows of two flex:1 cards (the hub's
//    `pair` translation — the same 1fr 1fr geometry);
//  - the 36/40 px web buttons rise to the 44 pt floor (layout.touch) — the
//    fidelity table's only sanctioned touch fix, as on the shelf's chits;
//  - the preview panel is the web's floating dialog, NOT a scrim sheet: it hugs
//    its own bounds (left/right 16, above the ribbon), the ribbon and the grid
//    stay tappable behind it, exactly as on the web; hardware back still pops
//    the screen (the shell's goBack) — the web has no back key to match;
//  - the web's `alert('TODO(T5): …')` → `Alert.alert` with the same single line,
//    the DailyScreen's Offer-a-Candle translation;
//  - the price labels compose from the dictionary (i18n.common.ink/sigils) as the
//    web composes them; the pouch button's label and its TODO(T5) alert are the
//    web screen's own literals (CabinetScreen.tsx:170-171) — carried verbatim;
//  - a purchase's ledger entry keeps the web's T13 shape: mode 'spend', negative
//    delta, `spend-{id}-{now36}` — and only for Ink (the Sigil path records no
//    entry, CabinetScreen.tsx:79-87).
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SvgUri } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSave } from '@/state/save';
import { audio } from '@/platform/audio';
import { useDisplaySettings } from '@/platform/display';
import { recordInk } from '@/state/inkLedger';
import { fonts, layout, palette, themeFor, type as typeScale } from '@/theme/tokens';
import { i18n } from '@/i18n';
import Ribbon from '@/ui/Ribbon';
import {
  buyItem, CABINET_ITEMS, CABINET_TABS, equipItem, equipKeyFor, spendDuelId,
  type CabinetTab, type CosmeticItem,
} from './cabinetLaw';
import { cabinetArtUri } from './cabinetArt';

// the web screen's own literals (CabinetScreen.tsx:170-171) — the dictionary has no keys for them
const POUCH_LABEL = 'Patron’s Pouch — 80 / 300 / 1000 Sigils';
const POUCH_ALERT = 'TODO(T5): payments are stubbed in this build. See /TODO.md.';

export default function CabinetScreen() {
  const save = useSave((s) => s.save);
  const display = useDisplaySettings();
  const theme = useMemo(
    () => themeFor({ contrast: display.contrast, text: display.text }),
    [display.contrast, display.text],
  );
  const insets = useSafeAreaInsets();
  const fs = typeScale(theme.textScale);
  const [tab, setTab] = useState<CabinetTab>('boards');
  const [preview, setPreview] = useState<CosmeticItem | null>(null);
  if (!save) return null;

  const items = CABINET_ITEMS.filter((i) => i.tab === tab);
  const slot = equipKeyFor(tab);
  const equippedId = save.cosmetics.equipped[slot];

  const switchTab = (t: CabinetTab) => {
    audio.uiTap();
    setTab(t);
    setPreview(null);
  };

  const buy = (item: CosmeticItem) => {
    const cur = useSave.getState().save;
    if (!cur) return;
    if (cur.cosmetics.owned.includes(item.id)) return; // the web's silent guard (CabinetScreen.tsx:71)
    const bought = buyItem(cur, item);
    if (!bought) {
      audio.error();
    } else {
      useSave.getState().update((s) => ({
        ...s,
        economy: { ...s.economy, ink: bought.economy.ink, sigils: bought.economy.sigils },
        cosmetics: { ...s.cosmetics, owned: bought.owned },
      }));
      // T13 — a spend is a negative ledger delta: the server-known balance tracks it.
      // Ink only — the Sigil path records no entry (the web's own call sites).
      if (bought.spent === 'ink') {
        recordInk({ duelId: spendDuelId(item.id, Date.now()), mode: 'spend', delta: -item.price });
      }
      audio.reliquary();
    }
    setPreview(null);
  };

  const equip = (item: CosmeticItem) => {
    audio.uiTap();
    const next = equipItem(useSave.getState().save!, slot, item.id);
    useSave.getState().update((s) => ({ ...s, cosmetics: next }));
  };

  // web ul: 2-col grid → rows of two flex:1 cards
  const rows: CosmeticItem[][] = [];
  for (let i = 0; i < items.length; i += 2) rows.push(items.slice(i, i + 2));

  const priceLabel = (it: CosmeticItem) =>
    it.currency === 'sigil' ? `${it.price} ${i18n.common.sigils}` : `${it.price} ${i18n.common.ink}`;

  return (
    <View style={[styles.root, { backgroundColor: theme.bg }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* web header: padding 'calc(safe-top + 14px) 16px 6px', center */}
        <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
          <Text accessibilityRole="header" style={[styles.title, { color: theme.fg, fontSize: fs.lg }]}>
            {i18n.cabinet.title}
          </Text>
          <View style={styles.purse}>
            <SvgUri uri={cabinetArtUri('/assets/icons/ink-drop.svg')} width={13} height={13} />
            <Text style={[styles.purseText, { color: theme.fgDim, fontSize: fs.md }]}>{save.economy.ink}</Text>
            <Text style={[styles.purseText, { color: theme.fgDim, fontSize: fs.md }]}>·</Text>
            <SvgUri uri={cabinetArtUri('/assets/icons/sigil-coin.svg')} width={13} height={13} />
            <Text style={[styles.purseText, { color: theme.fgDim, fontSize: fs.md, marginLeft: 8 }]}>
              {save.economy.sigils}
            </Text>
          </View>
        </View>

        {/* web div[role=tablist]: flex, overflowX auto, gap 6, padding '4px 16px' */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabRow}>
          {CABINET_TABS.map((t) => {
            const active = tab === t;
            return (
              <Pressable
                key={t}
                accessibilityRole="tab"
                accessibilityLabel={i18n.cabinet.tabs[t]}
                accessibilityState={{ selected: active }}
                onPress={() => switchTab(t)}
                style={[
                  styles.tab,
                  { borderColor: active ? palette.brass : theme.lineStrong, opacity: active ? 1 : 0.85 },
                ]}
              >
                <Text style={[styles.tabText, { color: active ? palette.brass : theme.fgDim, fontSize: fs.sm }]}>
                  {i18n.cabinet.tabs[t]}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* web ul: grid 1fr 1fr, gap 10, padding '10px 16px' */}
        <View style={styles.grid}>
          {rows.map((row, ri) => (
            <View key={ri} style={styles.row}>
              {row.map((it) => {
                const owned = save.cosmetics.owned.includes(it.id) || it.currency === 'owned';
                const equipped = equippedId === it.id;
                return (
                  // web li.panel: padding 10, textAlign center
                  <View
                    key={it.id}
                    style={[styles.card, { backgroundColor: theme.bgRaised, borderColor: theme.lineStrong }]}
                  >
                    <View style={[styles.ring, { borderColor: theme.line }]} pointerEvents="none" />
                    {cabinetArtUri(it.preview) ? (
                      <View style={[styles.art, { borderColor: theme.line }]}>
                        <SvgUri uri={cabinetArtUri(it.preview)} width={64} height={64} />
                      </View>
                    ) : null}
                    <Text style={[styles.cardName, { color: theme.fg, fontSize: fs.sm }]}>{it.name}</Text>
                    <Text style={[styles.cardDesc, { color: theme.fgDim, fontSize: fs.xs }]}>{it.desc}</Text>
                    {owned ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`${equipped ? i18n.common.equipped : i18n.common.equip}: ${it.name}`}
                        disabled={equipped}
                        onPress={() => equip(it)}
                        style={[styles.cardBtn, { borderColor: palette.brassDim, opacity: equipped ? 0.45 : 1 }]}
                      >
                        <Text style={[styles.cardBtnText, { color: theme.fg, fontSize: fs.xs }]}>
                          {equipped ? i18n.common.equipped : i18n.common.equip}
                        </Text>
                      </Pressable>
                    ) : (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`${priceLabel(it)}: ${it.name}`}
                        onPress={() => setPreview(it)}
                        style={[styles.cardBtn, styles.cardBtnGhost, { borderColor: theme.lineStrong }]}
                      >
                        <Text style={[styles.cardBtnText, { color: theme.fg, fontSize: fs.xs }]}>
                          {priceLabel(it)}
                        </Text>
                      </Pressable>
                    )}
                  </View>
                );
              })}
            </View>
          ))}
        </View>

        {/* the Patron's Pouch — payments stay stubbed (spec §11, TODO T5) */}
        <View style={[styles.pouch, { backgroundColor: theme.bgRaised, borderColor: theme.lineStrong }]}>
          <View style={[styles.ring, { borderColor: theme.line }]} pointerEvents="none" />
          <Text style={[styles.pouchTitle, { color: theme.fg, fontSize: fs.md }]}>{i18n.cabinet.patron}</Text>
          <Text style={[styles.pouchNote, { color: theme.fgDim, fontSize: fs.sm }]}>{i18n.cabinet.patronNote}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={POUCH_LABEL}
            onPress={() => Alert.alert(POUCH_ALERT)}
            style={[styles.pouchBtn, { borderColor: theme.lineStrong }]}
          >
            <Text style={[styles.cardBtnText, { color: theme.fg, fontSize: fs.sm }]}>{POUCH_LABEL}</Text>
          </Pressable>
        </View>
      </ScrollView>

      <Ribbon />

      {/* the preview — the web's floating panel, not a scrim sheet: the ribbon and
          grid stay tappable behind it (CabinetScreen.tsx:154-165) */}
      {preview && (
        <View
          accessibilityLabel={preview.name}
          style={[
            styles.preview,
            { backgroundColor: theme.bgRaised, borderColor: theme.lineStrong, bottom: insets.bottom + 70 },
          ]}
        >
          <View style={[styles.ring, { borderColor: theme.line }]} pointerEvents="none" />
          <Text accessibilityRole="header" style={[styles.previewTitle, { color: theme.fg, fontSize: fs.xl }]}>
            {preview.name}
          </Text>
          <Text style={[styles.previewDesc, { color: theme.fgDim, fontSize: fs.md }]}>{preview.desc}</Text>
          <View style={styles.previewActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${i18n.common.buy}: ${preview.name}`}
              onPress={() => buy(preview)}
              style={[styles.previewBtn, styles.previewBtnPrimary, { borderColor: palette.brass }]}
            >
              <Text style={[styles.previewBtnText, { color: palette.parchmentLight, fontSize: fs.md }]}>
                {i18n.common.buy} — {priceLabel(preview)}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={i18n.common.close}
              onPress={() => setPreview(null)}
              style={[styles.previewBtn, { borderColor: palette.brassDim, backgroundColor: palette.charcoal }]}
            >
              <Text style={[styles.previewBtnText, { color: theme.fg, fontSize: fs.md }]}>{i18n.common.close}</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingBottom: 16 },
  header: { alignItems: 'center', paddingHorizontal: 16, paddingBottom: 6 },
  title: { fontFamily: fonts.display },
  purse: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  purseText: { fontFamily: fonts.digit },
  tabRow: { flexDirection: 'row', gap: 6, paddingHorizontal: 16, paddingVertical: 4 },
  // web tab button: border 1, padding '6px 10px', minHeight 40 → 44 floor, radius 3, nowrap
  tab: {
    borderWidth: 1,
    borderRadius: 3,
    paddingHorizontal: 10,
    paddingVertical: 6,
    minHeight: layout.touch,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabText: { fontFamily: fonts.display, flexShrink: 0 },
  grid: { gap: 10, paddingHorizontal: 16, paddingVertical: 10 },
  row: { flexDirection: 'row', gap: 10 },
  // web li.panel: padding 10, center
  card: {
    flex: 1,
    alignItems: 'center',
    padding: 10,
    borderWidth: 1,
    borderRadius: layout.radius,
  },
  // web .panel::before: absolute inset 4, 1px var(--line), radius 2
  ring: { position: 'absolute', top: 4, left: 4, right: 4, bottom: 4, borderWidth: 1, borderRadius: 2 },
  // web img: 64x64, margin '0 auto 6px', 1px var(--line) border
  art: { borderWidth: 1, marginBottom: 6 },
  cardName: { fontFamily: fonts.display },
  cardDesc: { fontFamily: fonts.body, minHeight: 26, textAlign: 'center' },
  // web .btn: width 100%, minHeight 36 → 44 floor, fontSize xs; ghost = transparent ground
  cardBtn: {
    width: '100%',
    minHeight: layout.touch,
    borderWidth: 1.5,
    borderRadius: layout.radius,
    backgroundColor: palette.charcoal,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  cardBtnGhost: { borderWidth: 1, backgroundColor: 'transparent' },
  cardBtnText: { fontFamily: fonts.display },
  // web section.panel: margin '10px 16px', padding 14
  pouch: { marginTop: 10, marginHorizontal: 16, padding: 14, borderWidth: 1, borderRadius: layout.radius },
  pouchTitle: { fontFamily: fonts.display },
  pouchNote: { fontFamily: fonts.body, marginTop: 2 },
  pouchBtn: {
    marginTop: 8,
    minHeight: layout.touch,
    borderWidth: 1,
    borderRadius: layout.radius,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  // web preview: position fixed, inset 'auto 16px calc(safe-bottom + 70px)', zIndex 50, padding 16
  preview: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 50,
    padding: 16,
    borderWidth: 1,
    borderRadius: layout.radius,
  },
  previewTitle: { fontFamily: fonts.display },
  previewDesc: { fontFamily: fonts.body, marginTop: 2 },
  previewActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  previewBtn: {
    flex: 1,
    minHeight: layout.touch,
    borderWidth: 1.5,
    borderRadius: layout.radius,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  previewBtnPrimary: { backgroundColor: palette.charcoal },
  previewBtnText: { fontFamily: fonts.display },
});
