// DuelScreen — S05 (mobile) / S05b (desktop). Tutorial margin notes, pause/concede modals,
// S08 disconnect countdown, keyboard play, end → Result flow (spec §4).
// Layout zones (.duelMain > .duelLeft / .boardArea / .controls) collapse to display:contents
// in portrait and become side columns on landscape phones and desktop — one DOM tree that
// fits every device (see Duel.module.css).
'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useUi } from '@/state/ui';
import { useSave } from '@/state/save';
import { useDuelSession, specFromUi, type DuelSessionSpec, type AnyDuel } from './useDuelSession';
import Board from './Board';
import NumPad from './NumPad';
import AbilityBar from './AbilityBar';
import HudHeader from './HudHeader';
import { MirrorStrip, Ticker } from './HudBits';
import styles from './Duel.module.css';
import i18n from '@/i18n/en.json';
import { synth } from '@/audio/synth';
import { net } from '@/net/client';
import { orderMeta } from '@shared/orders';
import storyJson from '@/i18n/story.json';
import type { Digit, OrderId } from '@shared/config';
import { Rng } from '@shared/rng';
import { endlessInkBonus, endlessOnLoss, endlessOnWin } from '@shared/endless';
import { weekIndexFor, weeklyInkBonus } from '@shared/weekly';

export default function DuelScreen() {
  const ui = useUi();
  const [spec, setSpec] = useState<DuelSessionSpec | null>(null);
  const { duel, flood, shake } = useDuelSession(spec);
  const [paused, setPaused] = useState(false);
  const [confirmConcede, setConfirmConcede] = useState(false);
  const [muted, setMuted] = useState(synth.muted);
  const endedRef = useRef(false);
  const augurRef = useRef(false);
  const save = useSave((s) => s.save);

  useEffect(() => { setSpec(specFromUi()); }, []);

  // pause freezes the local engine (solo only)
  useEffect(() => { if (duel) duel.paused = paused && ui.duelMode !== 'ranked' && ui.duelMode !== 'friend'; }, [duel, paused, ui.duelMode]);

  const finish = useCallback((r: { winner: unknown; reason: string }) => {
    if (endedRef.current || !duel) return;
    endedRef.current = true;
    const st = duel.state;
    const me = st.players[0];
    const foe = st.players[1];
    const winner = r.winner as 0 | 1 | 'draw';
    const shadeDuel = ui.duelMode !== 'ranked' && ui.duelMode !== 'friend' && ui.duelMode !== 'daily';
    // TODO(T13): economy is client-owned per spec §6; server-side ink ledger pending.
    // economy (spec §8): win 30 / loss 10 / draw 15, claims 3, clean +2; rating only vs humans
    let ink = 0;
    if (winner === 0) ink += 30; else if (winner === 'draw') ink += 15; else ink += 10;
    ink += me.claimed.length * 3;
    let ratingDelta: number | null = null;
    if (!shadeDuel && ui.duelMode === 'ranked') {
      // server-authoritative duels report their own Elo delta
      const sd = duel as unknown as { lastRatingDelta?: number | null };
      if (typeof sd.lastRatingDelta === 'number') ratingDelta = sd.lastRatingDelta;
      else {
        const expected = 1 / (1 + 10 ** (((save?.standing ?? 1000) - (save?.standing ?? 1000)) / 400));
        ratingDelta = Math.round(32 * ((winner === 0 ? 1 : winner === 'draw' ? 0.5 : 0) - expected));
      }
    }
    const sealTimeline: Array<[number, number, number]> = [];
    for (const e of st.events) {
      if (e.kind === 'mistake' && e.player === 0) sealTimeline.push([e.atMs, (e as { sealsLeft?: number }).sealsLeft ?? 0, 0]);
      if (e.kind === 'claim') sealTimeline.push([e.atMs, e.player === 0 ? (foe.seals ?? 0) : (me.seals ?? 0), e.player as number]);
    }
    const s = useSave.getState();
    const recentEntry: { t: number; mode: string; result: 'w' | 'd' | 'l'; foe: string; shade: boolean; order: OrderId } = {
      t: Date.now(), mode: ui.duelMode, result: winner === 0 ? 'w' : winner === 'draw' ? 'd' : 'l', foe: foe.name, shade: shadeDuel, order: me.order,
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
    // tutorial completion
    if (ui.duelMode === 'tutorial' && winner === 0) {
      s.update((cur) => ({ ...cur, tutorialDone: true, antechamberUnlocked: true, economy: { ...cur.economy, ink: cur.economy.ink + 100, reliquaryProgress: cur.economy.reliquaryProgress + 1 } }));
    }
    // campaign progression
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
        // unlocks (spec §2): Apothecary after Folio II, Warden after Folio IV
        const unlocked = [...cur.unlockedOrders];
        if (cd.folio === 1 && cd.duel === 2 && !unlocked.includes('apothecary')) unlocked.push('apothecary');
        if (cd.folio === 3 && cd.duel === 2 && !unlocked.includes('warden')) unlocked.push('warden');
        return { ...cur, campaign, unlockedOrders: unlocked };
      });
      // Marginalia that existed in copy but were never awarded: first win + folio
      // completions. unlockAchievement no-ops when already owned, so replays stay clean.
      s.unlockAchievement('first-blood');
      if (cd.folio === 0 && cd.duel === 2) s.unlockAchievement('folio-first');
      if (cd.folio === 4 && cd.duel === 2) s.unlockAchievement('folio-fifth');
      if (cd.folio === 8 && cd.duel === 2) s.unlockAchievement('folio-ninth');
      // T15 + T6 — narrative beats fire once, on the first clear of their duel only:
      // interludes close Folios III and VI; the Orsolo reveal closes Folio IX and
      // hands the pen to the Balance / Burn choice (EndingChoice).
      if (firstClear) {
        if (cd.folio === 2 && cd.duel === 2) storyBeat = 'interlude1';
        else if (cd.folio === 5 && cd.duel === 2) storyBeat = 'interlude2';
        else if (cd.folio === 8 && cd.duel === 2) storyBeat = 'reveal';
      }
    }
    // daily result recording (server-tracked streaks/leaderboard; spec M3)
    if (ui.duelMode === 'daily') {
      const key = new Date().toISOString().slice(0, 10);
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
      void (async () => {
        const { loadIdentity } = await import('@/state/identity');
        const id = await loadIdentity();
        await net.dailyResult({ id: id.id, secret: id.secret, dateKey: key, timeMs, mistakes: me.mistakes });
      })();
    }
    // reliquary every 3rd win (spec §8)
    let reliquaryWon = false;
    if (winner === 0 && !shadeDuel) {
      const wins = (save?.stats.wins ?? 0) + 1;
      reliquaryWon = wins % 3 === 0;
      if (reliquaryWon) s.update((cur) => ({ ...cur, economy: { ...cur.economy, reliquaryProgress: 0 } }));
    }
    // T7 — recordable human duels leave an echo behind (the ink-echo another Clerk
    // may duel later). Tutorial (scripted) and campaign (canon foes) stay unrecorded.
    if (duel && 'toReplay' in duel && ['practice', 'daily', 'shade', 'replay', 'endless', 'weekly'].includes(ui.duelMode)) {
      const rec = duel.toReplay({ winner, reason: r.reason });
      if (rec) void import('@/game/echoes').then(({ saveEcho }) => saveEcho(rec));
    }
    // T18 — Endless Assize ladder law: a win ascends (best tracks), a loss returns
    // the Clerk to the foot of the stair; the rung win mints rung-scaled Ink.
    if (ui.duelMode === 'endless') {
      const foughtRung = ui.endlessRung ?? save?.endless?.current ?? 0;
      const next = winner === 0 ? endlessOnWin(save?.endless) : endlessOnLoss(save?.endless);
      s.update((cur) => ({
        ...cur,
        endless: next,
        economy: { ...cur.economy, ink: cur.economy.ink + (winner === 0 ? endlessInkBonus(foughtRung) : 0) },
      }));
      if (next.best >= 10) s.unlockAchievement('endless-ten');
    }
    // T21 — Weekly Assize law: one COMPLETION per week (any result) seals the week;
    // the Ink bonus is minted only by the first WIN of the week. Re-sits are free
    // but change nothing — the week's verdict is already written.
    if (ui.duelMode === 'weekly') {
      const week = weekIndexFor(Date.now());
      const firstWin = winner === 0 && save?.weekly?.lastWeek !== week;
      s.update((cur) => ({
        ...cur,
        weekly: { lastWeek: week },
        economy: { ...cur.economy, ink: cur.economy.ink + (firstWin ? weeklyInkBonus : 0) },
      }));
      if (firstWin) s.unlockAchievement('weekly-sat');
    }
    // story beats replace the result screen on their first clear — the reveal plays
    // immediately after Folio IX (spec: before the ending choice), interludes close
    // Folios III and VI. Rewards above were already written to the save.
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
        winner, reason: r.reason, mode: ui.duelMode,
        claims: [me.claimed.length, foe.claimed.length],
        mistakes: [me.mistakes, foe.mistakes],
        abilities: [Object.values(me.abilities).filter((a) => a.usedOnce).length, Object.values(foe.abilities).filter((a) => a.usedOnce).length],
        timeMs: st.clockMs, sealTimeline, ratingDelta, ink, shadeDuel, reliquaryWon,
      },
    });
  }, [duel, ui, save]);

  useEffect(() => {
    if (!duel) return;
    duel.opts.onEnd = (r) => finish(r);
  }, [duel, finish]);

  const tutorialNote = duel && ui.duelMode === 'tutorial' ? duel.tutorialNote() : null;

  // the tutorial grants one free Augur the moment its note asks for it
  useEffect(() => {
    if (tutorialNote === 'augur' && duel && !augurRef.current) {
      augurRef.current = true;
      duel.grantFreeAugur();
    }
  }, [tutorialNote, duel]);

  // keyboard (S05b): 1-9 place, arrows move, Backspace erase, N pencil, Q/W/E abilities, Esc pause
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!duel || endedRef.current) return;
      const sel = duel.selected;
      if (e.key >= '1' && e.key <= '9' && sel !== null) {
        const d = Number(e.key) as Digit;
        if (duel.pencil) duel.toggleNote(sel, d);
        else duel.place(sel, d);
      } else if (e.key === 'Backspace' && sel !== null) {
        duel.setNotes(sel, []);
      } else if (e.key.startsWith('Arrow') && sel !== null) {
        e.preventDefault();
        const c = sel;
        const map: Record<string, number> = { ArrowLeft: c > 0 ? c - 1 : c, ArrowRight: c < 80 ? c + 1 : c, ArrowUp: c > 8 ? c - 9 : c, ArrowDown: c < 72 ? c + 9 : c };
        duel.select(map[e.key]);
      } else if (e.key.toLowerCase() === 'n') {
        duel.pencil = !duel.pencil;
        duel.bumpPublic();
      } else if (['q', 'w', 'e'].includes(e.key.toLowerCase())) {
        const idx = ['q', 'w', 'e'].indexOf(e.key.toLowerCase());
        const ids = Object.keys(duel.state.players[0].abilities) as Parameters<typeof duel.ability>[0][];
        const id = ids[idx];
        if (id) duel.ability(id, duel.selected !== null ? { cell: duel.selected } : {});
      } else if (e.key === 'Escape') {
        if (ui.duelMode === 'ranked' || ui.duelMode === 'friend') setConfirmConcede(true);
        else setPaused((p) => !p);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [duel, ui.duelMode]);

  const foeName = useMemo(() => spec?.names[1] ?? 'The foe', [spec]);

  if (!duel || !spec) return <main className={styles.duelRoot} aria-busy="true"><div className="skeleton-parchment" style={{ margin: '40vh auto 0', width: 200, height: 12 }} /></main>;

  const dc = duel.disconnect;
  const swap = duel.swapBanner(); // T4 — truthy for ~4.2s after Orsolo adapts

  return (
    <main className={styles.duelRoot}>
      <HudHeader duel={duel} />
      <div className={styles.duelMain}>
        <div className={styles.duelLeft}>
          <MirrorStrip duel={duel} />
          <Ticker duel={duel} />
        </div>
        <div className={styles.boardArea}>
          <Board duel={duel} flood={flood} shake={shake} />
        </div>
        <div className={styles.controls}>
          <div className={styles.toolbar}>
            <button aria-pressed={duel.pencil} onClick={() => { duel.pencil = !duel.pencil; duel.bumpPublic(); synth.uiTap(); }}>
              {i18n.duel.toolbar.pencil}
            </button>
            <button onClick={() => { if (duel.selected !== null) { duel.setNotes(duel.selected, []); } synth.uiTap(); }}>
              {i18n.duel.toolbar.erase}
            </button>
            <button aria-pressed={muted} onClick={() => { synth.setMuted(!muted); setMuted(!muted); }}>
              {muted ? i18n.duel.toolbar.unmute : i18n.duel.toolbar.mute}
            </button>
            {ui.duelMode === 'ranked' || ui.duelMode === 'friend' ? (
              <button onClick={() => setConfirmConcede(true)}>{i18n.duel.toolbar.concede}</button>
            ) : (
              <button onClick={() => setPaused(true)}>{i18n.duel.toolbar.pause}</button>
            )}
          </div>
          <NumPad duel={duel} />
          <AbilityBar duel={duel} />
        </div>
      </div>

      {tutorialNote && (
        <>
          <button className={styles.skipTutorial} onClick={() => {
            useSave.getState().update((c) => ({ ...c, tutorialDone: true, antechamberUnlocked: true, economy: { ...c.economy, ink: c.economy.ink + 100 } }));
            duel.concede();
          }}>
            {i18n.tutorial.skip}
          </button>
          <aside className={`${styles.marginNote} page-turn`} role="note" aria-label="Margin note">
            {i18n.tutorial.notes[tutorialNote as keyof typeof i18n.tutorial.notes]}
          </aside>
        </>
      )}

      {/* S08 — the 20s reconnect grace (TODO T2) */}
      {dc && (
        <div className={styles.disconnectVeil} role="alertdialog" aria-modal="true" aria-live="assertive" aria-label={i18n.duel.disconnect.title}>
          <div className={`${styles.disconnectCard} page-turn`}>
            <span className={styles.disconnectSigil} aria-hidden />
            <h2>{i18n.duel.disconnect.title}</h2>
            <p>{i18n.duel.disconnect.peerBody.replace('{who}', dc.who).replace('{s}', String(dc.secondsLeft))}</p>
            <div className={styles.disconnectRingWrap}>
              <svg className={styles.disconnectRing} viewBox="0 0 72 72" aria-hidden>
                <circle className={styles.disconnectTrack} cx="36" cy="36" r="30" />
                <circle
                  className={styles.disconnectFill}
                  cx="36" cy="36" r="30"
                  strokeDasharray={2 * Math.PI * 30}
                  strokeDashoffset={2 * Math.PI * 30 * (1 - Math.max(0, dc.secondsLeft) / dc.graceS)}
                />
              </svg>
              <b className={`${styles.disconnectCount} digits`} aria-hidden>{dc.secondsLeft}</b>
            </div>
          </div>
        </div>
      )}
      {duel.selfOffline && !dc && (
        <div className={styles.reconnectBanner} role="status">
          {i18n.duel.disconnect.youOffline}
        </div>
      )}

      {/* T4 — Orsolo's adaptive swap: non-blocking callout, never interrupts play */}
      {swap && (
        <div className={styles.swapBanner} role="status" aria-live="assertive">
          <div className={`${styles.swapCard} page-turn`}>
            <div className={styles.swapSigils} aria-hidden>
              <i className={styles.swapSigil} style={{ backgroundImage: `url(${orderMeta(swap.from).portrait})` }} />
              <span className={styles.swapArrow}>→</span>
              <i className={`${styles.swapSigil} ${styles.swapSigilNew}`} style={{ backgroundImage: `url(${orderMeta(swap.to).portrait})` }} />
            </div>
            <b className={styles.swapTitle}>{i18n.duel.swap.title}</b>
            <p className={styles.swapBody}>
              {i18n.duel.swap.body
                .replace('{name}', duel.state.players[1].name)
                .replace('{from}', orderMeta(swap.from).name)
                .replace('{to}', orderMeta(swap.to).name)}
            </p>
            <small className={styles.swapNote}>{i18n.duel.swap.note}</small>
          </div>
        </div>
      )}

      {paused && (
        <Modal title={i18n.duel.toolbar.pause}>
          <p>{foeName} waits. The Tablet does not.</p>
          <div className={styles.modalActions}>
            <button className="btn btn-primary" onClick={() => setPaused(false)}>{i18n.duel.toolbar.resume}</button>
            <button className="btn btn-oxblood" onClick={() => { setPaused(false); duel.concede(); }}>{i18n.duel.toolbar.concede}</button>
          </div>
        </Modal>
      )}
      {confirmConcede && (
        <Modal title={i18n.duel.concedeConfirm.title}>
          <p>{i18n.duel.concedeConfirm.body}</p>
          <div className={styles.modalActions}>
            <button className="btn btn-oxblood" onClick={() => { setConfirmConcede(false); duel.concede(); }}>{i18n.duel.concedeConfirm.confirm}</button>
            <button className="btn" onClick={() => setConfirmConcede(false)}>{i18n.duel.concedeConfirm.cancel}</button>
          </div>
        </Modal>
      )}
    </main>
  );
}

function Modal({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={title}>
      <div className="panel modal-sheet page-turn" style={{ width: 'min(92vw, 340px)', padding: 20 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', marginBottom: 8 }}>{title}</h2>
        {children}
      </div>
    </div>
  );
}

// reseed helper for Rematch
export function rematchSpec(prev: DuelSessionSpec): DuelSessionSpec {
  return { ...prev, seed: `${prev.seed}-${new Rng(String(Date.now())).int(99999)}` };
}
