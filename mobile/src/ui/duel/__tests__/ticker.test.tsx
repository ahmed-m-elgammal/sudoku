// Ticker — the M1 G5 tutorial legibility law.
//
// The tutorial's event log is the first text a new player reads mid-duel, so it may
// not truncate mid-word and may not assume the child reads Roman numerals:
//   TICK-1  tutorial mode renders unit names with ARABIC numerals ("Row 5") …
//   TICK-2  …and allows two lines (the web's one-line clamp truncated "Row IV
//           claimed by You. Shad…")
//   TICK-3  every other mode keeps the web build's one-line Roman-numeral law
import { describe, it, expect } from 'vitest';
import type React from 'react';
import type { DuelRuntime } from '@/game/duelRuntime';
import { i18n } from '@/i18n';
import { themeFor } from '@/theme/tokens';
import Ticker from '@/ui/duel/Ticker';

function renderToJson(element: React.ReactElement) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const renderer = require('react-test-renderer');
  let tree: { toJSON: () => unknown } | null = null;
  renderer.act(() => {
    tree = renderer.create(element);
  });
  return tree!.toJSON();
}

function tickerFor(mode: string) {
  const duel = {
    state: { events: [{ kind: 'claim', player: 0, unit: 'r4', damage: 1 }] },
    opts: { mode },
  } as unknown as DuelRuntime;
  return renderToJson(<Ticker duel={duel} theme={themeFor()} />);
}

const text = (node: unknown): string => JSON.stringify(node);

describe('Ticker · P2.2 taunts (the court talks back)', () => {
  const tauntDuel = (mode: string, taunt: unknown) =>
    ({
      state: { events: [{ kind: 'claim', player: 1, unit: 'r4', damage: 1, taunt }] },
      opts: { mode },
    }) as unknown as DuelRuntime;

  it('TICK-4 a taunt renders the Magistrate speaking, display font, one line', () => {
    const json = renderToJson(
      <Ticker duel={tauntDuel('campaign', { key: 'halbrecht', idx: 0 })} theme={themeFor()} />,
    );
    const s = text(json);
    expect(s).toContain('Halbrecht: ');
    expect(s).toContain('You hold that pen like a knife you fear.');
    expect(s).toContain('"numberOfLines":1');
  });

  it('TICK-5 the generic Shade voice answers for shade duels', () => {
    const json = renderToJson(
      <Ticker duel={tauntDuel('shade', { key: 'shade', idx: 1 })} theme={themeFor()} />,
    );
    const s = text(json);
    expect(s).toContain(`${i18n.common.theShade}: `);
    expect(s).toContain(i18n.duel.shadeTaunt[1]);
  });

  it('TICK-6 an invalid taunt falls through to the normal event text', () => {
    for (const bad of [{ key: 'no-such-mag', idx: 0 }, { key: 'halbrecht', idx: 7 }, null, 'halbrecht']) {
      const json = renderToJson(
        <Ticker duel={tauntDuel('campaign', bad)} theme={themeFor()} />,
      );
      const s = text(json);
      expect(s).not.toContain(': You hold that pen');
      expect(s).toContain('Row');
    }
  });

  it('TICK-7 tutorial duels stay silent even with a taunt field present', () => {
    const json = renderToJson(
      <Ticker duel={tauntDuel('tutorial', { key: 'halbrecht', idx: 0 })} theme={themeFor()} />,
    );
    expect(text(json)).not.toContain('You hold that pen');
  });
});

describe('Ticker · the tutorial legibility law (M1 G5)', () => {
  it('TICK-1 the tutorial log names units in Arabic numerals', () => {
    const json = tickerFor('tutorial');
    // unit r4 → index 5 → "Row 5", never "Row V"
    expect(text(json)).toContain(`Row 5`);
    expect(text(json)).not.toMatch(/Row\s+V\b/);
    expect(text(json)).toContain(i18n.common.you);
  });

  it('TICK-2 the tutorial log may wrap to two lines', () => {
    const json = tickerFor('tutorial');
    expect(text(json)).toContain('"numberOfLines":2');
  });

  it('TICK-3 every other mode keeps the one-line Roman-numeral law', () => {
    const json = tickerFor('practice');
    expect(text(json)).toContain(`Row ${i18n.common.roman[5]}`);
    expect(text(json)).toContain('"numberOfLines":1');
  });
});
