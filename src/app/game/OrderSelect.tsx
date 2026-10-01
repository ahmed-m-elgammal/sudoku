// OrderSelect — S04: horizontal snap carousel of four tarot cards; locked orders show conditions.
'use client';
import { useState } from 'react';
import { useUi } from '@/state/ui';
import { useSave } from '@/state/save';
import { ORDERS } from '@shared/orders';
import i18n from '@/i18n/en.json';
import { synth } from '@/audio/synth';
import Ribbon from './Ribbon';

export default function OrderSelect() {
  const ui = useUi();
  const save = useSave((s) => s.save);
  const [chosen, setChosen] = useState(save?.order ?? 'scholar');
  if (!save) return null;

  return (
    <main className="hub" style={{ minHeight: '100dvh', paddingBottom: 'calc(var(--ribbon-h) + var(--safe-bottom))' }}>
      <header style={{ padding: 'calc(var(--safe-top) + 14px) 16px 6px', textAlign: 'center' }}>
        <h1>{i18n.orders.select}</h1>
        <p style={{ color: 'var(--fg-dim)', fontStyle: 'italic' }}>{i18n.orders.selectSub}</p>
      </header>
      <div
        className="order-carousel"
        style={{ display: 'flex', overflowX: 'auto', scrollSnapType: 'x mandatory', gap: 14, padding: '14px 24px 10px' }}
      >
        {ORDERS.map((o) => {
          const locked = !save.unlockedOrders.includes(o.id);
          const selected = chosen === o.id;
          return (
            <button
              key={o.id}
              onClick={() => { synth.uiTap(); if (!locked) setChosen(o.id); }}
              aria-pressed={selected}
              className="panel order-card page-turn"
              style={{
                scrollSnapAlign: 'center', flex: '0 0 240px', padding: 14, textAlign: 'center',
                borderColor: selected ? 'var(--brass)' : 'var(--line-strong)',
                opacity: locked ? 0.55 : 1,
              }}
            >
              <img src={o.portrait} alt={o.name} width={200} height={250} style={{ borderRadius: 3, border: '1px solid var(--line-strong)' }} />
              <h2 style={{ fontSize: 'var(--fs-lg)', marginTop: 8 }}>{o.name}</h2>
              <p style={{ color: 'var(--brass)', fontSize: 'var(--fs-xs)', letterSpacing: '0.12em' }}>{o.epithet}</p>
              <p style={{ fontStyle: 'italic', margin: '6px 0', fontSize: 'var(--fs-sm)' }}>
                <b>{i18n.orders.passive}:</b> {i18n.orders[o.id].passive}
              </p>
              <ul style={{ listStyle: 'none', display: 'grid', gap: 4, fontSize: 'var(--fs-sm)', textAlign: 'left' }}>
                {o.abilities.map((a, i) => (
                  <li key={a.id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <img src={`/assets/sigils/${a.icon}.svg`} alt="" width={22} height={22} />
                    <span><b>{i18n.orders[o.id].abilities[a.id].name}</b> · {i18n.orders[o.id].abilities[a.id].desc}</span>
                    <kbd aria-hidden style={{ marginLeft: 'auto', color: 'var(--line-strong)' }}>{['Q', 'W', 'E'][i]}</kbd>
                  </li>
                ))}
              </ul>
              {locked && (
                <p style={{ marginTop: 8, color: 'var(--oxblood)' }}>
                  {i18n.common.locked} — {o.unlockAfter === 'folio-2' ? 'after Folio II' : 'after Folio IV'}
                </p>
              )}
            </button>
          );
        })}
      </div>
      <div style={{ display: 'grid', placeItems: 'center', padding: '8px 0 20px' }}>
        <button
          className="btn btn-primary"
          onClick={() => {
            synth.stamp();
            useSave.getState().update((s) => ({ ...s, order: chosen }));
            const mode = ui.duelMode === 'practice' ? 'practice' : 'shade';
            ui.go(mode === 'practice' ? 'matchmaking' : 'matchmaking', { duelMode: mode });
          }}
        >
          {i18n.orders.take}
        </button>
      </div>
      <Ribbon />
    </main>
  );
}
