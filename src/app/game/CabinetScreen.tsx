// CabinetScreen — S15: tabs (Board Themes, Seal Waxes, Frames, Numerals, Stamps, Banners),
// shop with Ink/Sigil pricing, preview, equip; Patron's Pouch (payments stubbed, spec §11).
'use client';
import { useState } from 'react';
import { useUi } from '@/state/ui';
import { useSave } from '@/state/save';
import i18n from '@/i18n/en.json';
import Ribbon from './Ribbon';
import { synth } from '@/audio/synth';

type Tab = 'boards' | 'seals' | 'frames' | 'numerals' | 'stamps' | 'banners';
interface CosmeticItem {
  id: string; name: string; desc: string;
  currency: 'ink' | 'sigil' | 'owned';
  price: number;
  tab: Tab;
  preview: string;
}

const ITEMS: CosmeticItem[] = [
  { id: 'board-aged-vellum', name: 'Aged Vellum', desc: 'The standard sheet of the Assize.', currency: 'owned', price: 0, tab: 'boards', preview: '/assets/textures/parchment-aged-vellum.svg' },
  { id: 'board-bone', name: 'Bone', desc: 'Scraped white, cold to the touch.', currency: 'ink', price: 400, tab: 'boards', preview: '/assets/textures/parchment-bone.svg' },
  { id: 'board-slate', name: 'Slate', desc: 'For the pragmatic clerk.', currency: 'ink', price: 400, tab: 'boards', preview: '/assets/textures/parchment-slate.svg' },
  { id: 'board-plague-linen', name: 'Plague Linen', desc: 'Stripped from a sealed house.', currency: 'ink', price: 700, tab: 'boards', preview: '/assets/textures/parchment-plague-linen.svg' },
  { id: 'board-tallow', name: 'Tallow', desc: 'Candle-fat and patience.', currency: 'ink', price: 700, tab: 'boards', preview: '/assets/textures/parchment-tallow.svg' },
  { id: 'board-cathedral', name: 'Cathedral Rubric', desc: 'Illuminated margins. Rare.', currency: 'sigil', price: 40, tab: 'boards', preview: '/assets/textures/parchment-cathedral-rubric.svg' },
  { id: 'wax-oxblood', name: 'Oxblood', desc: 'Your mark, by right.', currency: 'owned', price: 0, tab: 'seals', preview: '/assets/seals/stamps/stamp-fleur.svg' },
  { id: 'wax-black', name: 'Black', desc: 'The court’s own wax.', currency: 'ink', price: 300, tab: 'seals', preview: '/assets/seals/stamps/stamp-tau.svg' },
  { id: 'wax-verdigris', name: 'Verdigris', desc: 'Bronze gone green in the rain.', currency: 'ink', price: 300, tab: 'seals', preview: '/assets/seals/seal-verdigris-intact.svg' },
  { id: 'wax-gilt', name: 'Gilt', desc: 'Moneylender’s choice.', currency: 'ink', price: 600, tab: 'seals', preview: '/assets/seals/seal-gilt-intact.svg' },
  { id: 'wax-ash', name: 'Ash', desc: 'What the Ledger leaves.', currency: 'ink', price: 300, tab: 'seals', preview: '/assets/seals/seal-ash-intact.svg' },
  { id: 'frame-bronze', name: 'Bronze Frame', desc: 'Honest metal.', currency: 'owned', price: 0, tab: 'frames', preview: '/assets/ui/frame-brass.svg' },
  { id: 'frame-iron', name: 'Iron Frame', desc: 'Warden-forged.', currency: 'ink', price: 350, tab: 'frames', preview: '/assets/ui/frame-brass.svg' },
  { id: 'frame-bone', name: 'Bone-inlay Frame', desc: 'Inlaid with something older.', currency: 'ink', price: 500, tab: 'frames', preview: '/assets/ui/frame-brass.svg' },
  { id: 'frame-lacquer', name: 'Black-lacquer Frame', desc: 'Nine coats. Fabled.', currency: 'sigil', price: 25, tab: 'frames', preview: '/assets/ui/frame-brass.svg' },
  { id: 'numerals-linocut', name: 'Linocut Numerals', desc: 'Cut by hand, inked by hand.', currency: 'owned', price: 0, tab: 'numerals', preview: '/assets/ui/num-tile-normal.svg' },
  { id: 'numerals-caslon', name: 'Court Caslon', desc: 'The Registrar’s face.', currency: 'ink', price: 400, tab: 'numerals', preview: '/assets/ui/num-tile-normal.svg' },
  { id: 'numerals-gothic', name: 'Gothic Numerals', desc: 'Older than the walls.', currency: 'ink', price: 450, tab: 'numerals', preview: '/assets/ui/num-tile-normal.svg' },
  { id: 'stamp-fleur', name: 'Fleur-de-lis', desc: 'Your claim, unmistakable.', currency: 'owned', price: 0, tab: 'stamps', preview: '/assets/seals/stamps/stamp-fleur.svg' },
  { id: 'stamp-laurel', name: 'Laurel', desc: 'For clean hands.', currency: 'ink', price: 350, tab: 'stamps', preview: '/assets/seals/stamps/stamp-laurel.svg' },
  { id: 'stamp-crown', name: 'Crown', desc: 'Rule asserted.', currency: 'ink', price: 500, tab: 'stamps', preview: '/assets/seals/stamps/stamp-crown.svg' },
  { id: 'stamp-tower', name: 'Tower', desc: 'Novem holds.', currency: 'ink', price: 350, tab: 'stamps', preview: '/assets/seals/stamps/stamp-tower.svg' },
  { id: 'stamp-scale', name: 'Scales', desc: 'Everything weighed.', currency: 'sigil', price: 15, tab: 'stamps', preview: '/assets/seals/stamps/stamp-scale.svg' },
  { id: 'banner-standard', name: 'Plain Verdict', desc: 'True, and unadorned.', currency: 'owned', price: 0, tab: 'banners', preview: '/assets/ui/divider-1.svg' },
  { id: 'banner-rubric', name: 'Rubric Verdict', desc: 'Red-letter victory.', currency: 'ink', price: 500, tab: 'banners', preview: '/assets/ui/divider-2.svg' },
  { id: 'banner-ninth', name: 'The Ninth Banner', desc: 'For folios settled.', currency: 'sigil', price: 30, tab: 'banners', preview: '/assets/ui/divider-3.svg' },
];

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'boards', label: i18n.cabinet.tabs.boards },
  { id: 'seals', label: i18n.cabinet.tabs.seals },
  { id: 'frames', label: i18n.cabinet.tabs.frames },
  { id: 'numerals', label: i18n.cabinet.tabs.numerals },
  { id: 'stamps', label: i18n.cabinet.tabs.stamps },
  { id: 'banners', label: i18n.cabinet.tabs.banners },
];

export default function CabinetScreen() {
  const ui = useUi();
  const save = useSave((s) => s.save);
  const [tab, setTab] = useState<Tab>('boards');
  const [preview, setPreview] = useState<CosmeticItem | null>(null);
  if (!save) return null;

  const items = ITEMS.filter((i) => i.tab === tab);
  const equipKey = tab === 'boards' ? 'board' : tab === 'seals' ? 'wax' : tab === 'frames' ? 'frame' : tab === 'numerals' ? 'numerals' : tab === 'stamps' ? 'stamps' : 'banner';
  const equippedId = save.cosmetics.equipped[equipKey as keyof typeof save.cosmetics.equipped];

  const buy = (item: CosmeticItem) => {
    if (save.cosmetics.owned.includes(item.id)) return;
    if (item.currency === 'ink' && save.economy.ink >= item.price) {
      useSave.getState().update((s) => ({
        ...s,
        economy: { ...s.economy, ink: s.economy.ink - item.price },
        cosmetics: { ...s.cosmetics, owned: [...s.cosmetics.owned, item.id] },
      }));
      synth.reliquary();
    } else if (item.currency === 'sigil' && save.economy.sigils >= item.price) {
      useSave.getState().update((s) => ({
        ...s,
        economy: { ...s.economy, sigils: s.economy.sigils - item.price },
        cosmetics: { ...s.cosmetics, owned: [...s.cosmetics.owned, item.id] },
      }));
      synth.reliquary();
    } else {
      synth.error();
    }
    setPreview(null);
  };

  return (
    <main className="hub" style={{ minHeight: '100dvh', paddingBottom: 'calc(var(--ribbon-h) + var(--safe-bottom))' }}>
      <header style={{ padding: 'calc(var(--safe-top) + 14px) 16px 6px', textAlign: 'center' }}>
        <h1>{i18n.cabinet.title}</h1>
        <p style={{ color: 'var(--fg-dim)' }}>
          <img src="/assets/icons/ink-drop.svg" alt="" width={13} height={13} /> {save.economy.ink} ·
          <img src="/assets/icons/sigil-coin.svg" alt="" width={13} height={13} style={{ marginLeft: 8 }} /> {save.economy.sigils}
        </p>
      </header>

      <div role="tablist" style={{ display: 'flex', overflowX: 'auto', gap: 6, padding: '4px 16px' }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => { synth.uiTap(); setTab(t.id); setPreview(null); }}
            style={{
              border: `1px solid ${tab === t.id ? 'var(--brass)' : 'var(--line-strong)'}`,
              color: tab === t.id ? 'var(--brass)' : 'var(--fg-dim)',
              padding: '6px 10px', minHeight: 40, whiteSpace: 'nowrap', borderRadius: 3,
              fontFamily: 'var(--font-display)', fontSize: 'var(--fs-sm)',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <ul style={{ listStyle: 'none', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, padding: '10px 16px' }}>
        {items.map((it) => {
          const owned = save.cosmetics.owned.includes(it.id) || it.currency === 'owned';
          const equipped = equippedId === it.id;
          return (
            <li key={it.id} className="panel" style={{ padding: 10, textAlign: 'center' }}>
              <img src={it.preview} alt="" width={64} height={64} style={{ margin: '0 auto 6px', display: 'block', border: '1px solid var(--line)' }} />
              <b style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-sm)' }}>{it.name}</b>
              <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--fg-dim)', minHeight: 26 }}>{it.desc}</p>
              {owned ? (
                <button
                  className="btn"
                  style={{ width: '100%', minHeight: 36, fontSize: 'var(--fs-xs)' }}
                  disabled={equipped}
                  onClick={() => {
                    synth.uiTap();
                    useSave.getState().update((s) => ({ ...s, cosmetics: { ...s.cosmetics, equipped: { ...s.cosmetics.equipped, [equipKey]: it.id } } }));
                  }}
                >
                  {equipped ? i18n.common.equipped : i18n.common.equip}
                </button>
              ) : (
                <button className="btn btn-ghost" style={{ width: '100%', minHeight: 36, fontSize: 'var(--fs-xs)' }} onClick={() => setPreview(it)}>
                  {it.currency === 'sigil' ? `${it.price} ${i18n.common.sigils}` : `${it.price} ${i18n.common.ink}`}
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {preview && (
        <div role="dialog" aria-modal="true" className="panel" style={{ position: 'fixed', inset: 'auto 16px calc(var(--safe-bottom) + 70px)', zIndex: 50, padding: 16 }}>
          <h2 style={{ fontFamily: 'var(--font-display)' }}>{preview.name}</h2>
          <p style={{ color: 'var(--fg-dim)' }}>{preview.desc}</p>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button className="btn btn-primary" onClick={() => buy(preview)}>
              {i18n.common.buy} — {preview.currency === 'sigil' ? `${preview.price} ${i18n.common.sigils}` : `${preview.price} ${i18n.common.ink}`}
            </button>
            <button className="btn" onClick={() => setPreview(null)}>{i18n.common.close}</button>
          </div>
        </div>
      )}

      <section className="panel" style={{ margin: '10px 16px', padding: 14 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-md)' }}>{i18n.cabinet.patron}</h2>
        <p style={{ color: 'var(--fg-dim)', fontSize: 'var(--fs-sm)' }}>{i18n.cabinet.patronNote}</p>
        <button className="btn btn-ghost" style={{ marginTop: 8 }} onClick={() => alert('TODO(T5): payments are stubbed in this build. See /TODO.md.')}>
          Patron’s Pouch — 80 / 300 / 1000 Sigils
        </button>
      </section>
      <Ribbon />
    </main>
  );
}
