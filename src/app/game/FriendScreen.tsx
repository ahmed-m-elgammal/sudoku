// FriendScreen — M4: create a duel link (?duel=CODE), share it; the guest plays immediately. Unrated.
'use client';
import { useState } from 'react';
import { useUi } from '@/state/ui';
import { net } from '@/net/client';
import i18n from '@/i18n/en.json';
import { synth } from '@/audio/synth';
import { loadIdentity } from '@/state/identity';
import { useSave } from '@/state/save';

export default function FriendScreen() {
  const ui = useUi();
  const [code, setCode] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState(false);

  const create = async () => {
    synth.uiTap();
    const id = await loadIdentity();
    const res = await net.createFriend({ id: id.id, secret: id.secret });
    if (res && 'code' in res) {
      setCode(res.code);
      // host also queues on the socket with the same code (guest pairs against it)
      const save = useSave.getState().save;
      const ok = await net.connect();
      if (ok && save) {
        localStorage.setItem('assize-secret', id.secret);
        net.on('matched', (p) => {
          const m = p as { duelId: string; seat: 0 | 1; givens: number[]; foe: { name: string; order: 'scholar'; shade: boolean; standing: number } };
          useUi.getState().go('versus', {
            duelMode: 'friend',
            pendingFoe: { name: m.foe.name, order: m.foe.order, shade: m.foe.shade, standing: m.foe.standing, tier: 'Friend duel', range: [0, 0] },
            serverDuel: { duelId: m.duelId, seat: m.seat, givens: m.givens, foeName: m.foe.name, myName: save.name, myOrder: save.order, foeOrder: m.foe.order },
          });
        });
        net.send('join_queue', { accountId: id.id, secret: id.secret, name: save.name, order: save.order, friendCode: res.code });
      }
    } else {
      // offline fallback: still produce a code — the host registers it when the server returns
      setError(true);
      setCode(`LOCAL-${Math.random().toString(36).slice(2, 8).toUpperCase()}`);
    }
  };

  return (
    <main className="hub" style={{ minHeight: '100dvh', padding: 'calc(var(--safe-top) + 16px) 16px 24px' }}>
      <header style={{ textAlign: 'center' }}>
        <h1>{i18n.friend.title}</h1>
        <p style={{ color: 'var(--fg-dim)', fontStyle: 'italic' }}>{i18n.friend.pickOrder}</p>
      </header>

      <section className="panel" style={{ margin: '12px 0', padding: 16, textAlign: 'center' }}>
        {!code ? (
          <button className="btn btn-primary" onClick={create}>{i18n.friend.create}</button>
        ) : (
          <>
            <p style={{ wordBreak: 'break-all', color: 'var(--brass)', fontFamily: 'var(--font-body)' }}>
              {i18n.friend.share.replace('{url}', `${location.origin}/?duel=${code}`)}
            </p>
            <button
              className="btn btn-ghost"
              onClick={() => { navigator.clipboard?.writeText(`${location.origin}/?duel=${code}`); synth.uiTap(); }}
            >
              {i18n.friend.copied}
            </button>
            {error && <p style={{ color: 'var(--fg-dim)', fontSize: 'var(--fs-xs)', marginTop: 8 }}>{i18n.offline.body}</p>}
            <p style={{ color: 'var(--fg-dim)', fontStyle: 'italic', marginTop: 8 }}>{i18n.friend.waiting}</p>
          </>
        )}
      </section>

      <section className="panel" style={{ padding: 16 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-md)' }}>Break a seal</h2>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <input
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            placeholder="CODE"
            aria-label="Duel code"
            style={{ flex: 1, background: 'var(--charcoal)', border: '1px solid var(--line-strong)', color: 'var(--fg)', padding: '8px 10px', fontFamily: 'var(--font-body)' }}
          />
          <button
            className="btn btn-primary"
            onClick={async () => {
              const id = await loadIdentity();
              const save = useSave.getState().save;
              const ok = await net.connect();
              if (!ok || !save) { synth.error(); setError(true); return; }
              localStorage.setItem('assize-secret', id.secret);
              const off = net.on('matched', (p) => {
                off();
                const m = p as { duelId: string; seat: 0 | 1; givens: number[]; foe: { name: string; order: 'scholar'; shade: boolean; standing: number } };
                useUi.getState().go('versus', {
                  duelMode: 'friend',
                  pendingFoe: { name: m.foe.name, order: m.foe.order, shade: m.foe.shade, standing: m.foe.standing, tier: 'Friend duel', range: [0, 0] },
                  serverDuel: { duelId: m.duelId, seat: m.seat, givens: m.givens, foeName: m.foe.name, myName: save.name, myOrder: save.order, foeOrder: m.foe.order },
                });
              });
              net.send('join_queue', { accountId: id.id, secret: id.secret, name: save.name, order: save.order, friendCode: joinCode });
            }}
          >
            {i18n.common.begin}
          </button>
        </div>
      </section>
    </main>
  );
}
