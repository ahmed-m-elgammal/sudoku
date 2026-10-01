// EndingChoice — S19 (TODO T6): the Balance / Burn verdict after the Orsolo reveal.
// Two engraved plates, one irreversible choice. Keyboard: 1 / 2 pick, Enter seals,
// Esc returns. The verdict is written into the save (campaign.ending) and then the
// chosen ending plate plays as a StoryCard, closing into the Endless Assize.
'use client';
import { useEffect, useState } from 'react';
import { useUi } from '@/state/ui';
import { useSave } from '@/state/save';
import i18n from '@/i18n/en.json';
import story from '@/i18n/story.json';
import { synth } from '@/audio/synth';

type Ending = 'balance' | 'burn';

const ENDINGS: Record<Ending, { plate: string; title: string; desc: string; accent: string }> = {
  balance: {
    plate: '/assets/plates/plate-ending-balance.webp',
    title: i18n.endingChoice.balanceTitle,
    desc: i18n.endingChoice.balanceDesc,
    accent: 'var(--brass)',
  },
  burn: {
    plate: '/assets/plates/plate-ending-burn.webp',
    title: i18n.endingChoice.burnTitle,
    desc: i18n.endingChoice.burnDesc,
    accent: 'var(--oxblood)',
  },
};

export default function EndingChoice() {
  const ui = useUi();
  const [chosen, setChosen] = useState<Ending | null>(null);

  const pick = (e: Ending) => { synth.uiTap(); setChosen(e); };

  const seal = (e: Ending) => {
    synth.sealBreak();
    useSave.getState().update((cur) => ({ ...cur, campaign: { ...cur.campaign, ending: e } }));
    ui.go('story', {
      story: {
        lines: [...(e === 'balance' ? story.endings.balance : story.endings.burn)],
        plate: ENDINGS[e].plate,
        then: 'antechamber', // the Endless Assize continues after either ending (docs/STORY.md)
      },
      lastResult: null,
      serverDuel: null,
    });
  };

  // keyboard: 1/left = Balance, 2/right = Burn, Enter = seal, Esc = put the pen down
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === '1' || ev.key === 'ArrowLeft') pick('balance');
      else if (ev.key === '2' || ev.key === 'ArrowRight') pick('burn');
      else if (ev.key === 'Enter' && chosen) seal(chosen);
      else if (ev.key === 'Escape') { setChosen(null); ui.go('antechamber'); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [chosen]);

  return (
    <main
      className="page-turn"
      style={{
        minHeight: '100dvh',
        background: 'var(--ink-black)',
        display: 'grid',
        gridTemplateRows: 'auto auto 1fr auto',
        gap: 14,
        padding: 'calc(var(--safe-top) + 22px) clamp(14px, 4vw, 32px) calc(var(--safe-bottom) + 22px)',
      }}
    >
      <header style={{ textAlign: 'center' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-xl)', letterSpacing: '0.14em', color: 'var(--parchment-light)' }}>
          {i18n.endingChoice.title}
        </h1>
        <p style={{ color: 'var(--fg-dim)', fontStyle: 'italic', fontSize: 'var(--fs-sm)', maxWidth: '52ch', margin: '6px auto 0' }}>
          {i18n.endingChoice.sub}
        </p>
      </header>

      <div
        role="group"
        aria-label={i18n.endingChoice.title}
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(260px, 86vw), 1fr))',
          gap: 'clamp(10px, 2.5vw, 22px)',
          alignContent: 'center',
          alignItems: 'stretch',
          width: 'min(980px, 100%)',
          margin: '0 auto',
        }}
      >
        {(['balance', 'burn'] as Ending[]).map((e) => {
          const meta = ENDINGS[e];
          const armed = chosen === e;
          return (
            <button
              key={e}
              onClick={() => pick(e)}
              aria-pressed={armed}
              className="page-turn"
              style={{
                display: 'grid',
                gridTemplateRows: 'auto auto auto 1fr',
                gap: 8,
                padding: 12,
                background: 'var(--charcoal)',
                border: `2px solid ${armed ? meta.accent : 'var(--line-strong)'}`,
                borderRadius: 6,
                cursor: 'pointer',
                textAlign: 'center',
                transition: 'border-color 140ms ease, transform 140ms ease',
                transform: armed ? 'translateY(-2px)' : 'none',
              }}
            >
              <img
                src={meta.plate}
                alt=""
                role="presentation"
                style={{ width: '100%', maxHeight: '34vh', objectFit: 'cover', border: '1px solid var(--line-strong)', borderRadius: 3 }}
              />
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-lg)', letterSpacing: '0.1em', color: meta.accent }}>
                {meta.title}
              </h2>
              <p style={{ color: 'var(--fg-dim)', fontSize: 'var(--fs-sm)', fontStyle: 'italic', margin: 0 }}>{meta.desc}</p>
              <span style={{ alignSelf: 'end', color: 'var(--ash)', fontSize: 'var(--fs-xs)' }}>
                {armed ? '▸ ' + i18n.endingChoice.confirm : ''}
              </span>
            </button>
          );
        })}
      </div>

      <p style={{ textAlign: 'center', color: 'var(--ash)', fontSize: 'var(--fs-xs)' }}>{i18n.endingChoice.hint}</p>

      {chosen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={i18n.endingChoice.confirmTitle}>
          <div className="panel modal-sheet page-turn" style={{ width: 'min(92vw, 360px)', padding: 20, textAlign: 'center' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', marginBottom: 8, color: ENDINGS[chosen].accent }}>
              {i18n.endingChoice.confirmTitle}
            </h2>
            <p style={{ color: 'var(--fg-dim)', fontSize: 'var(--fs-sm)' }}>{i18n.endingChoice.confirmBody}</p>
            <p style={{ fontFamily: 'var(--font-display)', color: 'var(--parchment-light)', margin: '10px 0 0' }}>
              {ENDINGS[chosen].title}
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 14, flexWrap: 'wrap' }}>
              <button className="btn btn-primary" onClick={() => seal(chosen)}>{i18n.endingChoice.confirm}</button>
              <button className="btn" onClick={() => { synth.uiTap(); setChosen(null); }}>{i18n.endingChoice.return}</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
