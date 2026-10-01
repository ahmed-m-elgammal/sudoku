// SettingsScreen — S18: audio, haptics, contrast, motion, text size, auto-notes, highlights,
// left-hand layout, language, telemetry opt-out, export/import, delete data, about/privacy.
'use client';
import { useUi } from '@/state/ui';
import { useSave } from '@/state/save';
import { idbClearAll } from '@/state/idb';
import i18n from '@/i18n/en.json';
import Ribbon from './Ribbon';
import { synth } from '@/audio/synth';

export default function SettingsScreen() {
  const ui = useUi();
  const save = useSave((s) => s.save);
  if (!save) return null;
  const s = save.settings;
  const set = (patch: Partial<typeof s>) => {
    useSave.getState().update((cur) => ({ ...cur, settings: { ...cur.settings, ...patch } }));
  };

  const Row = ({ label, children, note }: { label: string; children: React.ReactNode; note?: string }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
      <div style={{ flex: 1 }}>
        <b style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-sm)' }}>{label}</b>
        {note && <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--fg-dim)' }}>{note}</p>}
      </div>
      {children}
    </div>
  );
  const Toggle = ({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) => (
    <button role="switch" aria-checked={on} aria-label={label} onClick={() => { synth.uiTap(); onClick(); }}
      style={{
        width: 52, height: 30, borderRadius: 15, border: '1.5px solid var(--line-strong)',
        background: on ? 'var(--oxblood)' : 'var(--charcoal-2)', position: 'relative', minHeight: 30,
      }}>
      <i style={{ position: 'absolute', top: 3, left: on ? 26 : 3, width: 21, height: 21, borderRadius: '50%', background: 'var(--parchment-light)', transition: 'left var(--t-fast)' }} />
    </button>
  );

  return (
    <main className="hub" style={{ minHeight: '100dvh', paddingBottom: 'calc(var(--ribbon-h) + var(--safe-bottom))' }}>
      <header style={{ padding: 'calc(var(--safe-top) + 14px) 16px 4px' }}>
        <h1>{i18n.settings.title}</h1>
      </header>
      <section className="panel" style={{ margin: '8px 16px', padding: '6px 14px' }}>
        <Row label={i18n.settings.music}>
          <input type="range" min={0} max={1} step={0.05} value={s.music} aria-label={i18n.settings.music}
            onChange={(e) => { set({ music: Number(e.target.value) }); synth.setMusic(Number(e.target.value)); }} />
        </Row>
        <Row label={i18n.settings.effects}>
          <input type="range" min={0} max={1} step={0.05} value={s.fx} aria-label={i18n.settings.effects}
            onChange={(e) => { set({ fx: Number(e.target.value) }); synth.setFx(Number(e.target.value)); }} />
        </Row>
        <Row label={i18n.settings.haptics}><Toggle on={s.haptics} onClick={() => set({ haptics: !s.haptics })} label={i18n.settings.haptics} /></Row>
        <Row label={i18n.settings.colorblind} note={i18n.settings.colorblindNote}>
          <b style={{ color: 'var(--brass)', fontSize: 'var(--fs-xs)' }}>ON</b>
        </Row>
        <Row label={i18n.settings.highContrast}><Toggle on={s.contrast} onClick={() => set({ contrast: !s.contrast })} label={i18n.settings.highContrast} /></Row>
        <Row label={i18n.settings.reducedMotion}><Toggle on={s.reducedMotion} onClick={() => set({ reducedMotion: !s.reducedMotion })} label={i18n.settings.reducedMotion} /></Row>
        <Row label={i18n.settings.textSize}>
          {(['s', 'm', 'l'] as const).map((t) => (
            <button key={t} aria-pressed={s.text === t} onClick={() => set({ text: t })}
              style={{ border: `1px solid ${s.text === t ? 'var(--brass)' : 'var(--line-strong)'}`, color: s.text === t ? 'var(--brass)' : 'var(--fg-dim)', minHeight: 34, minWidth: 34 }}>
              {i18n.settings[t === 's' ? 'small' : t === 'm' ? 'medium' : 'large']}
            </button>
          ))}
        </Row>
        <Row label={i18n.settings.autoNotes}><Toggle on={s.autoNotes} onClick={() => set({ autoNotes: !s.autoNotes })} label={i18n.settings.autoNotes} /></Row>
        <Row label={i18n.settings.highlights}><Toggle on={s.highlights} onClick={() => set({ highlights: !s.highlights })} label={i18n.settings.highlights} /></Row>
        <Row label={i18n.settings.leftHand}><Toggle on={s.leftHand} onClick={() => set({ leftHand: !s.leftHand })} label={i18n.settings.leftHand} /></Row>
        <Row label={i18n.settings.language}>
          <b style={{ color: 'var(--fg-dim)', fontSize: 'var(--fs-sm)' }}>EN</b>
        </Row>
        <Row label={i18n.settings.telemetry} note={i18n.settings.telemetryNote}>
          <Toggle on={s.telemetry} onClick={() => set({ telemetry: !s.telemetry })} label={i18n.settings.telemetry} />
        </Row>
      </section>

      <section className="panel" style={{ margin: '10px 16px', padding: 14 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-md)' }}>{i18n.settings.about}</h2>
        <p style={{ color: 'var(--fg-dim)', fontSize: 'var(--fs-sm)', margin: '6px 0 10px' }}>{i18n.settings.aboutBody}</p>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-sm)' }}>{i18n.settings.privacy}</h3>
        <p style={{ color: 'var(--fg-dim)', fontSize: 'var(--fs-sm)' }}>{i18n.settings.privacyBody}</p>
      </section>

      <section className="panel" style={{ margin: '10px 16px', padding: 14 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
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
            {i18n.settings.exportSave}
          </button>
          <input aria-label={i18n.settings.importSave} type="file" accept="application/json" onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            try {
              const parsed = JSON.parse(await f.text());
              if (parsed?.v === 2) useSave.getState().update(() => parsed);
            } catch { synth.error(); }
          }} />
          <button
            className="btn btn-oxblood"
            onClick={() => {
              if (confirm(i18n.settings.deleteConfirm)) {
                void idbClearAll();
                location.reload();
              }
            }}
          >
            {i18n.settings.deleteData}
          </button>
        </div>
      </section>
      <Ribbon />
    </main>
  );
}
