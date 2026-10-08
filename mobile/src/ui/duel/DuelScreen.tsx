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
import { loadIdentity } from '@/state/identity';
import { net } from '@/game/net/client';
import { audio } from '@/platform/audio';
import { useDisplaySettings } from '@/platform/display';
import { fonts, layout, themeFor } from '@/theme/tokens';
import { storyJson, i18n } from '@/i18n';
import { SLOW_INK_MS } from '@/game/fx';
import type { LocalDuelOpts } from '@/game/duelRuntime';
import { endlessInkBonus, endlessOnLoss, endlessOnWin } from '@shared/endless';
import { weekIndexFor, weeklyInkBonus } from '@shared/weekly';
import { useDuelSession, specFromUi, type DuelSessionSpec } from './useDuelSession';
import { isGraduated, completeTutorialByWin, completeTutorialBySkip, GRADUATION_INK } from './tutorialGraduation';
import TutorialCoach from './TutorialCoach';
import TutorialBanner from './tutorial/TutorialBanner';
import TutorialLayer from './tutorial/TutorialLayer';
import GraduationCard from './tutorial/GraduationCard';
import type { TutorialPhase } from '@/game/tutorialDirector';
import Board from './Board';
import NumPad from './NumPad';
import AbilityBar from './AbilityBar';
import HudHeader from './HudHeader';
import MirrorStrip from './MirrorStrip';
import Ticker from './Ticker';
import { ShakeLayer, WorldDim, HeatVignette } from './FxLayers';
import { PauseModal, ConcedeModal, DisconnectModal, SkipModal, SwapBanner } from './Modals';

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
  const [confirmSkip, setConfirmSkip] = useState(false);
  const [muted, setMuted] = useState(audio.muted());
  const [boardSize, setBoardSize] = useState<number>(0);
  const endedRef = useRef(false);
  const slowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // M2 — the lesson's overlay surfaces measure these four containers (spotlight holes)
  const boardRef = useRef<View | null>(null);
  const padRef = useRef<View | null>(null);
  const toolbarRef = useRef<View | null>(null);
  const abilityRef = useRef<View | null>(null);
  // T10 — the graduation card: null = no card; true/false = which graduation this is
  const [gradFirst, setGradFirst] = useState<boolean | null>(null);

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

      const winner = r.winner as 0 | 1 | 'draw';

      // G10 — a tutorial duel cannot be lost (every mistake is forgiven and the Shade
      // holds at the floor), but if one EVER ends without the Clerk winning, the
      // verdict is a fresh REPLAY of the lesson — never the result screen, whose
      // Rematch used to re-queue the child into a real calibrated Shade duel. The
      // bumped duelNonce remounts the duel screen with a fresh runtime.
      if (ui.duelMode === 'tutorial' && winner !== 0) {
        ui.go('tutorial', { duelNonce: ui.duelNonce + 1, lastResult: null, serverDuel: null });
        return;
      }

      const st = duel.state;
      const me = st.players[0];
      const foe = st.players[1];
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

      // G13 — the +100 graduation is ONCE PER SAVE. The lesson is now re-playable
      // (Antechamber + Settings entries), and an unguarded +100 would be an Ink farm;
      // the gate reads the SAVE, so every replay path (hub card, settings row, this
      // rematch, an app kill) dedupes by the same source of truth. The ordinary duel
      // Ink below still flows — a tutorial win pays like any other Shade duel.
      if (ui.duelMode === 'tutorial' && winner === 0) {
        const firstGraduation = !isGraduated(useSave.getState().save);
        if (firstGraduation) ledgerDelta += GRADUATION_INK;
        s.update(completeTutorialByWin);
        // M2 T10 (§5.2) — the v2 lesson's verdict is the graduation card, not the
        // result screen. The ledger entry still flows (same id shape as the generic
        // branch below); the card's Continue routes to the hall.
        if (spec?.tutorialScript === 'v2') {
          const ts = Date.now().toString(36);
          recordInk({ duelId: `tutorial-${ts}-${Math.floor(Math.random() * 46656).toString(36)}`, mode: 'tutorial', delta: ledgerDelta });
          setGradFirst(firstGraduation);
          return;
        }
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
        // PORT of src/app/game/DuelScreen.tsx:157-160 — the fire-and-forget result
        // POST the server leaderboard is fed by. The Phase 1 port dropped it; net
        // never rejects on mobile (it catches inside), and the identity read is
        // guarded here the same way — a failed POST must never break finish().
        void (async () => {
          try {
            const id = await loadIdentity();
            await net.dailyResult({ id: id.id, secret: id.secret, dateKey: key, timeMs, mistakes: me.mistakes });
          } catch { /* best effort — the save already recorded the result locally */ }
        })();
      }

      // A Reliquary every 3rd win, and only against a human or the ladder.
      let reliquaryWon = false;
      if (winner === 0 && !shadeDuel) {
        const wins = (save?.stats.wins ?? 0) + 1;
        reliquaryWon = wins % 3 === 0;
        if (reliquaryWon) s.update((cur) => ({ ...cur, economy: { ...cur.economy, reliquaryProgress: 0 } }));
      }

      // T7 — recordable human duels leave an echo behind (the ink-echo another Clerk
      // may duel later). Tutorial (scripted) and campaign (canon foes) stay unrecorded.
      // The web duck-types the recorder off the runtime instance (`'toReplay' in duel`):
      // LocalDuel records, the server runtime does not. Same duck-check, structurally typed
      // (the recorder rides LocalDuelOpts — the intersection law duelRuntime.ts documents).
      const echoDuel = duel as { toReplay?: NonNullable<LocalDuelOpts['toReplay']> };
      if (echoDuel.toReplay && ['practice', 'daily', 'shade', 'replay', 'endless', 'weekly'].includes(ui.duelMode)) {
        const rec = echoDuel.toReplay({ winner, reason: r.reason });
        if (rec) void import('@/game/echoes').then(({ saveEcho }) => saveEcho(rec));
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

      // The single ledger entry for this duel. Ranked/friend carry the SERVER's duel id
      // (specs/17 4.4 + the shared/inkLedger verdict law): the ledger must join the duel
      // log the server wrote, or /api/ink drops the entry as a fabricated pvp id.
      {
        const ts = Date.now().toString(36);
        let lid = '';
        if (ui.duelMode === 'ranked' || ui.duelMode === 'friend') {
          const sd = duel as unknown as { opts?: { duelId?: unknown } };
          if (sd.opts && typeof sd.opts.duelId === 'string' && sd.opts.duelId) lid = sd.opts.duelId;
        } else if (ui.duelMode === 'daily' && dailyKey) lid = `daily-${dailyKey}-${ts}`;
        else if (ui.duelMode === 'endless' && endlessRungFought !== null) lid = `endless-${endlessRungFought}-${ts}`;
        else if (ui.duelMode === 'weekly' && weekIdx !== null) lid = `weekly-${weekIdx}-${ts}`;
        else lid = `${ui.duelMode}-${ts}-${Math.floor(Math.random() * 46656).toString(36)}`;
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
    [duel, ui, save, spec],
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

  // M2 — the v2 lesson: the phase machine (optional runtime surface), the taught
  // stage (everything not yet taught dims to a whisper), and the spotlight target.
  const tp: TutorialPhase | null =
    duel && ui.duelMode === 'tutorial' && spec?.tutorialScript === 'v2' && duel.tutorialPhase
      ? (duel.tutorialPhase() as TutorialPhase | null)
      : null;
  const teaching = tp !== null && tp !== 't9' && tp !== 't10';

  // The tutorial margin note teaches; it never blocks the board.
  useEffect(() => {
    if (!tutorialNote) return;
    const note = i18n.tutorial.notes[tutorialNote as keyof typeof i18n.tutorial.notes];
    if (note) audio.pencil();
  }, [tutorialNote]);

  // G1 — the free Augur is granted by TutorialCoach once its note has been readable
  // for 2.5 s (or by the first Augur-tile tap — LocalDuel.ability owns that path).
  // G11 — the chip only ASKS; skipTutorial below is the confirmed, positive completion:
  // graduation reward + tutorialDone, straight to the hall — no concede, no DEFEAT.
  const requestSkip = useCallback(() => setConfirmSkip(true), []);
  const skipTutorial = useCallback(() => {
    setConfirmSkip(false);
    if (!duel) return;
    // G13 — the first skip still lands in the Antechamber with its +100; a replay
    // skip (the save already graduated) re-unlocks nothing and re-pays nothing.
    const firstGraduation = !isGraduated(useSave.getState().save);
    useSave.getState().update(completeTutorialBySkip);
    if (firstGraduation) recordInk({ duelId: `tutorial-skip-${Date.now().toString(36)}`, mode: 'tutorial', delta: GRADUATION_INK });
    // The duel is abandoned, not lost: the screen unmounts and the session cleanup
    // destroys the runtime, so no verdict — and no defeat ledger entry — ever lands.
    ui.go('antechamber', { lastResult: null, serverDuel: null });
  }, [duel, ui]);

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

  // G3/G4 — the note is docked IN FLOW (never over the board) and the skip chip
  // lives in the banner row (never over the HUD). M2: the v2 lesson renders its own
  // banner (plain+flavor, dots, CTAs); the v1 docked note stays for the rollback flag.
  const coach = tp && tp !== 't0' && tp !== 't10' ? (
    <TutorialBanner
      duel={duel}
      phase={tp}
      target={duel.tutorialTarget?.() ?? null}
      telegraph={duel.tutorialTelegraph?.() ?? null}
      theme={theme}
      onGate={(g) => duel.tutorialAdvance?.(g)}
      onSkip={requestSkip}
    />
  ) : tutorialNote ? (
    <TutorialCoach duel={duel} note={tutorialNote} theme={theme} onSkip={requestSkip} />
  ) : null;

  const board = (
    <View
      ref={boardRef}
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
      <View ref={toolbarRef} style={styles.toolbar}>
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
      {/* M2 — the pad and the rites are the spotlight's other two containers; the
        untaught ones dim with the stage (opacity wrapper — visual only, never blocking). */}
      <View ref={padRef} style={teaching ? styles.dimCluster : null}>
        <NumPad duel={duel} frozen={frozen} heat={heatValue} theme={theme} onTap={() => audio.uiTap()} />
      </View>
      <View ref={abilityRef} style={teaching ? styles.dimCluster : null}>
        <AbilityBar duel={duel} theme={theme} />
      </View>
    </View>
  );

  return (
    <View style={[styles.root, { backgroundColor: theme.bg }]}>
      {/* M2 §5.2 T1 — the untaught room dims to a whisper; t9 restores it. */}
      <View style={teaching ? styles.dimCluster : null}>
        <HudHeader duel={duel} theme={theme} info={tp !== null} />
      </View>

      <View style={[styles.main, landscape && styles.mainLandscape]}>
        <View style={styles.left}>
          <View style={teaching ? styles.dimCluster : null}>
            <MirrorStrip duel={duel} theme={theme} />
          </View>
          <Ticker duel={duel} theme={theme} />
        </View>
        {/* J2 — the web shakes `.boardWrap` ONLY: the HUD, pad and rites hold still. */}
        <ShakeLayer shake={shake}>{board}</ShakeLayer>
        {/* G3 — docked below the board / above the toolbar, in the layout flow. */}
        {!landscape ? coach : null}
        {controls}
      </View>

      {/* Landscape: the controls column has no spare height, so the note docks as a
        full-width strip under the room — still in flow, still never over a cell. */}
      {landscape ? (
        <View style={{ marginBottom: insets.bottom + 4, marginHorizontal: 8 }}>{coach}</View>
      ) : null}

      {/* M2 — the lesson's floating surfaces: prologue cards (t0), the ghost demos
        (t2/t7), the spotlight scrim (t1, t3–t8). One composition point (§6.1). */}
      {tp !== null && duel ? (
        <TutorialLayer
          duel={duel}
          phase={tp}
          theme={theme}
          boardSize={boardSize}
          refs={{ board: boardRef, pad: padRef, toolbar: toolbarRef, ability: abilityRef }}
          onGate={(g) => duel.tutorialAdvance?.(g)}
        />
      ) : null}

      {/* M2 T10 — the graduation card: the v2 lesson's verdict surface. */}
      {gradFirst !== null && duel ? (
        <GraduationCard
          theme={theme}
          first={gradFirst}
          onContinue={() => {
            setGradFirst(null);
            ui.go('antechamber', { lastResult: null, serverDuel: null });
          }}
        />
      ) : null}

      {/* J4/J3 — the vignette (web z-60) and the world dim (web z-80) paint OVER the
        duel room, under the banners (web z-90/110) and the RN modals (top layer). */}
      <HeatVignette heat={heatValue} theme={theme} />
      <WorldDim hit={hitStop !== null} slow={slowInk} theme={theme} />

      {swap ? <SwapBanner banner={swap} foeName={duel.state.players[1].name} theme={theme} /> : null}

      {duel.selfOffline && !dc ? (
        <View accessibilityRole="text" style={[styles.offline, { top: insets.top + 8, backgroundColor: theme.bgRaised, borderColor: theme.lineStrong }]}>
          <Text style={{ color: theme.fg }}>{i18n.duel.disconnect.youOffline}</Text>
        </View>
      ) : null}

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

      {confirmSkip ? (
        <SkipModal
          theme={theme}
          onConfirm={skipTutorial}
          onCancel={() => setConfirmSkip(false)}
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
  toolBtn: { flex: 1, paddingVertical: 6, borderWidth: 1, borderRadius: 3, minHeight: layout.touch, alignItems: 'center', justifyContent: 'center' },
  toolText: { fontFamily: fonts.display, fontSize: 13, letterSpacing: 0.5 },
  skeleton: { width: 200, height: 12, marginTop: '40%', alignSelf: 'center' },
  // M2 §5.2 T1 — the taught stage's whisper: visual-only dimming (opacity never blocks
  // touches; the spotlight scrim is what absorbs them)
  dimCluster: { opacity: 0.4 },
  // web `.reconnectBanner`: fixed, top calc(safe-top + 8px), horizontally centered —
  // alignSelf centers the absolute child the way the web's left:50% translateX(-50%) did
  offline: { position: 'absolute', alignSelf: 'center', borderWidth: 1, borderRadius: 3, padding: 8 },
});