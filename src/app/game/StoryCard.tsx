// StoryCard — S13: full-screen engraved plate, caption revealed line by line, tap to advance, Skip.
'use client';
import { useState } from 'react';
import { useUi } from '@/state/ui';
import i18n from '@/i18n/en.json';
import { synth } from '@/audio/synth';

export default function StoryCard() {
  const ui = useUi();
  const story = ui.story;
  const [line, setLine] = useState(0);
  if (!story) { ui.go('antechamber'); return null; }

  const advance = () => {
    synth.pageTurn();
    if (line < story.lines.length - 1) setLine(line + 1);
    else {
      const then = story.then;
      ui.go(then, story.campaignIndex ? { campaignDuel: story.campaignIndex } : undefined);
    }
  };

  return (
    <main
      className="page-turn"
      onClick={advance}
      style={{
        minHeight: '100dvh', display: 'grid', gridTemplateRows: 'auto 1fr auto',
        background: 'var(--ink-black)', cursor: 'pointer', padding: 'calc(var(--safe-top) + 10px) 18px calc(var(--safe-bottom) + 18px)',
      }}
    >
      <div style={{ textAlign: 'right' }}>
        <button
          onClick={(e) => { e.stopPropagation(); ui.go(story.then, story.campaignIndex ? { campaignDuel: story.campaignIndex } : undefined); }}
          style={{ color: 'var(--fg-dim)', fontSize: 'var(--fs-sm)', textDecoration: 'underline', minHeight: 40 }}
        >
          {i18n.common.skip}
        </button>
      </div>
      <img
        src={story.plate}
        alt="" role="presentation"
        style={{ width: '100%', maxHeight: '52vh', objectFit: 'cover', border: '1px solid var(--line-strong)' }}
      />
      <div style={{ padding: '18px 4px', textAlign: 'center' }}>
        {story.lines.slice(0, line + 1).map((l, i) => (
          <p key={i} className="page-turn" style={{ fontStyle: 'italic', color: 'var(--fg)', margin: '6px 0', fontSize: 'var(--fs-md)' }}>
            {l}
          </p>
        ))}
        <p style={{ color: 'var(--line-strong)', fontSize: 'var(--fs-xs)', marginTop: 12 }}>{i18n.common.tapToContinue}</p>
      </div>
    </main>
  );
}
