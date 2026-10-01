// SeasonLedger — S16: 30 tiers, free + Patron tracks, progress, claim buttons, season timer.
'use client';
import { useUi } from '@/state/ui';
import { useSave } from '@/state/save';
import i18n from '@/i18n/en.json';
import Ribbon from './Ribbon';
import { synth } from '@/audio/synth';
import { recordInk } from '@/state/inkLedger';

const TIER_INK = 100; // escalating: tier n requires n * 100 cumulative Season Ink (docs/BALANCE.md)
const tierCost = (n: number) => TIER_INK * n;
const cumulative = (n: number) => (n * (n + 1) / 2) * TIER_INK;

export default function SeasonLedger() {
  const ui = useUi();
  const save = useSave((s) => s.save);
  if (!save) return null;
  const tiers = i18n.season.tiers;
  const currentTier = (() => {
    for (let n = 30; n >= 1; n--) if (save.season.ink >= cumulative(n)) return n;
    return 0;
  })();
  const nextCost = cumulative(currentTier + 1);
  const weeksLeft = Math.max(0, Math.ceil((save.season.endsAt - Date.now()) / (7 * 86400_000)));

  return (
    <main className="hub" style={{ minHeight: '100dvh', paddingBottom: 'calc(var(--ribbon-h) + var(--safe-bottom))' }}>
      <header style={{ padding: 'calc(var(--safe-top) + 14px) 16px 6px', textAlign: 'center' }}>
        <h1>{i18n.season.title}</h1>
        <p style={{ color: 'var(--fg-dim)', fontStyle: 'italic' }}>
          {i18n.season.timeLeft.replace('{weeks}', String(weeksLeft))} · {i18n.season.progress.replace('{ink}', String(Math.max(0, nextCost - save.season.ink))).replace('{next}', String(currentTier + 1))}
        </p>
        <div style={{ height: 8, border: '1px solid var(--line-strong)', marginTop: 8 }}>
          <div style={{ width: `${Math.min(100, (save.season.ink / nextCost) * 100)}%`, height: '100%', background: 'var(--brass)' }} />
        </div>
      </header>

      <ol style={{ listStyle: 'none', display: 'grid', gap: 6, padding: '10px 16px' }}>
        {tiers.map((t, i) => {
          const n = i + 1;
          const unlocked = save.season.ink >= cumulative(n);
          const claimedFree = save.season.claimed.includes(`f${n}`);
          const claimable = unlocked && !claimedFree;
          return (
            <li key={n} className="panel" style={{ padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 10, opacity: unlocked ? 1 : 0.55 }}>
              <b className="roman" style={{ width: 30, textAlign: 'center' }}>{n}</b>
              <div style={{ flex: 1 }}>
                <b style={{ fontFamily: 'var(--font-display)' }}>{t.name}</b>
                <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--fg-dim)' }}>
                  {t.type === 'ink' ? `+${n * 10} Ink` : t.type === 'sigil' ? `+${Math.ceil(n / 4)} Sigils` : 'Cosmetic — the Cabinet'} · Free / {save.season.patron ? 'Patron' : i18n.season.patronUnlock}
                </p>
              </div>
              <button
                className="btn"
                style={{ minHeight: 36, fontSize: 'var(--fs-xs)' }}
                disabled={!claimable}
                onClick={() => {
                  synth.uiTap();
                  useSave.getState().update((s) => ({
                    ...s,
                    season: { ...s.season, claimed: [...s.season.claimed, `f${n}`] },
                    economy: t.type === 'ink'
                      ? { ...s.economy, ink: s.economy.ink + n * 10 }
                      : t.type === 'sigil'
                        ? { ...s.economy, sigils: s.economy.sigils + Math.ceil(n / 4) }
                        : s.economy,
                  }));
                  if (t.type === 'ink') recordInk({ duelId: `season-f${n}`, mode: 'season', delta: n * 10 });
                }}
              >
                {claimedFree ? i18n.season.claimed : claimable ? i18n.season.claim : `${cumulative(n)} ink`}
              </button>
            </li>
          );
        })}
      </ol>
      <Ribbon />
    </main>
  );
}
