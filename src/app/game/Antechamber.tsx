// Antechamber — S03 home hub: header (portrait, name, rank emblem, Ink/Sigils), hero card,
// Daily / Folios / Season / Friend / Practice cards. Ribbon at bottom.
'use client';
import { useUi } from '@/state/ui';
import { useSave } from '@/state/save';
import { rankOfStanding } from './rank';
import { orderMeta } from '@shared/orders';
import i18n from '@/i18n/en.json';
import Ribbon from './Ribbon';
import { synth } from '@/audio/synth';
import { todayUtcKey } from '@shared/rng';

export default function Antechamber() {
  const ui = useUi();
  const save = useSave((s) => s.save);
  if (!save) return null;
  const rank = rankOfStanding(save.standing);
  const folioDuels = save.campaign.folioIdx * 3 + save.campaign.duelIdx;
  const dailyDone = save.daily.lastDate === todayUtcKey();

  return (
    <main className="hub" style={{ minHeight: '100dvh', paddingBottom: 'calc(var(--ribbon-h) + var(--safe-bottom))' }}>
      <header className="hub-header" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 'calc(var(--safe-top) + 12px) 16px 10px' }}>
        <span
          className="portrait-chip"
          style={{ backgroundImage: `url(${orderMeta(save.order).portrait})` }}
          role="img" aria-label="Your portrait"
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ fontSize: 'var(--fs-lg)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{save.name}</h1>
          <p style={{ color: 'var(--fg-dim)', fontSize: 'var(--fs-sm)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <img src={`/assets/ranks/rank-${rank.id}.svg`} alt="" width={18} height={18} />
            {rank.label} · Standing {save.standing}
          </p>
        </div>
        <div style={{ textAlign: 'right', display: 'grid', gap: 2 }}>
          <span className="currency"><img src="/assets/icons/ink-drop.svg" alt="" width={14} height={14} /> {save.economy.ink}</span>
          <span className="currency"><img src="/assets/icons/sigil-coin.svg" alt="" width={14} height={14} /> {save.economy.sigils}</span>
        </div>
        <button aria-label={i18n.settings.title} onClick={() => { synth.uiTap(); ui.go('settings'); }} style={{ fontSize: 18, color: 'var(--fg-dim)' }}>⚙</button>
      </header>

      <div className="hub-cards" style={{ display: 'grid', gap: 10, padding: '0 16px' }}>
        <button className="panel hero-card page-turn" onClick={() => { synth.uiTap(); ui.go('matchmaking'); }}>
          <h2>{i18n.hub.enter}</h2>
          <p>{i18n.hub.enterSub}</p>
        </button>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <button className="panel card" onClick={() => { synth.uiTap(); ui.go('daily'); }}>
            <img src={`/assets/reliquary/candle-${dailyDone ? 'lit' : 'unlit'}.svg`} alt="" width={26} height={26} />
            <h3>{i18n.hub.daily}</h3>
            <p>{i18n.hub.dailySub.replace('{streak}', String(save.daily.streak))}</p>
          </button>
          <button className="panel card" onClick={() => { synth.uiTap(); ui.go('folioMap'); }}>
            <h3>{i18n.hub.folios}</h3>
            <p>
              {save.campaign.ended
                ? i18n.hub.foliosSettled.replace('{ending}', save.campaign.ending === 'burn' ? i18n.hub.endingBurned : i18n.hub.endingBalanced)
                : i18n.hub.foliosSub.replace('{done}', String(folioDuels))}
            </p>
          </button>
          <button className="panel card" onClick={() => { synth.uiTap(); ui.go('season'); }}>
            <h3>{i18n.hub.season}</h3>
            <p>{i18n.hub.seasonSub.replace('{tier}', String(Math.min(30, Math.floor(save.season.ink / 100) + 1))).replace('{ink}', String(save.season.ink))}</p>
          </button>
          <button className="panel card" onClick={() => { synth.uiTap(); ui.go('friend'); }}>
            <h3>{i18n.hub.friend}</h3>
            <p>{i18n.hub.friendSub}</p>
          </button>
        </div>

        <button className="panel card" onClick={() => { synth.uiTap(); ui.go('orders', { duelMode: 'practice' }); }}>
          <h3>{i18n.hub.practice}</h3>
          <p>{i18n.hub.practiceSub}</p>
        </button>

        {/* T7 — the shelf of stored ink-echoes; each one duels back */}
        <button className="panel card" onClick={() => { synth.uiTap(); ui.go('echoes'); }}>
          <h3>{i18n.hub.echoes}</h3>
          <p>{i18n.hub.echoesSub}</p>
        </button>
      </div>
      <Ribbon />
    </main>
  );
}
