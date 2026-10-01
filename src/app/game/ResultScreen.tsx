// ResultScreen — S09: engraved banner, the Ledger of this Duel, rewards, Rematch/Antechamber, share card.
'use client';
import { useEffect, useRef } from 'react';
import { useUi } from '@/state/ui';
import { useSave } from '@/state/save';
import i18n from '@/i18n/en.json';
import { synth } from '@/audio/synth';

export default function ResultScreen() {
  const ui = useUi();
  const save = useSave((s) => s.save);
  const r = ui.lastResult;
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => { if (r) { r.winner === 0 ? synth.victory() : r.winner === 'draw' ? synth.draw() : synth.defeat(); } }, [r]);

  if (!r || !save) return null;
  const won = r.winner === 0;
  const draw = r.winner === 'draw';
  const banner = draw ? i18n.result.draw : won ? i18n.result.victory : i18n.result.defeat;
  const mins = Math.floor(r.timeMs / 60000);
  const secs = Math.floor((r.timeMs % 60000) / 1000);
  const spark = r.sealTimeline.map(([t, seals, p]) => `${(t / r.timeMs) * 300},${34 - seals * 4.5}`).join(' ') || '0,34 300,34';

  const share = () => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d')!;
    c.width = 600; c.height = 336;
    ctx.fillStyle = '#0e0e0f';
    ctx.fillRect(0, 0, 600, 336);
    ctx.strokeStyle = '#6f5b31';
    ctx.strokeRect(10, 10, 580, 316);
    ctx.fillStyle = '#cdb992';
    ctx.font = '28px Georgia';
    ctx.fillText('ASSIZE', 240, 56);
    ctx.font = '42px Georgia';
    ctx.fillStyle = won ? '#c9a962' : '#7b1a1f';
    ctx.fillText(banner, 40, 120);
    ctx.font = '16px Georgia';
    ctx.fillStyle = '#b8a27c';
    ctx.fillText(`Claims ${r.claims[0]}–${r.claims[1]} · Mistakes ${r.mistakes[0]}–${r.mistakes[1]} · ${mins}:${String(secs).padStart(2, '0')}`, 40, 170);
    ctx.fillText(r.ratingDelta !== null ? `Standing ${r.ratingDelta >= 0 ? '+' : ''}${r.ratingDelta}` : 'Shade duel — no Standing wagered', 40, 200);
    const url = c.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = 'assize-verdict.png';
    a.click();
  };

  return (
    <main style={{ minHeight: '100dvh', background: 'var(--ink-black)', padding: 'calc(var(--safe-top) + 20px) 16px 24px' }}>
      <div
        className="page-turn"
        style={{ textAlign: 'center', padding: '26px 10px', borderBottom: `2px solid ${won ? 'var(--brass)' : 'var(--oxblood)'}` }}
      >
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-2xl)', letterSpacing: '0.2em', color: won ? 'var(--brass)' : draw ? 'var(--fg-dim)' : 'var(--oxblood)' }}>
          {banner}
        </h1>
        {r.shadeDuel && <p style={{ color: 'var(--ash)', fontSize: 'var(--fs-xs)' }}>{i18n.result.shadeTag}</p>}
      </div>

      <section className="panel" style={{ margin: '14px 0', padding: 14 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-md)' }}>{i18n.result.ledger}</h2>
        <dl style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '4px 10px', marginTop: 8, fontSize: 'var(--fs-sm)' }}>
          <dt>{i18n.result.claims}</dt><dd className="digits">{r.claims[0]} – {r.claims[1]}</dd>
          <dt>{i18n.result.mistakes}</dt><dd className="digits">{r.mistakes[0]} – {r.mistakes[1]}</dd>
          <dt>{i18n.result.abilities}</dt><dd className="digits">{r.abilities[0]} – {r.abilities[1]}</dd>
          <dt>{i18n.result.time}</dt><dd className="digits">{mins}:{String(secs).padStart(2, '0')}</dd>
          <dt>{i18n.result.rating}</dt>
          <dd className="digits">{r.ratingDelta !== null ? `${r.ratingDelta >= 0 ? '+' : ''}${r.ratingDelta}` : '—'}</dd>
        </dl>
        <svg width="100%" height="40" aria-label={i18n.result.sparkline} style={{ marginTop: 8 }}>
          <polyline fill="none" stroke="var(--brass)" strokeWidth="1.5" points={spark} />
        </svg>
      </section>

      <section className="panel" style={{ margin: '10px 0', padding: 14, textAlign: 'center' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-md)' }}>{i18n.result.rewards}</h2>
        <p className="digits" style={{ fontSize: 'var(--fs-lg)', color: 'var(--brass)' }}>+{r.ink} <img src="/assets/icons/ink-drop.svg" alt="Ink" width={16} height={16} style={{ verticalAlign: '-2px' }} /></p>
        {r.reliquaryWon && <p style={{ color: 'var(--brass)' }}>{i18n.reliquary.title} — the wax is warm.</p>}
      </section>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', padding: '14px 0 20px', flexWrap: 'wrap' }}>
        {/* T18 — an endless rung rematches on the stair itself, not in the queue;
            T21 — a weekly sitting returns to the writs */}
        <button className="btn btn-primary" onClick={() => { if (ui.duelMode === 'endless') { ui.go('endless'); return; } if (ui.duelMode === 'weekly') { ui.go('weekly'); return; } ui.go('matchmaking', { duelMode: ui.duelMode === 'tutorial' ? 'shade' : ui.duelMode }); }}>{i18n.result.rematch}</button>
        <button className="btn" onClick={() => ui.go('antechamber')}>{i18n.result.antechamber}</button>
        <button className="btn btn-ghost" onClick={share}>{i18n.result.share}</button>
      </div>
      <canvas ref={canvasRef} hidden aria-hidden />
    </main>
  );
}
