// EchoesScreen (T7) — the shelf of stored ink-echoes. Each entry is a validated
// replay of a real duel; tapping one sets the session and enters a replay duel
// where the foe replays that Clerk's recorded ink.
// T17 — "Your Shade": your newest echo mined into a personal profile, so your own
// ink rises against you on a fresh tablet (fail-closed: faint ink → visible note,
// the calibrated standing Shade answers instead).
// T19 — sealed chits: an echo can be passed to another Clerk as an ASSIZE1- code.
// The privacy pass is structural: export redacts both names, import force-redacts
// again, so no chit — forged or honest — ever puts a name on a shelf.
'use client';
import { useEffect, useMemo, useState } from 'react';
import { useUi } from '@/state/ui';
import { useSave } from '@/state/save';
import i18n from '@/i18n/en.json';
import { synth } from '@/audio/synth';
import { listEchoes, saveEcho, type EchoEntry } from '@/game/echoes';
import { describeEcho } from '@shared/replay';
import { encodeEchoCode, decodeEchoCode } from '@shared/echoShare';
import { minePersonalShade, type MinedShade } from '@shared/personalShade';
import { profileForStanding, clampProfile } from '@shared/shade';

const copyText = async (text: string): Promise<boolean> => {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* fall through to the legacy path */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
};

export default function EchoesScreen() {
  const ui = useUi();
  const save = useSave((s) => s.save);
  const [entries, setEntries] = useState<EchoEntry[] | null>(null); // null = loading
  const [chit, setChit] = useState<string | null>(null);            // sealed chit modal
  const [chitCopied, setChitCopied] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importNote, setImportNote] = useState<'ok' | 'bad' | null>(null);

  const refresh = () => { void listEchoes().then((e) => setEntries(e)); };
  useEffect(() => { refresh(); }, []);

  // your Shade lives in your newest ink — mined once per shelf render, purely
  const mined: MinedShade | null = useMemo(
    () => (entries && entries.length ? minePersonalShade(entries[0].replay) : null),
    [entries],
  );

  const duelYourShade = () => {
    synth.uiTap();
    const newest = entries?.[0];
    if (!newest) return;
    // fail-closed: a faint echo still duels — the calibrated Shade wears the name
    const profile = mined?.profile ?? clampProfile({
      ...profileForStanding(save?.standing ?? 1000),
      name: `Shade of ${newest.replay.names[0]}`,
      order: newest.replay.orders[0],
    });
    ui.go('duel', { duelMode: 'shade', pendingPersonalShade: { replay: newest.replay, profile }, campaignDuel: null });
  };

  const sealChit = async (e: EchoEntry) => {
    synth.uiTap();
    const code = encodeEchoCode(e.replay); // privacy pass: names never leave the device
    if (!code) return;
    setChit(code);
    setChitCopied(false);
    const ok = await copyText(code);
    if (ok) setChitCopied(true);
  };

  const importChit = async () => {
    const replay = decodeEchoCode(importText); // fail-closed; import re-redacts names
    if (!replay) { setImportNote('bad'); return; }
    const saved = await saveEcho(replay, { imported: true });
    setImportNote(saved ? 'ok' : 'bad');
    if (saved) {
      setImportText('');
      setImportOpen(false);
      refresh();
    }
  };

  const statsLine = (m: MinedShade): string =>
    i18n.echoes.yourShadeStats
      .replace('{pace}', (m.profile.placeCadenceMs! / 1000).toFixed(1))
      .replace('{err}', String(Math.round(m.telemetry.wrong / Math.max(1, m.telemetry.placements) * 100)))
      .replace('{rites}', String(m.telemetry.casts));

  return (
    <main className="page-turn" style={{ minHeight: '100dvh', padding: 'calc(var(--safe-top) + 18px) 16px calc(var(--safe-bottom) + 24px)' }}>
      <header style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 8 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-lg)' }}>{i18n.echoes.title}</h1>
        {entries && entries.length > 0 && (
          <span style={{ color: 'var(--fg-dim)', fontSize: 'var(--fs-xs)' }}>
            {i18n.echoes.count.replace('{n}', String(entries.length))}
          </span>
        )}
      </header>
      <p style={{ color: 'var(--fg-dim)', fontSize: 'var(--fs-sm)', maxWidth: 520, marginBottom: 14 }}>{i18n.echoes.sub}</p>

      {entries === null && (
        <p style={{ color: 'var(--fg-dim)', fontSize: 'var(--fs-sm)' }} aria-busy="true">…</p>
      )}

      {/* T17 — Your Shade, raised from the newest ink on the shelf */}
      {entries !== null && entries.length > 0 && (
        <div className="panel card" style={{ maxWidth: 560, marginBottom: 14, borderColor: 'var(--accent)' }}>
          <h3 style={{ fontSize: 'var(--fs-md)', fontFamily: 'var(--font-display)' }}>{i18n.echoes.yourShadeTitle}</h3>
          <p style={{ color: 'var(--fg-dim)', fontSize: 'var(--fs-xs)', marginTop: 4 }}>{i18n.echoes.yourShadeSub}</p>
          <p style={{ color: mined ? 'var(--fg)' : 'var(--fg-dim)', fontSize: 'var(--fs-xs)', marginTop: 6 }}>
            {mined
              ? <>Shade of {entries[0].replay.names[0]} · {statsLine(mined)}</>
              : i18n.echoes.yourShadeFaint}
          </p>
          <button
            className="btn btn-primary"
            onClick={duelYourShade}
            style={{ marginTop: 10, width: '100%', minHeight: 44 }}
          >
            {i18n.echoes.yourShadeDuel} →
          </button>
        </div>
      )}

      {entries !== null && entries.length === 0 && (
        <p className="panel" style={{ padding: 16, fontSize: 'var(--fs-sm)', color: 'var(--fg-dim)' }}>{i18n.echoes.empty}</p>
      )}

      <div style={{ display: 'grid', gap: 10, maxWidth: 560 }}>
        {(entries ?? []).map((e) => (
          <div key={e.key} className="panel card" style={{ textAlign: 'left', padding: '12px 14px' }}>
            <button
              onClick={() => {
                synth.uiTap();
                ui.go('duel', { duelMode: 'replay', pendingEcho: e.replay, campaignDuel: null });
              }}
              style={{ display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none', padding: 0, color: 'inherit', font: 'inherit', cursor: 'pointer' }}
            >
              <h3 style={{ fontSize: 'var(--fs-md)' }}>
                Shade of {e.replay.names[0]}
                {e.imported && (
                  <span style={{ marginLeft: 8, color: 'var(--fg-dim)', fontSize: 'var(--fs-xs)', border: '1px solid var(--fg-dim)', borderRadius: 4, padding: '1px 6px' }}>
                    {i18n.echoes.chitBadge}
                  </span>
                )}
              </h3>
              <p style={{ color: 'var(--fg-dim)', fontSize: 'var(--fs-xs)' }}>
                {describeEcho(e.replay)} · {e.replay.orders[0]} vs {e.replay.orders[1]}
              </p>
              <p style={{ color: 'var(--accent)', fontSize: 'var(--fs-xs)', marginTop: 6 }}>{i18n.echoes.duel} →</p>
            </button>
            {/* T19 — seal this echo into a shareable chit (names redacted) */}
            <button
              onClick={() => void sealChit(e)}
              style={{ marginTop: 8, minHeight: 36, fontSize: 'var(--fs-xs)', color: 'var(--fg-dim)', border: '1px solid var(--fg-dim)', borderRadius: 6, background: 'none', padding: '4px 10px', cursor: 'pointer' }}
            >
              {i18n.echoes.sealChit}
            </button>
          </div>
        ))}
      </div>

      {/* T19 — import a chit another Clerk sealed */}
      <button
        className="panel card"
        onClick={() => { synth.uiTap(); setImportOpen(true); setImportNote(null); }}
        style={{ marginTop: 14, maxWidth: 560, width: '100%', textAlign: 'center' }}
      >
        {i18n.echoes.importChit}
      </button>

      <button
        className="panel card"
        onClick={() => { synth.uiTap(); ui.go('antechamber'); }}
        style={{ marginTop: 12, maxWidth: 560, width: '100%', textAlign: 'center', color: 'var(--fg-dim)' }}
      >
        ← {i18n.echoes.back}
      </button>

      {/* the sealed chit: copy-paste payload, no names inside */}
      {chit && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={i18n.echoes.chitTitle}>
          <div className="panel modal-sheet page-turn" style={{ width: 'min(92vw, 420px)', padding: 20 }}>
            <h2 style={{ fontFamily: 'var(--font-display)', marginBottom: 8 }}>{i18n.echoes.chitTitle}</h2>
            <p style={{ color: 'var(--fg-dim)', fontSize: 'var(--fs-xs)' }}>{i18n.echoes.chitBody}</p>
            <textarea
              readOnly
              value={chit}
              onFocus={(ev) => ev.currentTarget.select()}
              style={{ width: '100%', height: 90, marginTop: 10, fontSize: 'var(--fs-xs)', color: 'var(--fg-dim)', background: 'var(--ink-black)', border: '1px solid var(--fg-dim)', borderRadius: 6, padding: 8, resize: 'none' }}
            />
            {chitCopied && <p style={{ color: 'var(--brass)', fontSize: 'var(--fs-xs)', marginTop: 6 }}>{i18n.echoes.copied}</p>}
            {!chitCopied && <p style={{ color: 'var(--fg-dim)', fontSize: 'var(--fs-xs)', marginTop: 6 }}>{i18n.echoes.copyFail}</p>}
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button className="btn btn-primary" onClick={() => void copyText(chit).then((ok) => setChitCopied(ok || chitCopied))} style={{ flex: 1, minHeight: 44 }}>
                {i18n.echoes.copy}
              </button>
              <button className="btn" onClick={() => { setChit(null); setChitCopied(false); }} style={{ flex: 1, minHeight: 44 }}>
                {i18n.common.close}
              </button>
            </div>
          </div>
        </div>
      )}

      {importOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={i18n.echoes.importTitle}>
          <div className="panel modal-sheet page-turn" style={{ width: 'min(92vw, 420px)', padding: 20 }}>
            <h2 style={{ fontFamily: 'var(--font-display)', marginBottom: 8 }}>{i18n.echoes.importTitle}</h2>
            <p style={{ color: 'var(--fg-dim)', fontSize: 'var(--fs-xs)' }}>{i18n.echoes.chitBody}</p>
            <textarea
              value={importText}
              onChange={(ev) => { setImportText(ev.target.value); setImportNote(null); }}
              placeholder={i18n.echoes.importPlaceholder}
              style={{ width: '100%', height: 90, marginTop: 10, fontSize: 'var(--fs-xs)', background: 'var(--ink-black)', color: 'var(--fg)', border: '1px solid var(--fg-dim)', borderRadius: 6, padding: 8, resize: 'none' }}
            />
            {importNote === 'bad' && <p style={{ color: 'var(--oxblood)', fontSize: 'var(--fs-xs)', marginTop: 6 }}>{i18n.echoes.importBad}</p>}
            {importNote === 'ok' && <p style={{ color: 'var(--brass)', fontSize: 'var(--fs-xs)', marginTop: 6 }}>{i18n.echoes.importOk}</p>}
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button className="btn btn-primary" onClick={() => void importChit()} style={{ flex: 1, minHeight: 44 }}>
                {i18n.echoes.importAction}
              </button>
              <button className="btn" onClick={() => { setImportOpen(false); setImportNote(null); }} style={{ flex: 1, minHeight: 44 }}>
                {i18n.common.close}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
