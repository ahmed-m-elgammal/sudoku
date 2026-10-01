// EchoesScreen (T7) — the shelf of stored ink-echoes. Each entry is a validated
// replay of a real duel; tapping one sets the session and enters a replay duel
// where the foe replays that Clerk's recorded ink.
'use client';
import { useEffect, useState } from 'react';
import { useUi } from '@/state/ui';
import i18n from '@/i18n/en.json';
import { synth } from '@/audio/synth';
import { listEchoes, type EchoEntry } from '@/game/echoes';
import { describeEcho } from '@shared/replay';

export default function EchoesScreen() {
  const ui = useUi();
  const [entries, setEntries] = useState<EchoEntry[] | null>(null); // null = loading

  useEffect(() => {
    let alive = true;
    void listEchoes().then((e) => { if (alive) setEntries(e); });
    return () => { alive = false; };
  }, []);

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
