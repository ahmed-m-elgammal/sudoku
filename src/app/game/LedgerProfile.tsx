// LedgerProfile — S17: name edit, rank emblem, Standing graph, win rate by Order, Marginalia
// (24 achievements), last 20 duels with Shade tag, Recovery Code, export/import (spec §7, §17).
'use client';
import { useEffect, useState } from 'react';
import { useUi } from '@/state/ui';
import { useSave } from '@/state/save';
import { loadIdentity, saveIdentity, generateRecoveryCode, hashRecoveryCode, validateRecoveryCode } from '@/state/identity';
import { rankOfStanding } from './rank';
import i18n from '@/i18n/en.json';
import Ribbon from './Ribbon';
import { synth } from '@/audio/synth';
import { net } from '@/net/client';

export default function LedgerProfile() {
  const ui = useUi();
  const save = useSave((s) => s.save);
  const [name, setName] = useState('');
  const [code, setCode] = useState<string | null>(null);
  const [importText, setImportText] = useState('');
  const [serverInk, setServerInk] = useState<number | null>(null);
  if (!save) return null;
  const rank = rankOfStanding(save.standing);
  const hist = save.stats.standingHistory.slice(-20);
  const spark = hist.map((v, i) => `${(i / Math.max(1, hist.length - 1)) * 280},${70 - Math.min(70, ((v - 800) / 1200) * 70)}`).join(' ');
  const achievements = Object.entries(i18n.achievements) as Array<[string, { title: string; desc: string }]>;

  useEffect(() => { setName(save.name); }, [save.name]);

  // T13 — the server-known Ink balance: a quiet auth on mount, shown for auditability
  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const id = await loadIdentity();
        const res = await net.auth({ id: id.id, secret: id.secret, name: id.name });
        if (live && res && res.ok && typeof res.ink === 'number' && Number.isFinite(res.ink)) setServerInk(res.ink);
      } catch { /* offline: the line simply stays hidden */ }
    })();
    return () => { live = false; };
  }, []);

  return (
    <main className="hub" style={{ minHeight: '100dvh', paddingBottom: 'calc(var(--ribbon-h) + var(--safe-bottom))' }}>
      <header style={{ padding: 'calc(var(--safe-top) + 14px) 16px 6px' }}>
        <h1>{i18n.ledger.title}</h1>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <input
            value={name} onChange={(e) => setName(e.target.value)}
            aria-label={i18n.ledger.nameEdit}
            maxLength={24}
            style={{ flex: 1, background: 'var(--charcoal)', border: '1px solid var(--line-strong)', color: 'var(--fg)', padding: '8px 10px', fontFamily: 'var(--font-body)' }}
          />
          <button
            className="btn"
            onClick={async () => {
              synth.uiTap();
              useSave.getState().update((s) => ({ ...s, name }));
              const id = await loadIdentity();
              id.name = name;
              await saveIdentity(id);
              void net.auth({ id: id.id, secret: id.secret, name });
            }}
          >
            {i18n.ledger.rename}
          </button>
        </div>
        <p style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, color: 'var(--fg-dim)' }}>
          <img src={`/assets/ranks/rank-${rank.id}.svg`} alt="" width={28} height={28} />
          {rank.label}{rank.division ? ` · ${rank.division}` : ''} · {i18n.ledger.standing} {save.standing}
        </p>
        {serverInk !== null && (
          <p style={{ marginTop: 4, fontSize: 'var(--fs-sm)', color: 'var(--fg-dim)' }}>
            {i18n.ledger.serverInk} <span className="digits">{serverInk}</span> ink
          </p>
        )}
      </header>

      <section className="panel" style={{ margin: '8px 16px', padding: 12 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-md)' }}>{i18n.ledger.standingGraph}</h2>
        <svg width="100%" height="76" style={{ marginTop: 6 }}>
          <polyline fill="none" stroke="var(--brass)" strokeWidth="1.5" points={spark} />
        </svg>
        <dl style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginTop: 8, textAlign: 'center', fontSize: 'var(--fs-sm)' }}>
          <div><dt>{i18n.ledger.duels}</dt><dd className="digits">{save.stats.duels}</dd></div>
          <div><dt>{i18n.ledger.wins}</dt><dd className="digits">{save.stats.wins}</dd></div>
          <div><dt>{i18n.ledger.losses}</dt><dd className="digits">{save.stats.losses}</dd></div>
          <div><dt>{i18n.ledger.streak}</dt><dd className="digits">{save.stats.longestStreak}</dd></div>
        </dl>
      </section>

      <section className="panel" style={{ margin: '10px 16px', padding: 12 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-md)' }}>{i18n.ledger.winRate}</h2>
        <ul style={{ listStyle: 'none', marginTop: 6, fontSize: 'var(--fs-sm)' }}>
          {['scholar', 'executioner', 'apothecary', 'warden'].map((o) => {
            const rec = save.stats.byOrder[o] ?? { w: 0, l: 0 };
            const total = rec.w + rec.l;
            const pct = total ? Math.round((rec.w / total) * 100) : 0;
            return (
              <li key={o} style={{ display: 'grid', gridTemplateColumns: '90px 1fr 40px', alignItems: 'center', gap: 8, padding: '3px 0' }}>
                <span style={{ textTransform: 'capitalize' }}>{o}</span>
                <div style={{ height: 6, background: 'var(--charcoal-2)' }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: 'var(--brass)' }} />
                </div>
                <span className="digits" style={{ textAlign: 'right' }}>{pct}%</span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="panel" style={{ margin: '10px 16px', padding: 12 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-md)' }}>{i18n.ledger.achievements}</h2>
        <ul style={{ listStyle: 'none', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
          {achievements.map(([id, a]) => {
            const got = !!save.achievements[id];
            return (
              <li key={id} style={{ display: 'flex', gap: 8, alignItems: 'center', opacity: got ? 1 : 0.45 }}>
                <img src={`/assets/achievements/achievement-${id}.svg`} alt="" width={30} height={30} />
                <div>
                  <b style={{ fontSize: 'var(--fs-sm)' }}>{a.title}</b>
                  <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--fg-dim)' }}>{a.desc}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="panel" style={{ margin: '10px 16px', padding: 12 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-md)' }}>{i18n.ledger.recent}</h2>
        <ul style={{ listStyle: 'none', marginTop: 6, fontSize: 'var(--fs-sm)' }}>
          {save.stats.recent.slice(0, 20).map((d, i) => (
            <li key={i} style={{ display: 'flex', gap: 8, padding: '4px 0', borderBottom: '1px solid var(--line)' }}>
              <b style={{ color: d.result === 'w' ? 'var(--brass)' : d.result === 'l' ? 'var(--oxblood)' : 'var(--fg-dim)', width: 16 }}>
                {d.result.toUpperCase()}
              </b>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>vs {d.foe}</span>
              <small style={{ color: d.shade ? 'var(--ash)' : 'var(--fg-dim)' }}>{d.shade ? i18n.ledger.shadeTag : i18n.ledger.humanTag}</small>
            </li>
          ))}
          {save.stats.recent.length === 0 && <li style={{ color: 'var(--fg-dim)', fontStyle: 'italic' }}>{i18n.common.empty}</li>}
        </ul>
      </section>

      <section className="panel" style={{ margin: '10px 16px', padding: 12 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-md)' }}>{i18n.ledger.recovery}</h2>
        <p style={{ color: 'var(--fg-dim)', fontSize: 'var(--fs-sm)', margin: '6px 0' }}>{i18n.ledger.recoveryBody}</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            className="btn"
            onClick={async () => {
              const c = generateRecoveryCode();
              setCode(c);
              const hash = await hashRecoveryCode(c);
              useSave.getState().update((s) => ({ ...s }));
              const id = await loadIdentity();
              id.recoveryHash = hash;
              await saveIdentity(id);
              void net.auth({ id: id.id, secret: id.secret, name: save.name, recoveryHash: hash });
            }}
          >
            {i18n.ledger.recoveryShow}
          </button>
          {code && (
            <>
              <code className="digits" style={{ alignSelf: 'center', color: 'var(--brass)', wordBreak: 'break-all' }}>{code}</code>
              <button className="btn btn-ghost" onClick={() => navigator.clipboard?.writeText(code)}>{i18n.ledger.recoveryCopy}</button>
            </>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
          <button
            className="btn btn-ghost"
            onClick={() => {
              const blob = new Blob([JSON.stringify(useSave.getState().save, null, 2)], { type: 'application/json' });
              const a = document.createElement('a');
              a.href = URL.createObjectURL(blob);
              a.download = 'assize-save.json';
              a.click();
            }}
          >
            {i18n.ledger.export}
          </button>
          <input
            aria-label={i18n.ledger.import}
            type="file" accept="application/json"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              try {
                const parsed = JSON.parse(await f.text());
                if (parsed && parsed.v === 2) {
                  useSave.getState().update(() => parsed);
                  synth.reliquary();
                } else synth.error();
              } catch { synth.error(); }
            }}
          />
          <input
            aria-label="Recovery code"
            placeholder={i18n.ledger.recovery}
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            style={{ background: 'var(--charcoal)', border: '1px solid var(--line-strong)', color: 'var(--fg)', padding: '6px 8px' }}
          />
          <button
            className="btn btn-ghost"
            onClick={async () => {
              if (!validateRecoveryCode(importText)) { synth.error(); return; }
              const id = await loadIdentity();
              const res = await net.recovery({ code: importText, id: id.id, secret: id.secret });
              // T13 — the response now carries the server-known Ink: apply it (max — the
              // client may hold un-synced local ink the server never heard about).
              if (res && res.ok && typeof res.ink === 'number') {
                useSave.getState().update((cur) => ({
                  ...cur,
                  economy: { ...cur.economy, ink: Math.max(cur.economy.ink, res.ink ?? 0) },
                }));
                synth.reliquary();
              } else synth.error();
            }}
          >
            {i18n.ledger.import}
          </button>
        </div>
      </section>
      <Ribbon />
    </main>
  );
}
