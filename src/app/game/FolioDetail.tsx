// FolioDetail — S12: portrait, challenge text, three duels with stars, loadout hint, Begin.
'use client';
import { useUi } from '@/state/ui';
import { useSave } from '@/state/save';
import { FOLIOS, orderMeta } from '@shared/orders';
import i18n from '@/i18n/en.json';
import story from '@/i18n/story.json';
import { synth } from '@/audio/synth';
import Ribbon from './Ribbon';

export default function FolioDetail() {
  const ui = useUi();
  const save = useSave((s) => s.save);
  const ptr = ui.campaignDuel ?? { folio: 0, duel: 0 };
  const folio = FOLIOS[ptr.folio];
  if (!save) return null;
  const mag = folio.duels[2];
  const magText = (story.mag as Record<string, { challenge: string[]; defeat: string[]; taunt: string[]; folio: string }>)[folio.key];

  return (
    <main className="hub" style={{ minHeight: '100dvh', paddingBottom: 'calc(var(--ribbon-h) + var(--safe-bottom))' }}>
      <header style={{ display: 'flex', gap: 12, padding: 'calc(var(--safe-top) + 14px) 16px 8px', alignItems: 'flex-start' }}>
        <img
          src={`/assets/portraits/mag-${folio.key}.webp`}
          alt={mag.name} width={92} height={115}
          style={{ border: '2px solid var(--brass-dim)', borderRadius: 3, objectFit: 'cover' }}
        />
        <div>
          <h1 style={{ fontSize: 'var(--fs-lg)' }}>{(story.folios as Record<string, { title: string }>)[folio.key].title}</h1>
          <p style={{ color: 'var(--fg-dim)', fontStyle: 'italic', fontSize: 'var(--fs-sm)' }}>{(story.folios as Record<string, { sub: string }>)[folio.key].sub}</p>
        </div>
      </header>

      <blockquote className="panel" style={{ margin: '8px 16px', padding: 12, fontStyle: 'italic' }}>
        {magText.challenge.map((l, i) => <p key={i}>{l}</p>)}
      </blockquote>

      <ol style={{ listStyle: 'none', display: 'grid', gap: 8, padding: '4px 16px' }}>
        {folio.duels.map((d, i) => {
          const stars = save.campaign.stars[`${ptr.folio}-${i}`] ?? 0;
          const locked = i > save.campaign.duelIdx || ptr.folio > save.campaign.folioIdx;
          const current = i === save.campaign.duelIdx && ptr.folio === save.campaign.folioIdx;
          return (
            <li key={i} className="panel" style={{ padding: 10, display: 'grid', gap: 4, opacity: locked ? 0.55 : 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <b style={{ fontFamily: 'var(--font-display)' }}>
                  {d.shadeKind === 'magistrate' ? mag.name : `${d.name} (Shade)`}
                </b>
                <span style={{ color: 'var(--fg-dim)', fontSize: 'var(--fs-xs)' }}>
                  {d.tier} · {d.seals} Seals · {orderMeta(d.order).name}
                </span>
                <span aria-label={`${stars} of 3 stars`} style={{ marginLeft: 'auto', color: 'var(--brass)', letterSpacing: 2 }}>
                  {'★'.repeat(stars)}{'☆'.repeat(3 - stars)}
                </span>
              </div>
              <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--fg-dim)' }}>
                {d.shadeKind === 'magistrate' ? 'Loadout: their own Order, 8 Seals.' : 'Loadout hint: their Order, 7 Seals.'}
              </p>
              {current && !locked && (
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    synth.stamp();
                    ui.go('duel', { duelMode: 'campaign', campaignDuel: { folio: ptr.folio, duel: i } });
                  }}
                >
                  {i18n.common.begin}
                </button>
              )}
            </li>
          );
        })}
      </ol>
      <Ribbon />
    </main>
  );
}
