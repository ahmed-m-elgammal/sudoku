// EchoesScreen (T7) — the shelf of stored ink-echoes. Each entry is a validated
// replay of a real duel; tapping one sets the session and enters a replay duel
// where the foe replays that Clerk's recorded ink.
// T17 — "Your Shade": your newest echo mined into a personal profile, so your own
// ink rises against you on a fresh tablet (fail-closed: faint ink → visible note,
// the calibrated standing Shade answers instead).
'use client';
import { useEffect, useMemo, useState } from 'react';
import { useUi } from '@/state/ui';
import { useSave } from '@/state/save';
import i18n from '@/i18n/en.json';
import { synth } from '@/audio/synth';
import { listEchoes, type EchoEntry } from '@/game/echoes';
import { describeEcho } from '@shared/replay';
import { minePersonalShade, type MinedShade } from '@shared/personalShade';
import { profileForStanding, clampProfile } from '@shared/shade';

export default function EchoesScreen() {
  const ui = useUi();
  const save = useSave((s) => s.save);
  const [entries, setEntries] = useState<EchoEntry[] | null>(null); // null = loading

  useEffect(() => {
    let alive = true;
    void listEchoes().then((e) => { if (alive) setEntries(e); });
    return () => { alive = false; };
  }, []);

  // your Shade lives in your newest ink — mined once per shelf render, purely
  const mined: MinedShade | null = useMemo(
    () => (entries && entries.length ? minePersonalShade(entries[0].replay) : null),
    [entries],
  );

  const duelYourShade = () => {
    synth.uiTap();
    const newest = entries?.[0];
    if (!newest) return;
    // fail-closed: a faint echo still duels — the calibrated Shade wears the name
    const profile = mined?.profile ?? clampProfile({
      ...profileForStanding(save?.standing ?? 1000),
      name: `Shade of ${newest.replay.names[0]}`,
      order: newest.replay.orders[0],
    });
    ui.go('duel', { duelMode: 'shade', pendingPersonalShade: { replay: newest.replay, profile }, campaignDuel: null });
  };

  const statsLine = (m: MinedShade): string =>
    i18n.echoes.yourShadeStats
      .replace('{pace}', (m.profile.placeCadenceMs! / 1000).toFixed(1))
      .replace('{err}', String(Math.round(m.telemetry.wrong / Math.max(1, m.telemetry.placements) * 100)))
      .replace('{rites}', String(m.telemetry.casts));

  return (
    <main className="page-turn" style={{ minHeight: '100dvh', padding: 'calc(var(--safe-top) + 18px) 16px calc(var(--safe-bottom) + 24px)' }}>
      <header style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 8 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-lg)' }}>{i18n.echoes.title}</h1>
        {entries && entries.length > 0 && (
          <span style={{ color: 'var(--fg-dim)', fontSize: 'var(--fs-xs)' }}>
            {i18n.echoes.count.replace('{n}', String(entries.length))}
          </span>
        )}
      </header>
      <p style={{ color: 'var(--fg-dim)', fontSize: 'var(--fs-sm)', maxWidth: 520, marginBottom: 14 }}>{i18n.echoes.sub}</p>

      {entries === null && (
        <p style={{ color: 'var(--fg-dim)', fontSize: 'var(--fs-sm)' }} aria-busy="true">…</p>
      )}

      {/* T17 — Your Shade, raised from the newest ink on the shelf */}
      {entries !== null && entries.length > 0 && (
        <div className="panel card" style={{ maxWidth: 560, marginBottom: 14, borderColor: 'var(--accent)' }}>
          <h3 style={{ fontSize: 'var(--fs-md)', fontFamily: 'var(--font-display)' }}>{i18n.echoes.yourShadeTitle}</h3>
          <p style={{ color: 'var(--fg-dim)', fontSize: 'var(--fs-xs)', marginTop: 4 }}>{i18n.echoes.yourShadeSub}</p>
          <p style={{ color: mined ? 'var(--fg)' : 'var(--fg-dim)', fontSize: 'var(--fs-xs)', marginTop: 6 }}>
            {mined
              ? <>Shade of {entries[0].replay.names[0]} · {statsLine(mined)}</>
              : i18n.echoes.yourShadeFaint}
          </p>
          <button
            className="btn btn-primary"
            onClick={duelYourShade}
            style={{ marginTop: 10, width: '100%', minHeight: 44 }}
          >
            {i18n.echoes.yourShadeDuel} →
          </button>
        </div>
      )}

      {entries !== null && entries.length === 0 && (
        <p className="panel" style={{ padding: 16, fontSize: 'var(--fs-sm)', color: 'var(--fg-dim)' }}>{i18n.echoes.empty}</p>
      )}

      <div style={{ display: 'grid', gap: 10, maxWidth: 560 }}>
        {(entries ?? []).map((e) => (
          <button
            key={e.key}
            className="panel card"
            onClick={() => {
              synth.uiTap();
              ui.go('duel', { duelMode: 'replay', pendingEcho: e.replay, campaignDuel: null });
            }}
            style={{ textAlign: 'left' }}
          >
            <h3 style={{ fontSize: 'var(--fs-md)' }}>Shade of {e.replay.names[0]}</h3>
            <p style={{ color: 'var(--fg-dim)', fontSize: 'var(--fs-xs)' }}>
              {describeEcho(e.replay)} · {e.replay.orders[0]} vs {e.replay.orders[1]}
            </p>
            <p style={{ color: 'var(--accent)', fontSize: 'var(--fs-xs)', marginTop: 6 }}>{i18n.echoes.duel} →</p>
          </button>
        ))}
      </div>

      <button
        className="panel card"
        onClick={() => { synth.uiTap(); ui.go('antechamber'); }}
        style={{ marginTop: 16, maxWidth: 560, width: '100%', textAlign: 'center', color: 'var(--fg-dim)' }}
      >
        ← {i18n.echoes.back}
      </button>
    </main>
  );
}
