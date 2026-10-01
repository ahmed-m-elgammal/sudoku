// BootScreen — S01: black, one engraved line, wordmark, auto-advances within 2s (R1). Not a menu.
'use client';
import { useEffect } from 'react';
import { useUi } from '@/state/ui';
import { useSave } from '@/state/save';
import i18n from '@/i18n/en.json';

export default function BootScreen() {
  const go = useUi((s) => s.go);
  const save = useSave((s) => s.save);

  useEffect(() => {
    const t = setTimeout(() => {
      if (save?.tutorialDone) go('antechamber');
      else go('tutorial', { duelMode: 'tutorial' });
    }, 1200);
    return () => clearTimeout(t);
  }, [go, save]);

  return (
    <main
      className="boot-screen"
      onClick={() => (save?.tutorialDone ? go('antechamber') : go('tutorial', { duelMode: 'tutorial' }))}
      style={{
        height: '100dvh', display: 'grid', placeItems: 'center', background: '#0e0e0f',
        color: '#cdb992', textAlign: 'center', cursor: 'pointer', padding: 24,
      }}
    >
      <div>
        <p style={{ fontFamily: 'var(--font-body)', fontStyle: 'italic', fontSize: 'var(--fs-md)', opacity: 0.85, marginBottom: 24 }}>
          {i18n.boot.line}
        </p>
        <h1 className="wordmark" aria-label="ASSIZE" style={{ fontSize: 'clamp(44px, 13vw, 64px)', letterSpacing: '0.14em', color: 'var(--parchment-light)', fontWeight: 400 }}>ASSIZE</h1>
        <p style={{ marginTop: 18, letterSpacing: '0.35em', fontSize: 'var(--fs-xs)', color: '#6f5b31' }}>
          {i18n.boot.sub}
        </p>
      </div>
    </main>
  );
}
