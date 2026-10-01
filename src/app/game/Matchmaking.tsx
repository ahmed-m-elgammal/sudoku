// Matchmaking — S06 "Summoning": engraved hourglass, rotating flavour lines, Cancel.
// Socket join_queue with the guest identity; Shade fallback at 4s (spec §7). Shade fallback fires
// only when no human is found — honest labeling per R7.
'use client';
import { useEffect, useRef, useState } from 'react';
import { useUi } from '@/state/ui';
import { useSave } from '@/state/save';
import { loadIdentity } from '@/state/identity';
import { net } from '@/net/client';
import i18n from '@/i18n/en.json';
import { CONFIG } from '@shared/config';
import { synth } from '@/audio/synth';

export default function Matchmaking() {
  const ui = useUi();
  const save = useSave((s) => s.save);
  const [line, setLine] = useState(0);
  const cancelRef = useRef(false);
  const settledRef = useRef(false);

  useEffect(() => {
    const t = setInterval(() => setLine((l) => (l + 1) % i18n.matchmaking.lines.length), 1400);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!save) return;
    let timer: ReturnType<typeof setTimeout>;
    const joined = settledRef;

    (async () => {
      const id = await loadIdentity();
      const ok = await net.connect();
      if (ok && !joined.current) {
        // listen for a server match (human or Shade from the authoritative queue)
        const off = net.on('matched', (p) => {
          if (joined.current) return;
          joined.current = true;
          const m = p as { duelId: string; seat: 0 | 1; givens: number[]; foe: { name: string; order: 'scholar'; shade: boolean; standing: number }; stakes?: { tier?: string; range?: [number, number] } };
          localStorage.setItem('assize-secret', id.secret);
          ui.go('versus', {
            duelMode: m.foe.shade ? 'shade' : 'ranked',
            pendingFoe: { name: m.foe.name, order: m.foe.order, shade: m.foe.shade, standing: m.foe.standing, tier: m.stakes?.tier ?? 'Ranked', range: m.stakes?.range ?? [0, 0] },
            serverDuel: {
              duelId: m.duelId, seat: m.seat, givens: m.givens,
              foeName: m.foe.name, myName: save.name, myOrder: save.order, foeOrder: m.foe.order,
            },
          });
        });
        // register/sync the guest identity with the court first — join_queue
        // authenticates against the server account, so an unregistered guest
        // would be silently dropped from the queue (found via T2 e2e testing).
        try {
          const res = await net.auth({ id: id.id, secret: id.secret, name: save.name, recoveryHash: id.recoveryHash });
          const s = useSave.getState();
          if (res?.ok && typeof res.standing === 'number' && s.save && s.save.stats.duels === 0 && s.save.standing !== res.standing) {
            s.update((cur) => ({ ...cur, standing: res.standing }));
          }
        } catch { /* offline: the Shade fallback still fires */ }
        net.send('join_queue', { accountId: id.id, secret: id.secret, name: save.name, order: save.order });
        (net as unknown as { _offMatched?: () => void })._offMatched = off;
      }
    })();

    const tickWait = (elapsed: number) => {
      if (cancelRef.current || joined.current) return;
      // the server runs its own Shade fallback at 4s; wait just past it so the
      // authoritative 'matched' (human or Shade) wins the race against ours.
      if (elapsed >= CONFIG.matchmaking.shadeFallbackMs + 500) {
        if (joined.current) return;
        joined.current = true;
        // no human answered: local Shade duel, honestly labelled (R7)
        const foeName = `Shade of ${['Gaunt Notary', 'Ashen Clerk', 'Quiet Advocate', 'Hollow Scrivener'][Math.floor(Math.random() * 4)]}`;
        ui.go('versus', {
          duelMode: 'shade',
          pendingFoe: { name: foeName, order: 'executioner', shade: true, standing: save.standing, tier: 'Practice ladder', range: [0, 0] },
          serverDuel: null,
        });
        return;
      }
      timer = setTimeout(() => tickWait(elapsed + 250), 250);
    };
    timer = setTimeout(() => tickWait(250), 250);

    return () => {
      cancelRef.current = true;
      clearTimeout(timer);
      const off = (net as unknown as { _offMatched?: () => void })._offMatched;
      off?.();
      // never leave a ghost behind in the authoritative queue
      net.send('leave_queue', {});
    };
  }, [ui, save]);

  return (
    <main style={{ height: '100dvh', display: 'grid', placeItems: 'center', background: 'var(--ink-black)' }}>
      <div style={{ textAlign: 'center', padding: 24 }}>
        <img src="/assets/sigils/sigil-hourglass.svg" alt="" width={72} height={72} className="ink-settle" />
        <h1 style={{ margin: '14px 0 6px', fontFamily: 'var(--font-display)' }}>{i18n.matchmaking.title}</h1>
        <p style={{ color: 'var(--fg-dim)', fontStyle: 'italic', minHeight: 24 }}>{i18n.matchmaking.lines[line]}</p>
        <button className="btn" style={{ marginTop: 22 }} onClick={() => { synth.uiTap(); ui.go('antechamber'); }}>
          {i18n.matchmaking.cancel}
        </button>
      </div>
    </main>
  );
}
