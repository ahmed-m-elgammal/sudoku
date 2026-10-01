// ReliquaryScreen — S10: 4s ritual (chest frames x8), item card, rarity by border, rates panel.
'use client';
import { useEffect, useState } from 'react';
import { useUi } from '@/state/ui';
import { useSave } from '@/state/save';
import i18n from '@/i18n/en.json';
import { synth } from '@/audio/synth';
import { recordInk } from '@/state/inkLedger';

const DROP_TABLE = [
  { id: 'wax-verdigris', name: 'Verdigris Wax', rarity: 'common', kind: 'seals' },
  { id: 'wax-gilt', name: 'Gilt Wax', rarity: 'common', kind: 'seals' },
  { id: 'board-bone', name: 'Bone Board', rarity: 'common', kind: 'boards' },
  { id: 'board-slate', name: 'Slate Board', rarity: 'common', kind: 'boards' },
  { id: 'frame-iron', name: 'Iron Frame', rarity: 'common', kind: 'frames' },
  { id: 'numerals-gothic', name: 'Gothic Numerals', rarity: 'common', kind: 'numerals' },
  { id: 'stamp-laurel', name: 'Laurel Stamp', rarity: 'common', kind: 'stamps' },
  { id: 'stamp-crown', name: 'Crown Stamp', rarity: 'rare', kind: 'stamps' },
  { id: 'frame-bone', name: 'Bone-inlay Frame', rarity: 'rare', kind: 'frames' },
  { id: 'banner-rubric', name: 'Rubric Banner', rarity: 'rare', kind: 'banners' },
  { id: 'board-plague-linen', name: 'Plague Linen Board', rarity: 'rare', kind: 'boards' },
  { id: 'wax-ash', name: 'Ash Wax', rarity: 'rare', kind: 'seals' },
  { id: 'board-cathedral', name: 'Cathedral Rubric Board', rarity: 'fabled', kind: 'boards' },
  { id: 'frame-lacquer', name: 'Black-lacquer Frame', rarity: 'fabled', kind: 'frames' },
  { id: 'banner-ninth', name: 'The Ninth Banner', rarity: 'fabled', kind: 'banners' },
] as const;

export default function ReliquaryScreen() {
  const ui = useUi();
  const save = useSave((s) => s.save);
  const [frame, setFrame] = useState(0);
  const [item, setItem] = useState<(typeof DROP_TABLE)[number] | null>(null);
  const [duplicate, setDuplicate] = useState(false);

  useEffect(() => {
    const iv = setInterval(() => setFrame((f) => Math.min(7, f + 1)), 500);
    synth.reliquary();
    const finish = setTimeout(() => {
      const owned = useSave.getState().save?.cosmetics.owned ?? [];
      const roll = Math.random();
      const pool = DROP_TABLE.filter((d) => d.rarity === (roll < 0.6 ? 'common' : roll < 0.9 ? 'rare' : 'fabled'));
      const it = pool[Math.floor(Math.random() * pool.length)];
      setItem(it);
      setDuplicate(owned.includes(it.id));
      if (duplicateGranted(it, owned)) {
        useSave.getState().update((s) => ({ ...s, economy: { ...s.economy, ink: s.economy.ink + 40 } }));
        recordInk({ duelId: `reliquary-${it.id}-${Date.now().toString(36)}`, mode: 'reliquary', delta: 40 });
      } else {
        useSave.getState().update((s) => ({
          ...s,
          economy: { ...s.economy, reliquaryProgress: 0 },
          cosmetics: { ...s.cosmetics, owned: [...s.cosmetics.owned, it.id] },
        }));
      }
    }, 4000);
    return () => { clearInterval(iv); clearTimeout(finish); };
  }, []);

  if (!save) return null;
  const rarityBorder = item?.rarity === 'fabled' ? 'var(--gilt)' : item?.rarity === 'rare' ? 'var(--brass)' : 'var(--parchment-dim)';

  return (
    <main style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', background: 'var(--ink-black)', padding: 20 }}>
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', marginBottom: 14 }}>{i18n.reliquary.title}</h1>
        {!item ? (
          <>
            <img
              src={`/assets/reliquary/chest-${frame === 0 ? 'closed' : frame === 7 ? 'open' : `opening-${frame}`}.svg`}
              alt="" width={180} height={180} className="ink-settle"
            />
            <p style={{ color: 'var(--fg-dim)', fontStyle: 'italic', marginTop: 10 }}>{i18n.reliquary.ritual}</p>
          </>
        ) : (
          <>
            <div className="page-turn" style={{ border: `2.5px solid ${rarityBorder}`, borderRadius: 4, padding: 18, background: 'var(--charcoal)', maxWidth: 300, margin: '0 auto' }}>
              <p style={{ letterSpacing: '0.2em', fontSize: 'var(--fs-xs)', color: 'var(--fg-dim)' }}>{item.rarity.toUpperCase()}</p>
              <img src={`/assets/${item.kind === 'seals' ? 'seals' : item.kind === 'stamps' ? 'seals/stamps' : item.kind === 'frames' ? 'ui' : item.kind === 'banners' ? 'ui' : 'textures'}/${item.id}.svg`} alt={item.name} width={120} height={120}
                style={{ margin: '10px auto', display: 'block', border: '1px solid var(--line-strong)' }} />
              <h2 style={{ fontFamily: 'var(--font-display)' }}>{item.name}</h2>
              {duplicate && <p style={{ color: 'var(--brass)', fontStyle: 'italic' }}>{i18n.reliquary.duplicate} +40 {i18n.common.ink}</p>}
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 16 }}>
              <button className="btn btn-primary" onClick={() => ui.go('antechamber')}>{i18n.common.continue}</button>
            </div>
            <p style={{ marginTop: 16, color: 'var(--fg-dim)', fontSize: 'var(--fs-xs)', maxWidth: 320 }}>
              <b>{i18n.reliquary.rates}:</b> {i18n.reliquary.ratesBody}
            </p>
          </>
        )}
      </div>
    </main>
  );
}

function duplicateGranted(item: { id: string }, owned: string[]): boolean {
  return owned.includes(item.id);
}
