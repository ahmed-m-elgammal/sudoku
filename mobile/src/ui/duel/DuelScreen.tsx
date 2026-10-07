// DuelScreen.tsx — S05. The room the Tablet sits in.
//
// PORT of ../src/app/game/DuelScreen.tsx, but COMPOSITION ONLY. Every piece of this
// screen lives in its own file: the board in Board/Cell, the pad in NumPad, the rites in
// AbilityBar, the HUD in HudHeader/MirrorStrip/Ticker, the room-wide fx in FxLayers, the
// blocking surfaces in Modals, and the session (engine + audio + fx wiring) in
// useDuelSession. This file decides the LAYOUT and the ROUTING; it draws almost nothing.
//
// Two structural notes:
//
//  1. The web layout was one DOM tree with three zones (`.duelLeft` / `.boardArea` /
//     `.controls`) that collapsed to `display: contents` in portrait and became side
//     columns in landscape and on desktop. A phone has no desktop, so the portrait
//     arrangement is the layout: mirror + ticker, then the board, then the controls.
//     `useWindowDimensions` flips the mirror and pad into the side columns on a landscape
//     phone, which is the same layout law at the only size where it matters.
//
//  2. `finish()` is the Result flow and it is long, but it is not presentation: it is the
//     economy law (ink, standing, streaks, the ladder, the weekly seal), and it is ported
//     whole and unchanged. Anything it does NOT do was not the web build's behaviour.
//
// J3 — the verdict waits 300 ms of slow ink. `onEnd` fires synchronously inside
// `LocalDuel.finish()`, one frame BEFORE the events effect paints the beat, so this delay
// is the only honest place to hold the verdict back. The timer is cleanup-tracked, and an
// `endedRef` guard inside `finish` still stops a double `onEnd` double-firing.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUi } from '@/state/ui';
import { useSave } from '@/state/save';
import { recordInk } from '@/state/inkLedger';
import { audio } from '@/platform/audio';
import { useDisplaySettings } from '@/platform/display';
import { fonts, themeFor } from '@/theme/tokens';
import { storyJson, i18n } from '@/i18n';
import { SLOW_INK_MS } from '@/game/fx';
import { endlessInkBonus, endlessOnLoss, endlessOnWin } from '@shared/endless';
import { weekIndexFor, weeklyInkBonus } from '@shared/weekly';
import { useDuelSession, specFromUi, type DuelSessionSpec } from './useDuelSession';
import Board from './Board';
import NumPad from './NumPad';
import AbilityBar from './AbilityBar';
import HudHeader from './HudHeader';
import MirrorStrip from './MirrorStrip';
import Ticker from './Ticker';
import { ShakeLayer, WorldDim, HeatVignette } from './FxLayers';
import { PauseModal, ConcedeModal, DisconnectModal, SwapBanner } from './Modals';

export default function DuelScreen() {
  const ui = useUi();
  const save = useSave((s) => s.save);
  const display = useDisplaySettings();
  const theme = useMemo(() => themeFor({ contrast: display.contrast, text: display.text }), [display.contrast, display.text]);
  const { width, height } = useWindowDimensions();
  const landscape = width > height;
  // web offsets were `calc(var(--safe-top|bottom) + Npx)`; the hardcoded guesses (44 top,
  // 10 bottom, fixed banner offsets) ignored the notch, the Dynamic Island and the
  // home-indicator — edge-to-edge makes the bottom inset REAL on every modern phone.
  const insets = useSafeAreaInsets();
  // web `.marginNote`: bottom: clamp(238px, 34dvh, 318px) — dvh, not a fixed pixel, or it
  // overlaps the pad on short phones and floats on tall ones.
  const marginNoteBottom = Math.min(318, Math.max(238, height * 0.34));

  // `specFromUi()` reads the screen machine and the save synchronously and has no side
// effects, so the spec is available on the FIRST render. The web build deferred it to a
// mount effect and rendered a skeleton; a lazy initialiser removes that flash and the
// setState-in-effect it required.
const [spec] = useState<DuelSessionSpec>(specFromUi);
  const { duel, flood, shake, hitStop, slowInk, heat } = useDuelSession(spec);

  // iOS and Android both refuse audio before a user gesture; this runs on mount so the
  // duel is not silent on a later tap.
  useEffect(() => {
    audio.unlock();
  }, []);

  const [paused, setPaused] = useState(false);
  const [confirmConcede, setConfirmConcede] = useState(false);
  const [muted, setMuted] = useState(audio.muted());
  const [boardSize, setBoardSize] = useState<number>(0);
  const endedRef = useRef(false);
  const augurRef = useRef(false);
  const slowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // J3 — the freeze gates the three placement surfaces (Board, NumPad, keyboard); the
  // toolbar and abilities stay live.
  const frozen = hitStop !== null || slowInk;

  // Pause freezes the local engine.
  useEffect(() => {
    if (duel) duel.setPaused(paused && ui.duelMode !== 'ranked' && ui.duelMode !== 'friend');
  }, [duel, paused, ui.duelMode]);

  const finish = useCallback(
    (r: { winner: unknown; reason: string }) => {
      if (endedRef.current || !duel) return;
      endedRef.current = true;

      const st = duel.state;
      const me = st.players[0];
      const foe = st.players[1];
      const winner = r.winner as 0 | 1 | 'draw';
      const shadeDuel = ui.duelMode !== 'ranked' && ui.duelMode !== 'friend' && ui.duelMode !== 'daily';

      // Economy: win 30 / loss 10 / draw 15, claims 3 each.
      let ink = winner === 0 ? 30 : winner === 'draw' ? 15 : 10;
      ink += me.claimed.length * 3;

      // One ledger entry per duel. Re-sittable modes mint per-attempt ids so a legit
      // re-sit stays bounded instead of being swallowed.
      let ledgerDelta = ink;
      let dailyKey: string | null = null;
      let endlessRungFought: number | null = null;
      let weekIdx: number | null = null;
      let ratingDelta: number | null = null;

      if (!shadeDuel && ui.duelMode === 'ranked') {
        const sd = duel as unknown as { lastRatingDelta?: number | null };
        if (typeof sd.lastRatingDelta === 'number') ratingDelta = sd.lastRatingDelta;
        else {
          const standing = save?.standing ?? 1000;
          const expected = 1 / (1 + 10 ** ((standing - standing) / 400));
          ratingDelta = Math.round(32 * ((winner === 0 ? 1 : winner === 'draw' ? 0.5 : 0) - expected));
        }
      }

      const sealTimeline: [number, number, number][] = [];
      for (const e of st.events) {
        if (e.kind === 'mistake' && e.player === 0) {
          sealTimeline.push([e.atMs, (e as { sealsLeft?: number }).sealsLeft ?? 0, 0]);
        }
        if (e.kind === 'claim') {
          sealTimeline.push([e.atMs, e.player === 0 ? (foe.seals ?? 0) : (me.seals ?? 0), e.player as number]);
        }
      }

      const s = useSave.getState();
      const recentEntry = {
        t: Date.now(),
        mode: ui.duelMode,
        result: (winner === 0 ? 'w' : winner === 'draw' ? 'd' : 'l') as 'w' | 'd' | 'l',
        foe: foe.name,
        shade: shadeDuel,
        order: me.order,
      };
      s.update((cur) => ({
        ...cur,
        economy: { ...cur.economy, ink: cur.economy.ink + ink },
        standing: ratingDelta !== null ? Math.max(100, cur.standing + ratingDelta) : cur.standing,
        stats: {
          ...cur.stats,
          duels: cur.stats.duels + 1,
          wins: cur.stats.wins + (winner === 0 ? 1 : 0),
          losses: cur.stats.losses + (winner === 1 ? 1 : 0),
          draws: cur.stats.draws + (winner === 'draw' ? 1 : 0),
          claims: cur.stats.claims + me.claimed.length,
          recent: [recentEntry, ...cur.stats.recent].slice(0, 20),
        },
      }));

      if (ui.duelMode === 'tutorial' && winner === 0) {
        ledgerDelta += 100;
        s.update((cur) => ({
          ...cur,
          tutorialDone: true,
          antechamberUnlocked: true,
          economy: { ...cur.economy, ink: cur.economy.ink + 100, reliquaryProgress: cur.economy.reliquaryProgress + 1 },
        }));
      }

      // Campaign progression, unlocks and the narrative beats.
      const cd = ui.campaignDuel;
      let storyBeat: 'interlude1' | 'interlude2' | 'reveal' | null = null;
      if (ui.duelMode === 'campaign' && winner === 0 && cd) {
        const key = `${cd.folio}-${cd.duel}`;
        const stars = me.mistakes === 0 ? 3 : 2;
        const firstClear = (save?.campaign.stars[key] ?? 0) === 0;
        s.update((cur) => {
          const campaign = { ...cur.campaign, stars: { ...cur.campaign.stars, [key]: Math.max(cur.campaign.stars[key] ?? 0, stars) } };
          if (cd.duel < 2) campaign.duelIdx = cd.duel + 1;
          else if (cd.folio < 8) { campaign.folioIdx = cd.folio + 1; campaign.duelIdx = 0; }
          else campaign.ended = true;
          // Apothecary unlocks after Folio II, Warden after Folio IV.
          const unlocked = [...cur.unlockedOrders];
          if (cd.folio === 1 && cd.duel === 2 && !unlocked.includes('apothecary')) unlocked.push('apothecary');
          if (cd.folio === 3 && cd.duel === 2 && !unlocked.includes('warden')) unlocked.push('warden');
          return { ...cur, campaign, unlockedOrders: unlocked };
        });
        s.unlockAchievement('first-blood');
        if (cd.folio === 0 && cd.duel === 2) s.unlockAchievement('folio-first');
        if (cd.folio === 4 && cd.duel === 2) s.unlockAchievement('folio-fifth');
        if (cd.folio === 8 && cd.duel === 2) s.unlockAchievement('folio-ninth');
        if (firstClear) {
          if (cd.folio === 2 && cd.duel === 2) storyBeat = 'interlude1';
          else if (cd.folio === 5 && cd.duel === 2) storyBeat = 'interlude2';
          else if (cd.folio === 8 && cd.duel === 2) storyBeat = 'reveal';
        }
      }

      if (ui.duelMode === 'daily') {
        const key = new Date().toISOString().slice(0, 10);
        dailyKey = key;
        const timeMs = st.clockMs + me.mistakes * 10000;
        const prevStreak = save?.daily.lastDate === key ? save.daily.streak : 0;
        s.update((cur) => ({
          ...cur,
          daily: {
            ...cur.daily,
            lastDate: key,
            streak: winner === 0 ? Math.max(cur.daily.streak, prevStreak + 1) : 0,
            best: Math.max(cur.daily.best, prevStreak + 1),
            times: { ...cur.daily.times, [key]: Math.min(cur.daily.times[key] ?? Infinity, timeMs) },
          },
        }));
      }

      // A Reliquary every 3rd win, and only against a human or the ladder.
      let reliquaryWon = false;
      if (winner === 0 && !shadeDuel) {
        const wins = (save?.stats.wins ?? 0) + 1;
        reliquaryWon = wins % 3 === 0;
        if (reliquaryWon) s.update((cur) => ({ ...cur, economy: { ...cur.economy, reliquaryProgress: 0 } }));
      }

      // Endless: a win ascends, a loss returns to the foot; the rung win mits rung-scaled ink.
      if (ui.duelMode === 'endless') {
        const foughtRung = ui.endlessRung ?? save?.endless?.current ?? 0;
        endlessRungFought = foughtRung;
        const rungBonus = winner === 0 ? endlessInkBonus(foughtRung) : 0;
        ledgerDelta += rungBonus;
        const next = winner === 0 ? endlessOnWin(save?.endless) : endlessOnLoss(save?.endless);
        s.update((cur) => ({ ...cur, endless: next, economy: { ...cur.economy, ink: cur.economy.ink + rungBonus } }));
        if (next.best >= 10) s.unlockAchievement('endless-ten');
      }

      // Weekly: one COMPLETION seals the week; the bonus is the first win's only.
      if (ui.duelMode === 'weekly') {
        const week = weekIndexFor(Date.now());
        weekIdx = week;
        const firstWin = winner === 0 && save?.weekly?.lastWeek !== week;
        const wBonus = firstWin ? weeklyInkBonus : 0;
        ledgerDelta += wBonus;
        s.update((cur) => ({ ...cur, weekly: { lastWeek: week }, economy: { ...cur.economy, ink: cur.economy.ink + wBonus } }));
        if (firstWin) s.unlockAchievement('weekly-sat');
      }

      // The single ledger entry for this duel.
      {
        const ts = Date.now().toString(36);
        const lid =
          ui.duelMode === 'daily' && dailyKey ? `daily-${dailyKey}-${ts}`
          : ui.duelMode === 'endless' && endlessRungFought !== null ? `endless-${endlessRungFought}-${ts}`
          : ui.duelMode === 'weekly' && weekIdx !== null ? `weekly-${weekIdx}-${ts}`
          : `${ui.duelMode}-${ts}-${Math.floor(Math.random() * 46656).toString(36)}`;
        if (lid && ledgerDelta > 0) recordInk({ duelId: lid, mode: ui.duelMode, delta: ledgerDelta });
      }

      // Story beats replace the result screen on their first clear.
      if (storyBeat) {
        const payload =
          storyBeat === 'reveal'
            ? { lines: [...storyJson.orsoloReveal], plate: '/assets/plates/plate-orsolo-reveal.webp', then: 'endingChoice' as const }
            : storyBeat === 'interlude1'
              ? { lines: [...storyJson.interlude1], plate: '/assets/plates/plate-interlude-1.webp', then: 'folioMap' as const, campaignIndex: { folio: 3, duel: 0 } }
              : { lines: [...storyJson.interlude2], plate: '/assets/plates/plate-interlude-2.webp', then: 'folioMap' as const, campaignIndex: { folio: 6, duel: 0 } };
        ui.go('story', { serverDuel: null, lastResult: null, story: payload });
        return;
      }

      ui.go('result', {
        serverDuel: null,
        lastResult: {
          winner,
          reason: r.reason,
          mode: ui.duelMode,
          claims: [me.claimed.length, foe.claimed.length],
          mistakes: [me.mistakes, foe.mistakes],
          abilities: [
            Object.values(me.abilities).filter((a) => a.usedOnce).length,
            Object.values(foe.abilities).filter((a) => a.usedOnce).length,
          ],
          timeMs: st.clockMs,
          sealTimeline,
          ratingDelta,
          ink,
          shadeDuel,
          reliquaryWon,
        },
      });
    },
    [duel, ui, save],
  );

  // J3 — the verdict waits 300 ms of slow ink.
  useEffect(() => {
    if (!duel) return;
    duel.setOnEnd((r) => {
      if (slowTimerRef.current !== null) return;
      slowTimerRef.current = setTimeout(() => {
        slowTimerRef.current = null;
        finish(r);
      }, SLOW_INK_MS);
    });
    return () => {
      if (slowTimerRef.current !== null) {
        clearTimeout(slowTimerRef.current);
        slowTimerRef.current = null;
      }
    };
  }, [duel, finish]);

  const tutorialNote = duel && ui.duelMode === 'tutorial' ? duel.tutorialNote() : null;

  // The tutorial grants its free Augur the moment its margin note asks for it.
  useEffect(() => {
    if (tutorialNote === 'augur' && duel && !augurRef.current) {
      augurRef.current = true;
      duel.grantFreeAugur();
    }
  }, [tutorialNote, duel]);

  // The tutorial margin note teaches; it never blocks the board.
  useEffect(() => {
    if (!tutorialNote) return;
    const note = i18n.tutorial.notes[tutorialNote as keyof typeof i18n.tutorial.notes];
    if (note) audio.pencil();
  }, [tutorialNote]);

  const foeName = spec?.names[1] ?? i18n.duel.log.theTablet;

  if (!duel || !spec) {
    return (
      <View accessibilityLabel={i18n.common.loading} accessibilityRole="progressbar" style={[styles.root, { backgroundColor: theme.bg }]}>
        <View style={[styles.skeleton, { backgroundColor: theme.line }]} />
      </View>
    );
  }

  const dc = duel.disconnect;
  const swap = duel.swapBanner();
  const cold = heat?.cold ?? false;
  const heatValue = heat?.heat ?? 0;

  const board = (
    <View
      style={styles.boardArea}
      onLayout={(e) => {
        const { width: w, height: h } = e.nativeEvent.layout;
        const available = Math.floor(Math.min(w, h));
        if (available > 50 && Math.abs(available - boardSize) > 2) {
          setBoardSize(available);
        }
      }}
    >
      <Board
        duel={duel}
        flood={flood}
        hitStop={hitStop}
        frozen={frozen}
        cold={cold}
        slowInk={slowInk}
        heat={heatValue}
        theme={theme}
        size={boardSize > 50 ? boardSize : undefined}
      />
    </View>
  );

  const controls = (
    <View style={{ paddingBottom: insets.bottom + 8 }}>
      <View style={styles.toolbar}>
        <ToolBtn
          label={i18n.duel.toolbar.pencil}
          pressed={duel.pencil}
          theme={theme}
          onPress={() => {
            duel.togglePencil();
            audio.pencil();
          }}
        />
        <ToolBtn
          label={i18n.duel.toolbar.erase}
          theme={theme}
          onPress={() => {
            if (duel.selected !== null) duel.setNotes(duel.selected, []);
            audio.uiTap();
          }}
        />
        <ToolBtn
          label={muted ? i18n.duel.toolbar.unmute : i18n.duel.toolbar.mute}
          pressed={muted}
          theme={theme}
          onPress={() => {
            const next = !muted;
            audio.setMuted(next);
            setMuted(next);
          }}
        />
        {ui.duelMode === 'ranked' || ui.duelMode === 'friend' ? (
          <ToolBtn label={i18n.duel.toolbar.concede} theme={theme} onPress={() => setConfirmConcede(true)} />
        ) : (
          <ToolBtn label={i18n.duel.toolbar.pause} theme={theme} onPress={() => setPaused(true)} />
        )}
      </View>
      <NumPad duel={duel} frozen={frozen} heat={heatValue} theme={theme} onTap={() => audio.uiTap()} />
      <AbilityBar duel={duel} theme={theme} />
    </View>
  );

  return (
    <View style={[styles.root, { backgroundColor: theme.bg }]} data-cold={cold ? 'y' : undefined}>
      <HeatVignette heat={heatValue} theme={theme} />
      <WorldDim hit={hitStop !== null} slow={slowInk} theme={theme} />

      <ShakeLayer shake={shake}>
        <HudHeader duel={duel} theme={theme} />

        <View style={[styles.main, landscape && styles.mainLandscape]}>
          <View style={styles.left}>
            <MirrorStrip duel={duel} theme={theme} />
            <Ticker duel={duel} theme={theme} />
          </View>
          {board}
          {controls}
        </View>
      </ShakeLayer>

      {tutorialNote ? (
        <>
          <Pressable
            onPress={() => {
              useSave.getState().update((c) => ({
                ...c,
                tutorialDone: true,
                antechamberUnlocked: true,
                economy: { ...c.economy, ink: c.economy.ink + 100 },
              }));
              recordInk({ duelId: `tutorial-skip-${Date.now().toString(36)}`, mode: 'tutorial', delta: 100 });
              duel.concede();
            }}
            accessibilityRole="button"
            style={[styles.skip, { top: insets.top + 3, right: 8, borderColor: theme.line, backgroundColor: theme.bg }]}
          >
            <Text style={[styles.skipText, { color: theme.fgDim }]}>{i18n.tutorial.skip}</Text>
          </Pressable>
          <View
            accessibilityRole="text"
            pointerEvents="none"
            style={[styles.marginNote, { bottom: marginNoteBottom, backgroundColor: theme.fg, borderColor: theme.bg }]}
          >
            <Text style={[styles.marginNoteText, { color: theme.bg }]}>
              {i18n.tutorial.notes[tutorialNote as keyof typeof i18n.tutorial.notes]}
            </Text>
          </View>
        </>
      ) : null}

      {duel.selfOffline && !dc ? (
        <View accessibilityRole="text" style={[styles.offline, { top: insets.top + 8, backgroundColor: theme.bgRaised, borderColor: theme.lineStrong }]}>
          <Text style={{ color: theme.fg }}>{i18n.duel.disconnect.youOffline}</Text>
        </View>
      ) : null}

      {swap ? <SwapBanner banner={swap} foeName={duel.state.players[1].name} theme={theme} /> : null}

      {paused ? (
        <PauseModal
          theme={theme}
          foeName={foeName}
          onResume={() => setPaused(false)}
          onConcede={() => { setPaused(false); duel.concede(); }}
        />
      ) : null}

      {confirmConcede ? (
        <ConcedeModal
          theme={theme}
          onConfirm={() => { setConfirmConcede(false); duel.concede(); }}
          onCancel={() => setConfirmConcede(false)}
        />
      ) : null}

      {dc ? <DisconnectModal state={dc} theme={theme} /> : null}
    </View>
  );
}

/** One toolbar button. `aria-pressed` on the web becomes `accessibilityState.selected`. */
function ToolBtn({
  label, pressed, theme, onPress,
}: { label: string; pressed?: boolean; theme: ReturnType<typeof themeFor>; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: !!pressed }}
      style={[
        styles.toolBtn,
        { borderColor: pressed ? theme.focus : theme.lineStrong, backgroundColor: theme.bgRaised },
      ]}
    >
      <Text style={[styles.toolText, { color: pressed ? theme.focus : theme.fg }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  main: { flex: 1, paddingHorizontal: 8 },
  mainLandscape: { flexDirection: 'row', gap: 12 },
  left: { alignItems: 'center', paddingVertical: 2 },
  boardArea: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 4 },
  toolbar: { flexDirection: 'row', gap: 6, justifyContent: 'center', paddingVertical: 4 },
  toolBtn: { flex: 1, paddingVertical: 6, borderWidth: 1, borderRadius: 3, minHeight: 38, alignItems: 'center', justifyContent: 'center' },
  toolText: { fontFamily: fonts.display, fontSize: 13, letterSpacing: 0.5 },
  skeleton: { width: 200, height: 12, marginTop: '40%', alignSelf: 'center' },
  // top/right/bottom offsets are injected inline from useSafeAreaInsets / window height
  // (web: top calc(safe-top + 3px), right 8px)
  skip: { position: 'absolute', paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderRadius: 3, minHeight: 28, justifyContent: 'center', zIndex: 10 },
  skipText: { fontSize: 11, textDecorationLine: 'underline' },
  marginNote: { position: 'absolute', left: '6%', right: '6%', borderWidth: 1, borderRadius: 3, padding: 8, zIndex: 10 },
  marginNoteText: { fontSize: 13, textAlign: 'center' },
  // web `.reconnectBanner`: fixed, top calc(safe-top + 8px), horizontally centered —
  // alignSelf centers the absolute child the way the web's left:50% translateX(-50%) did
  offline: { position: 'absolute', alignSelf: 'center', borderWidth: 1, borderRadius: 3, padding: 8 },
});