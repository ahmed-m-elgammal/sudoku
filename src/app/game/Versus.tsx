// Versus — S07: tarot cards slam together, stakes, 3-2-1 sealed-tablet reveal, then the duel.
'use client';
import { useEffect, useState } from 'react';
import { useUi } from '@/state/ui';
import { useSave } from '@/state/save';
import i18n from '@/i18n/en.json';
import { orderMeta } from '@shared/orders';
import { synth } from '@/audio/synth';

export default function Versus() {
  const ui = useUi();
  const save = useSave((s) => s.save);
  const foe = ui.pendingFoe;
  const [phase, setPhase] = useState(0); // 0 slam, 1 stakes, 2..4 countdown, 5 go

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 700),
      setTimeout(() => { setPhase(2); synth.stamp(); }, 1500),
      setTimeout(() => { setPhase(3); synth.uiTap(); }, 2100),
      setTimeout(() => { setPhase(4); synth.uiTap(); }, 2700),
      setTimeout(() => ui.go('duel'), 3300),
    ];
    return () => timers.forEach(clearTimeout);
  }, [ui]);

  if (!foe || !save) return null;
  const mine = orderMeta(save.order);
  const theirs = orderMeta(foe.order as 'scholar');

  return (
    <main style={{ height: '100dvh', display: 'grid', placeItems: 'center', background: 'var(--ink-black)', overflow: 'hidden' }}>
      <div style={{ textAlign: 'center', width: '100%', maxWidth: 480 }}>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8 }}>
          <img src={mine.portrait} alt={mine.name} width={128} height={160}
            className={phase === 0 ? 'slam-left' : ''}
            style={{ border: '2px solid var(--brass-dim)', borderRadius: 3 }} />
          <img src={theirs.portrait} alt={foe.name} width={128} height={160}
            className={phase === 0 ? 'slam-right' : ''}
            style={{ border: `2px solid ${foe.shade ? 'var(--ash)' : 'var(--oxblood)'}`, borderRadius: 3, opacity: foe.shade ? 0.85 : 1 }} />
        </div>
        <p style={{ marginTop: 10, fontFamily: 'var(--font-display)' }}>
          {save.name} <span style={{ color: 'var(--brass)' }}>·</span> {foe.name}
          {foe.shade && <small style={{ color: 'var(--ash)', marginLeft: 6 }}>ink-echo</small>}
        </p>
        {phase >= 1 && (
          <p style={{ color: 'var(--fg-dim)', fontSize: 'var(--fs-sm)' }}>
            {i18n.versus.stakes.replace('{tier}', foe.tier ?? 'Ranked').replace('{rating}', String(save.standing))}
          </p>
        )}
        {phase >= 2 && (
          <p className="roman digits" style={{ fontSize: 64, color: 'var(--brass)', marginTop: 6 }}>
            {i18n.versus.countdown[phase - 2]}
          </p>
        )}
      </div>
      <style>{`
        .slam-left { animation: slamL 700ms cubic-bezier(.2,.8,.2,1) both; }
        .slam-right { animation: slamR 700ms cubic-bezier(.2,.8,.2,1) both; }
        @keyframes slamL { from { transform: translateX(-70vw) rotate(-14deg); } to { transform: none; } }
        @keyframes slamR { from { transform: translateX(70vw) rotate(14deg); } to { transform: none; } }
      `}</style>
    </main>
  );
}
