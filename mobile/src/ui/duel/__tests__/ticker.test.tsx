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
