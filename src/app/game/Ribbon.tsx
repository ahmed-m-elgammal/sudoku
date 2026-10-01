// Ribbon.tsx — bottom tab ribbon for hub screens: Duel, Folios, Cabinet, Ledger (spec §4 NAV).
'use client';
import { useUi } from '@/state/ui';
import i18n from '@/i18n/en.json';
import { synth } from '@/audio/synth';

const TABS = [
  { id: 'antechamber', label: 'Duel', icon: '⚔' },
  { id: 'folioMap', label: 'Folios', icon: '❧' },
  { id: 'cabinet', label: 'Cabinet', icon: '❖' },
  { id: 'ledger', label: 'Ledger', icon: '≡' },
] as const;

export default function Ribbon() {
  const screen = useUi((s) => s.screen);
  const go = useUi((s) => s.go);
  return (
    <nav
      className="ribbon"
      aria-label="Hub navigation"
      style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 40,
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
        background: 'var(--charcoal) url(/assets/ui/tab-ribbon.svg)', backgroundSize: 'cover',
        borderTop: '1.5px solid var(--brass-dim)',
        paddingBottom: 'var(--safe-bottom)',
      }}
    >
      {TABS.map((t) => {
        const active = screen === t.id || (t.id === 'antechamber' && screen === 'duel');
        return (
          <button
            key={t.id}
            aria-current={active ? 'page' : undefined}
            onClick={() => { synth.uiTap(); go(t.id); }}
            style={{
              display: 'grid', placeItems: 'center', gap: 1, padding: '8px 0 10px',
              color: active ? 'var(--brass)' : 'var(--fg-dim)',
              fontFamily: 'var(--font-display)', fontSize: 'var(--fs-sm)', letterSpacing: '0.08em',
              borderBottom: active ? '2px solid var(--brass)' : '2px solid transparent',
              minHeight: 52,
            }}
          >
            <span aria-hidden style={{ fontSize: 16 }}>{t.icon}</span>
            {t.label}
          </button>
        );
      })}
    </nav>
  );
}
