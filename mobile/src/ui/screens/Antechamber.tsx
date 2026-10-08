// Antechamber — S03 home hub: header (portrait, name, rank emblem, Ink/Sigils),
// hero card, Daily / Folios / Season / Friend / Practice / Echoes / Endless / Weekly
// cards, the G13 "Relearn the Reckoning" tutorial replay row, the ⚙ gear, and the
// Ribbon at the bottom.
//
// PORT of ../src/app/game/Antechamber.tsx (102 lines). Every card shows the REAL save
// state, read straight off useSave each render and never cached (spec 2.3 done-when).
// Translation notes (AGENTS.md table only): the web ribbon is position:fixed and .hub
// pads under it — here the Ribbon is the column's last child, same always-visible
// result. Copy fills go through i18n tf(); 'Standing' composes from i18n.result.rating
// and 'Your portrait' is a web aria-label literal, both carried verbatim. The portrait
// rides imageForPath, hero parchment + ink-drop ride svgUriFor; rank emblems, candles
// and sigil-coin are this screen's own literal requires (Metro bundling law). PERF:
// both subscriptions are selector-scoped (`go` is stable), stateless, effect-free —
// nothing to leak between duels or sessions.
import { useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SvgUri } from 'react-native-svg';
import type { ReactNode } from 'react';
import { useUi, type Screen } from '@/state/ui';
import { useSave } from '@/state/save';
import { audio } from '@/platform/audio';
import { useDisplaySettings } from '@/platform/display';
import { fonts, palette, themeFor, type as typeScale } from '@/theme/tokens';
import { i18n, tf } from '@/i18n';
import { imageForPath } from '@/theme/assets';
import { svgUriFor } from '@/ui/duel/duelAssets';
import { orderMeta } from '@shared/orders';
// todayUtcKey rides the @shared barrel (screens ban @shared/rng directly; this is the
// daily date-key util, not the engine). weekIndexFor is @shared/weekly — allowed.
import { todayUtcKey } from '@shared';
import { weekIndexFor, weeklyModDefs } from '@shared/weekly';
import Ribbon from '@/ui/Ribbon';
import { rankOfStanding } from './rank';
import { tutorialReplayPayload } from './replayEntry';

// Metro needs literal requires; these four are the hub's own chrome.
const RANK_EMBLEMS: Record<string, number> = {
  scrivener: require('../../../assets/game/ranks/rank-scrivener.svg'),
  clerk: require('../../../assets/game/ranks/rank-clerk.svg'),
  notary: require('../../../assets/game/ranks/rank-notary.svg'),
  advocate: require('../../../assets/game/ranks/rank-advocate.svg'),
  magistrate: require('../../../assets/game/ranks/rank-magistrate.svg'),
  'high-magistrate': require('../../../assets/game/ranks/rank-high-magistrate.svg'),
  justiciar: require('../../../assets/game/ranks/rank-justiciar.svg'),
  'lord-of-the-assize': require('../../../assets/game/ranks/rank-lord-of-the-assize.svg'),
};
const CANDLE_LIT = require('../../../assets/game/reliquary/candle-lit.svg');
const CANDLE_UNLIT = require('../../../assets/game/reliquary/candle-unlit.svg');
const SIGIL_COIN = require('../../../assets/game/icons/sigil-coin.svg');
const rankUri = (id: string) => Image.resolveAssetSource(RANK_EMBLEMS[id] ?? RANK_EMBLEMS.clerk)?.uri ?? '';
const candleUri = (lit: boolean) => Image.resolveAssetSource(lit ? CANDLE_LIT : CANDLE_UNLIT)?.uri ?? '';
const sigilCoinUri = Image.resolveAssetSource(SIGIL_COIN)?.uri ?? '';
const panelParchmentUri = svgUriFor('/assets/ui/panel-parchment.svg') ?? '';
const inkDropUri = svgUriFor('/assets/icons/ink-drop.svg') ?? '';

export default function Antechamber() {
  const go = useUi((s) => s.go);
  const save = useSave((s) => s.save);
  // G13 — the replay entry bumps the nonce so a re-entry always remounts the duel.
  const duelNonce = useUi((s) => s.duelNonce);
  const display = useDisplaySettings();
  const theme = useMemo(
    () => themeFor({ contrast: display.contrast, text: display.text }),
    [display.contrast, display.text],
  );
  const insets = useSafeAreaInsets();
  const fs = typeScale(theme.textScale);
  // every card is the web's inline `onClick={() => { synth.uiTap(); ui.go(...); }}`
  const tap = (s: Screen, payload?: Parameters<typeof go>[1]) => {
    audio.uiTap();
    go(s, payload);
  };
  // Wall-clock reads happen once per mount, in lazy state initialisers — the
  // render-purity seam the rest of this UI already uses (the hub remounts per
  // navigation, so both are as fresh as the web's per-render reads).
  const [todayKey] = useState(() => todayUtcKey());
  const [weekMods] = useState(() =>
    weeklyModDefs(weekIndexFor(Date.now())).map((m) => m.name).join(' + '),
  );

  if (!save) return null;
  const rank = rankOfStanding(save.standing);
  const folioDuels = save.campaign.folioIdx * 3 + save.campaign.duelIdx;
  const dailyDone = save.daily.lastDate === todayKey;
  const portrait = imageForPath(orderMeta(save.order).portrait);
  const foliosSub = save.campaign.ended
    ? tf('hub.foliosSettled', { ending: save.campaign.ending === 'burn' ? i18n.hub.endingBurned : i18n.hub.endingBalanced })
    : tf('hub.foliosSub', { done: folioDuels });

  return (
    <View style={[styles.root, { backgroundColor: theme.bg }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          {/* web `.portrait-chip`: 54x66, 2px brass-dim frame, cover, centre-top */}
          <View
            accessibilityLabel="Your portrait"
            style={[styles.portrait, { borderColor: palette.brassDim, backgroundColor: theme.bgRaised }]}
          >
            {portrait ? <Image source={portrait} style={styles.portraitImg} resizeMode="cover" /> : null}
          </View>
          <View style={styles.headerMain}>
            <Text
              numberOfLines={1}
              ellipsizeMode="tail"
              accessibilityRole="header"
              style={[styles.name, { color: theme.fg, fontSize: fs.lg }]}
            >
              {save.name}
            </Text>
            <View style={styles.rankRow}>
              <SvgUri uri={rankUri(rank.id)} width={18} height={18} />
              <Text style={[styles.rankText, { color: theme.fgDim, fontSize: fs.sm }]}>
                {rank.label} · {i18n.result.rating} {save.standing}
              </Text>
            </View>
          </View>
          <View style={styles.purse}>
            <View style={styles.currency}>
              <SvgUri uri={inkDropUri} width={14} height={14} />
              <Text style={[styles.currencyText, { color: theme.fg, fontSize: fs.sm }]}>{save.economy.ink}</Text>
            </View>
            <View style={styles.currency}>
              <SvgUri uri={sigilCoinUri} width={14} height={14} />
              <Text style={[styles.currencyText, { color: theme.fg, fontSize: fs.sm }]}>{save.economy.sigils}</Text>
            </View>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={i18n.settings.title}
            onPress={() => tap('settings')}
            style={styles.gear}
          >
            <Text style={{ color: theme.fgDim, fontSize: 18 }}>⚙</Text>
          </Pressable>
        </View>

        <View style={styles.cards}>
          {/* the hero card — parchment over charcoal, ink-dark type (web .panel.hero-card) */}
          <Pressable
            accessibilityRole="button"
            onPress={() => tap('matchmaking')}
            style={({ pressed }) => [
              styles.hero,
              { backgroundColor: theme.bgRaised, borderColor: palette.brassDim, opacity: pressed ? 0.9 : 1 },
            ]}
          >
            <SvgUri
              uri={panelParchmentUri}
              width="100%"
              height="100%"
              preserveAspectRatio="xMidYMid slice"
              style={StyleSheet.absoluteFill}
            />
            {/* web .panel::before — the engraved inner ring paints above the parchment,
                exactly where the positioned pseudo-element lands in the web's paint order */}
            <View style={[styles.panelRing, { borderColor: theme.line }]} pointerEvents="none" />
            <Text style={[styles.heroTitle, { color: palette.ink, fontSize: fs.xl, letterSpacing: 0.02 * fs.xl }]}>
              {i18n.hub.enter}
            </Text>
            <Text style={[styles.heroSub, { color: palette.parchmentDim, fontSize: fs.xs }]}>{i18n.hub.enterSub}</Text>
          </Pressable>

          <View style={styles.pair}>
            <HubCard
              theme={theme}
              fs={fs}
              title={i18n.hub.daily}
              sub={tf('hub.dailySub', { streak: save.daily.streak })}
              icon={<SvgUri uri={candleUri(dailyDone)} width={26} height={26} />}
              onPress={() => tap('daily')}
            />
            <HubCard
              theme={theme}
              fs={fs}
              title={i18n.hub.folios}
              sub={foliosSub}
              onPress={() => tap('folioMap')}
            />
          </View>
          <View style={styles.pair}>
            <HubCard
              theme={theme}
              fs={fs}
              title={i18n.hub.season}
              sub={tf('hub.seasonSub', { tier: Math.min(30, Math.floor(save.season.ink / 100) + 1), ink: save.season.ink })}
              onPress={() => tap('season')}
            />
            <HubCard
              theme={theme}
              fs={fs}
              title={i18n.hub.friend}
              sub={i18n.hub.friendSub}
              onPress={() => tap('friend')}
            />
          </View>
          {/* T7/T18/T21 — the shelf of echoes, the endless circuit, the weekly writs */}
          <HubCard
            theme={theme}
            fs={fs}
            title={i18n.hub.practice}
            sub={i18n.hub.practiceSub}
            onPress={() => tap('orders', { duelMode: 'practice' })}
          />
          <HubCard
            theme={theme}
            fs={fs}
            title={i18n.hub.echoes}
            sub={i18n.hub.echoesSub}
            onPress={() => tap('echoes')}
          />
          <HubCard
            theme={theme}
            fs={fs}
            title={i18n.hub.endless}
            sub={tf('hub.endlessSub', { rung: (save.endless?.current ?? 0) + 1, best: save.endless?.best ?? 0 })}
            onPress={() => tap('endless')}
          />
          <HubCard
            theme={theme}
            fs={fs}
            title={i18n.hub.weekly}
            sub={tf('hub.weeklySub', { mods: weekMods })}
            onPress={() => tap('weekly')}
          />
          {/* G13 — the lesson is re-playable from the hall: same shape as the G10
              rematch routing, so a replay remounts the duel with a fresh runtime. */}
          <HubCard
            theme={theme}
            fs={fs}
            title={i18n.tutorial.relearn}
            sub={i18n.tutorial.relearnSub}
            onPress={() => tap('tutorial', tutorialReplayPayload(duelNonce))}
          />
        </View>
      </ScrollView>
      <Ribbon />
    </View>
  );
}

/** One `.panel.card` — charcoal ground, line-strong frame, display title, dim sub. */
function HubCard({
  title,
  sub,
  icon,
  theme,
  fs,
  onPress,
}: {
  title: string;
  sub: string;
  icon?: ReactNode;
  theme: ReturnType<typeof themeFor>;
  fs: ReturnType<typeof typeScale>;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: theme.bgRaised, borderColor: theme.lineStrong, opacity: pressed ? 0.85 : 1 },
      ]}
    >
      {/* web .panel::before — the engraved inner ring, inset 4, 1px --line */}
      <View style={[styles.panelRing, { borderColor: theme.line }]} pointerEvents="none" />
      {icon}
      <Text style={[styles.cardTitle, { color: theme.fg, fontSize: fs.md, letterSpacing: 0.02 * fs.md }]}>{title}</Text>
      <Text style={[styles.cardSub, { color: theme.fgDim, fontSize: fs.xs }]}>{sub}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingBottom: 16 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  portrait: {
    width: 54,
    height: 66,
    borderRadius: 3,
    borderWidth: 2,
    overflow: 'hidden',
  },
  portraitImg: { width: '100%', height: '100%' },
  headerMain: { flex: 1, minWidth: 0 },
  name: { fontFamily: fonts.display },
  rankRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  rankText: { fontFamily: fonts.body },
  purse: { gap: 2 },
  currency: { flexDirection: 'row', alignItems: 'center', gap: 4, justifyContent: 'flex-end' },
  currencyText: { fontFamily: fonts.digit },
  gear: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  cards: { gap: 10, paddingHorizontal: 16 },
  hero: {
    alignItems: 'center',
    padding: 18,
    borderWidth: 1.5,
    borderRadius: 4,
    overflow: 'hidden',
  },
  heroTitle: { fontFamily: fonts.display },
  heroSub: { fontFamily: fonts.bodyItalic, marginTop: 4, textAlign: 'center' },
  pair: { flexDirection: 'row', gap: 10 },
  card: {
    flex: 1,
    padding: 12,
    borderWidth: 1,
    borderRadius: 4,
  },
  // web .panel::before: absolute inset 4, 1px var(--line), radius 2
  panelRing: { position: 'absolute', top: 4, left: 4, right: 4, bottom: 4, borderWidth: 1, borderRadius: 2 },
  cardTitle: { fontFamily: fonts.display, marginTop: 2 },
  cardSub: { fontFamily: fonts.body, marginTop: 2 },
});
