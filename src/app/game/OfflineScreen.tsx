// OfflineScreen — S19: engraved error plate with human copy. Offline still allows M0/M1/M5/Shade.
'use client';
import { useEffect, useState } from 'react';
import { useUi } from '@/state/ui';
import i18n from '@/i18n/en.json';
import { net } from '@/net/client';

export default function OfflineScreen() {
  const ui = useUi();
  const [online, setOnline] = useState(false);

  useEffect(() => {
    (async () => {
      const ok = await net.connect();
      setOnline(ok);
      if (ok) ui.go('antechamber');
    })();
    const iv = setInterval(async () => {
      const ok = await net.connect();
      setOnline(ok);
      if (ok) ui.go('antechamber');
    }, 8000);
    return () => clearInterval(iv);
  }, [ui]);

  return (
    <main style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', background: 'var(--ink-black)', padding: 24 }}>
      <div className="plate page-turn" style={{ maxWidth: 380 }}>
        <p className="wordmark" style={{ fontSize: 34, letterSpacing: '0.14em', color: 'var(--parchment-dim)', textAlign: 'center', marginBottom: 14 }}>ASSIZE</p>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-lg)', color: 'var(--oxblood)' }}>{i18n.offline.title}</h1>
        <p style={{ color: 'var(--fg-dim)', fontStyle: 'italic', margin: '10px 0 16px' }}>{i18n.offline.body}</p>
        <div style={{ display: 'grid', gap: 8 }}>
          <button className="btn btn-primary" onClick={() => ui.go('tutorial', { duelMode: 'tutorial' })}>Tutorial</button>
          <button className="btn" onClick={() => ui.go('folioMap')}>Folios</button>
          <button className="btn" onClick={() => ui.go('matchmaking', { duelMode: 'shade' })}>Shade duel</button>
        </div>
        <p style={{ marginTop: 14, fontSize: 'var(--fs-xs)', color: 'var(--line-strong)' }}>
          {online ? i18n.common.continue : i18n.offline.retry}…
        </p>
      </div>
    </main>
  );
}
