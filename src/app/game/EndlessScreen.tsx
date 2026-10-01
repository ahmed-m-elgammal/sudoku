// EndlessScreen (T18) — the Endless Assize: the Nine Folios as a circuit that
// never closes. Shows the current rung, the best ever cleared, the foe waiting
// on this rung (deterministically derived from the save's salt) and the queue
// of the next three. Ascend → duel the rung; a win moves you up, a loss returns
// you to the foot of the stair (best stays).
'use client';
import { useMemo } from 'react';
import { useUi } from '@/state/ui';
import { useSave } from '@/state/save';
import i18n from '@/i18n/en.json';
import { synth } from '@/audio/synth';
import { endlessFoe } from '@shared/endless';

export default function EndlessScreen() {
  const ui = useUi();
  const save = useSave((s) => s.save);
  const ladder = save?.endless;

  // the rung ladder is pure derivation — memo it per save
  const { foe, queue } = useMemo(() => {
    if (!ladder) return { foe: null, queue: [] as ReturnType<typeof endlessFoe>[] };
    const f = endlessFoe(ladder.current, ladder.salt);
    const q = [1, 2, 3].map((k) => endlessFoe(ladder.current + k, ladder.salt));
    return { foe: f, queue: q };
  }, [ladder]);

  if (!save || !ladder || !foe) return null;
  const rungNo = ladder.current + 1;

  return (
    <main className="page-turn" style={{ minHeight: '100dvh', padding: 'calc(var(--safe-top) + 18px) 16px calc(var(--safe-bottom) + 24px)' }}>
      <header style={{ marginBottom: 8 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-lg)' }}>{i18n.endless.title}</h1>
      </header>
      <p style={{ color: 'var(--fg-dim)', fontSize: 'var(--fs-sm)', maxWidth: 520, marginBottom: 14 }}>{i18n.endless.sub}</p>

      <div style={{ display: 'grid', gap: 10, maxWidth: 560 }}>
        <div className="panel card" style={{ display: 'flex', gap: 18, alignItems: 'baseline', padding: '14px 16px' }}>
          <div>
            <p style={{ color: 'var(--fg-dim)', fontSize: 'var(--fs-xs)' }}>{i18n.endless.rungLabel}</p>
            <p className="digits" style={{ fontSize: 'var(--fs-2xl)', fontFamily: 'var(--font-display)', color: 'var(--brass)' }}>{rungNo}</p>
          </div>
          <div>
            <p style={{ color: 'var(--fg-dim)', fontSize: 'var(--fs-xs)' }}>{i18n.endless.bestLabel}</p>
            <p className="digits" style={{ fontSize: 'var(--fs-2xl)', fontFamily: 'var(--font-display)' }}>{ladder.best}</p>
          </div>
        </div>

        <div className="panel card" style={{ padding: '14px 16px', maxWidth: 560 }}>
          <p style={{ color: 'var(--fg-dim)', fontSize: 'var(--fs-xs)' }}>{i18n.endless.nextLabel}</p>
          <h3 style={{ fontSize: 'var(--fs-md)', fontFamily: 'var(--font-display)', marginTop: 4 }}>{foe.name}</h3>
          <p style={{ color: 'var(--fg-dim)', fontSize: 'var(--fs-xs)', marginTop: 4 }}>
            {foe.tier} · {foe.seals[1]} {i18n.endless.seals}
            {foe.bossRung ? ` · ${i18n.endless.bossBadge}` : ''}
          </p>
          <p style={{ color: 'var(--fg-dim)', fontSize: 'var(--fs-xs)', marginTop: 6 }}>
            {i18n.endless.queueLabel} {queue.map((q) => q.name).join(' · ')}
          </p>
          <button
            className="btn btn-primary"
            onClick={() => {
              synth.uiTap();
              ui.go('duel', { duelMode: 'endless', endlessRung: ladder.current, campaignDuel: null, pendingEcho: null, pendingPersonalShade: null });
            }}
            style={{ marginTop: 12, width: '100%', minHeight: 44 }}
          >
            {i18n.endless.ascend} →
          </button>
        </div>

        <p style={{ color: 'var(--fg-dim)', fontSize: 'var(--fs-xs)', maxWidth: 560 }}>{i18n.endless.law}</p>
      </div>

      <button
        className="panel card"
        onClick={() => { synth.uiTap(); ui.go('antechamber'); }}
        style={{ marginTop: 16, maxWidth: 560, width: '100%', textAlign: 'center', color: 'var(--fg-dim)' }}
      >
        ← {i18n.endless.back}
      </button>
    </main>
  );
}
