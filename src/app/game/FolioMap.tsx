// FolioMap — S11: engraved plate map of Novem with nine Roman-numeral nodes, fog on locked ones.
'use client';
import { useUi } from '@/state/ui';
import { useSave } from '@/state/save';
import { FOLIOS } from '@shared/orders';
import i18n from '@/i18n/en.json';
import Ribbon from './Ribbon';
import { synth } from '@/audio/synth';

// node positions in % of the plate (matches manifest folio-map record)
const NODES = [
  { x: 50, y: 12 }, { x: 72, y: 22 }, { x: 78, y: 45 },
  { x: 66, y: 64 }, { x: 50, y: 74 }, { x: 33, y: 64 },
  { x: 22, y: 45 }, { x: 28, y: 22 }, { x: 50, y: 42 },
];

export default function FolioMap() {
  const ui = useUi();
  const save = useSave((s) => s.save);
  if (!save) return null;

  return (
    <main className="hub" style={{ minHeight: '100dvh', paddingBottom: 'calc(var(--ribbon-h) + var(--safe-bottom))' }}>
      <header style={{ padding: 'calc(var(--safe-top) + 14px) 16px 6px', textAlign: 'center' }}>
        <h1>{i18n.hub.folios}</h1>
        <p style={{ color: 'var(--fg-dim)', fontStyle: 'italic' }}>{i18n.hub.foliosSub.replace('{done}', String(save.campaign.folioIdx * 3 + save.campaign.duelIdx))}</p>
      </header>
      <div className="page-turn" style={{ position: 'relative', width: 'min(94vw, 420px)', margin: '8px auto', aspectRatio: '1080/1600' }}>
        <img src="/assets/map/folio-map.webp" alt="The walled city of Novem" style={{ width: '100%', height: '100%', objectFit: 'cover', border: '2px solid var(--line-strong)' }} />
        {NODES.map((n, i) => {
          const locked = i > save.campaign.folioIdx;
          const current = i === save.campaign.folioIdx;
          const done = i < save.campaign.folioIdx;
          return (
            <button
              key={i}
              disabled={locked}
              onClick={() => { synth.uiTap(); ui.go('folioDetail', { campaignDuel: { folio: i, duel: save.campaign.folioIdx === i ? save.campaign.duelIdx : 0 } }); }}
              aria-label={`Folio ${FOLIOS[i].numeral}${locked ? ' (locked)' : ''}`}
              style={{
                position: 'absolute', left: `${n.x}%`, top: `${n.y}%`, transform: 'translate(-50%,-50%)',
                width: 44, height: 44, borderRadius: '50%',
                border: `2px solid ${done ? 'var(--brass)' : current ? 'var(--oxblood)' : 'var(--line-strong)'}`,
                background: locked ? 'var(--charcoal-2)' : 'var(--charcoal)',
                color: locked ? 'var(--line-strong)' : done ? 'var(--brass)' : 'var(--parchment-light)',
                fontFamily: 'var(--font-display)', fontSize: 'var(--fs-md)',
                opacity: locked ? 0.5 : 1,
                filter: locked ? 'grayscale(1)' : 'none',
                minHeight: 44, minWidth: 44,
              }}
            >
              {locked ? '✕' : FOLIOS[i].numeral}
            </button>
          );
        })}
      </div>
      <Ribbon />
    </main>
  );
}
