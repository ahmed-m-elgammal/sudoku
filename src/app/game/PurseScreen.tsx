// PurseScreen — S20 "The Clerk's Purse": explains Ink, Sigils and Reliquaries in 3 lines.
'use client';
import { useUi } from '@/state/ui';
import i18n from '@/i18n/en.json';
import { synth } from '@/audio/synth';

export default function PurseScreen() {
  const ui = useUi();
  return (
    <main
      className="page-turn"
      onClick={() => { synth.uiTap(); ui.go('antechamber'); }}
      style={{
        minHeight: '100dvh', display: 'grid', placeItems: 'center',
        background: 'var(--ink-black)', cursor: 'pointer', padding: 24,
      }}
    >
      <div className="panel" style={{ maxWidth: 360, padding: 24, textAlign: 'center' }}>
        <h1 style={{ fontFamily: 'var(--font-display)' }}>{i18n.purse.title}</h1>
        <div style={{ display: 'grid', gap: 14, margin: '18px 0', textAlign: 'left' }}>
          <p style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <img src="/assets/icons/ink-drop.svg" alt="" width={26} height={26} />
            {i18n.purse.ink}
          </p>
          <p style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <img src="/assets/icons/sigil-coin.svg" alt="" width={26} height={26} />
            {i18n.purse.sigils}
          </p>
          <p style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <img src="/assets/reliquary/chest-closed.svg" alt="" width={26} height={26} />
            {i18n.purse.reliquary}
          </p>
        </div>
        <p style={{ color: 'var(--line-strong)', fontSize: 'var(--fs-xs)' }}>{i18n.common.tapToContinue}</p>
      </div>
    </main>
  );
}
