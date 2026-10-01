// DailyScreen — S14: today's puzzle card, countdown to next, leaderboard top 100, streak, candles.
'use client';
import { useEffect, useState } from 'react';
import { useUi } from '@/state/ui';
import { useSave } from '@/state/save';
import { net } from '@/net/client';
import i18n from '@/i18n/en.json';
import { todayUtcKey } from '@shared/rng';
import { tierForDailyDate } from '@shared/sudoku';
import Ribbon from './Ribbon';
import { synth } from '@/audio/synth';

interface DailyData {
  dateKey: string;
  tier: string;
  leaderboard: Array<{ name: string; timeMs: number; mistakes: number; rank: number; you?: boolean }>;
  yourRank: number | null;
  streak: number;
}

export default function DailyScreen() {
  const ui = useUi();
  const save = useSave((s) => s.save);
  const [data, setData] = useState<DailyData | null>(null);
  const [countdown, setCountdown] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const key = todayUtcKey();
  const done = save?.daily.lastDate === key;

  useEffect(() => {
    (async () => {
      try {
        const d = (await net.daily(key)) as DailyData | null;
        setData(d);
      } catch { setError(true); }
      setLoading(false);
    })();
  }, [key]);

  useEffect(() => {
    const iv = setInterval(() => {
      const now = new Date();
      const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
      const s = Math.max(0, Math.floor((next - now.getTime()) / 1000));
      setCountdown(`${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`);
    }, 1000);
    return () => clearInterval(iv);
  }, []);

  if (!save) return null;

  return (
    <main className="hub" style={{ minHeight: '100dvh', paddingBottom: 'calc(var(--ribbon-h) + var(--safe-bottom))' }}>
      <header style={{ padding: 'calc(var(--safe-top) + 14px) 16px 6px', textAlign: 'center' }}>
        <h1>{i18n.daily.title}</h1>
        <p style={{ color: 'var(--fg-dim)', fontStyle: 'italic' }}>{i18n.daily.sub}</p>
      </header>

      <section className="panel page-turn" style={{ margin: '8px 16px', padding: 14, textAlign: 'center' }}>
        <img src={`/assets/reliquary/candle-${done ? 'lit' : 'unlit'}.svg`} alt="" width={40} height={40} />
        <p style={{ marginTop: 6 }}>
          <b>{key}</b> · Tier {tierForDailyDate(key)}
        </p>
        <p style={{ color: 'var(--fg-dim)', fontSize: 'var(--fs-sm)' }}>{i18n.daily.mistakeNote}</p>
        <p style={{ color: 'var(--fg-dim)', fontSize: 'var(--fs-sm)' }}>
          {i18n.daily.streak}: {save.daily.streak} · {i18n.daily.countdown} {countdown}
        </p>
        {done ? (
          <>
            <p style={{ marginTop: 8, color: 'var(--brass)' }}>{i18n.daily.attempted}</p>
            <button className="btn btn-ghost" style={{ marginTop: 6 }} onClick={() => alert(i18n.daily.candleNote)}>
              🕯 {i18n.daily.candle} ({save.daily.candlesToday}/3)
            </button>
          </>
        ) : (
          <button
            className="btn btn-primary"
            style={{ marginTop: 10 }}
            onClick={() => { synth.stamp(); ui.go('duel', { duelMode: 'daily' }); }}
          >
            {i18n.daily.start}
          </button>
        )}
      </section>

      <section className="panel" style={{ margin: '10px 16px', padding: 14 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-md)' }}>{i18n.daily.leaderboard}</h2>
        {loading && <p className="skeleton-parchment" style={{ height: 60, marginTop: 8 }} />}
        {error && <p style={{ color: 'var(--fg-dim)', fontStyle: 'italic', marginTop: 8 }}>{i18n.offline.body}</p>}
        {data && data.leaderboard.length === 0 && <p style={{ color: 'var(--fg-dim)', marginTop: 8 }}>{i18n.daily.emptyBoard}</p>}
        {data && (
          <ol style={{ listStyle: 'none', marginTop: 8, maxHeight: 260, overflowY: 'auto' }}>
            {data.leaderboard.slice(0, 100).map((row) => (
              <li
                key={row.rank}
                style={{
                  display: 'flex', gap: 8, padding: '5px 6px', fontSize: 'var(--fs-sm)',
                  borderBottom: '1px solid var(--line)',
                  background: row.you ? 'rgba(165,136,73,0.12)' : undefined,
                }}
              >
                <b className="digits" style={{ width: 34 }}>{row.rank}</b>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.name}{row.you ? ` (${i18n.daily.you})` : ''}</span>
                <span className="digits">{Math.floor(row.timeMs / 60000)}:{String(Math.floor((row.timeMs % 60000) / 1000)).padStart(2, '0')}</span>
                <span className="digits" style={{ color: 'var(--fg-dim)', width: 44, textAlign: 'right' }}>{row.mistakes} ✗</span>
              </li>
            ))}
          </ol>
        )}
      </section>
      <Ribbon />
    </main>
  );
}
