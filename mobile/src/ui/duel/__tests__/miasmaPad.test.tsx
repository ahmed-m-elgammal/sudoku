// Pins the DAY3 Miasma/pencil bar (report A14).
//
// The shipped law (shared/config.ts:41) is "MIASMA: notes erased, pencil disabled",
// and the fog overlay on the cells already told that story — but the PAD did not:
// `if (pencil && !flags.miasma) toggleNote else place` silently FELL THROUGH to a
// real placement whenever the pencil was on, so a player tapping what they believed
// were pencil marks placed seal-burning ink instead. The pad also had no barred
// visual: the toggle happily read "on" under the fog.
//
// The law now:
//   MIAS-1  pencil on + Miasma at the tap → the tap is swallowed. No ink, no note.
//   MIAS-2  pencil on + no Miasma → the note toggles (the unchanged pencil law).
//   MIAS-3  pencil off + Miasma → ink places (the unchanged ink law; the bar is the
//           pencil's, not the pad's).
//   MIAS-4  the bar is read FRESH at the tap — Miasma landing between the render and
//           the press must still be honoured (the old render-scope check could not).
//   MIAS-5  under Miasma the digit labels stop claiming "pencil mode" the taps
//           cannot deliver.
import { describe, expect, it, vi } from 'vitest';
import type React from 'react';
import type { DuelRuntime } from '@/game/duelRuntime';
import { i18n } from '@/i18n';
import { themeFor } from '@/theme/tokens';
import NumPad from '@/ui/duel/NumPad';

// the art registry's require() calls are Metro's business (the ledgerArt law) —
// the pad's LAW is the tap routing, not the art
vi.mock('@/ui/duel/duelAssets', () => ({
  duelArt: new Proxy({}, { get: (_t, k) => `${String(k)}-stub` }),
}));

function renderToJson(element: React.ReactElement) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const renderer = require('react-test-renderer');
  let tree: { toJSON: () => unknown } | null = null;
  renderer.act(() => {
    tree = renderer.create(element);
  });
  return tree!.toJSON() as Node;
}

type Props = Record<string, unknown>;
type Node = { type: string; props: Props; children?: (Node | string)[] };

const isNode = (n: unknown): n is Node => !!n && typeof n === 'object' && 'props' in (n as Node);

function walk(n: unknown, visit: (x: Node) => void): void {
  if (!isNode(n)) return;
  visit(n);
  for (const c of n.children ?? []) walk(c, visit);
}

interface Stub {
  duel: DuelRuntime;
  placed: unknown[][];
  noted: unknown[][];
  setMiasma: (on: boolean) => void;
}

function stubDuel(opts: { pencil: boolean; miasma: boolean; selected: number | null }): Stub {
  const placed: unknown[][] = [];
  const noted: unknown[][] = [];
  let miasma = opts.miasma;
  const duel = {
    state: { players: [{ board: new Int8Array(81) }] },
    pencil: opts.pencil,
    selected: opts.selected,
    flags: () => ({
      chained: new Set<number>(),
      smudged: new Set<number>(),
      hushed: false,
      miasma,
      quarantinedUnits: new Set<number>(),
    }),
    place: (...a: unknown[]) => { placed.push(a); },
    toggleNote: (...a: unknown[]) => { noted.push(a); },
    setNotes: () => {},
    select: () => {},
  } as unknown as DuelRuntime;
  return { duel, placed, noted, setMiasma: (on) => { miasma = on; } };
}

/** Press a numeral tile the way a finger would: through the tree's own onPress. */
function pressDigit(tree: Node, d: number): void {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const renderer = require('react-test-renderer');
  let found: Props | null = null;
  walk(tree, (n) => {
    if (found) return;
    if (n.props.accessibilityRole === 'button' && typeof n.props.accessibilityLabel === 'string'
      && n.props.accessibilityLabel.startsWith(`${d},`) && typeof n.props.onPress === 'function') {
      found = n.props;
    }
  });
  // the assignment happens inside the walk closure, so TS's control flow sees
  // `found` as never-null-narrowed — mirror the LedgerProfile test's explicit cast
  const tile = found as Props | null;
  if (!tile) throw new Error(`digit tile ${d} not found`);
  const onPress = tile.onPress as () => void;
  renderer.act(() => { onPress(); });
}

const pad = (duel: DuelRuntime) => <NumPad duel={duel} frozen={false} heat={0} theme={themeFor()} onTap={() => {}} />;

describe('NumPad — the Miasma pencil bar (A14)', () => {
  it('MIAS-1 pencil on + Miasma: the tap is swallowed — no ink, no note', () => {
    const s = stubDuel({ pencil: true, miasma: true, selected: 4 });
    const tree = renderToJson(pad(s.duel));
    pressDigit(tree, 3);
    expect(s.placed).toEqual([]);
    expect(s.noted).toEqual([]);
  });

  it('MIAS-2 pencil on, no Miasma: the note toggles — the unchanged pencil law', () => {
    const s = stubDuel({ pencil: true, miasma: false, selected: 4 });
    const tree = renderToJson(pad(s.duel));
    pressDigit(tree, 3);
    expect(s.noted).toEqual([[4, 3]]);
    expect(s.placed).toEqual([]);
  });

  it('MIAS-3 pencil off + Miasma: ink places — the bar is the pencil\u2019s, not the pad\u2019s', () => {
    const s = stubDuel({ pencil: false, miasma: true, selected: 4 });
    const tree = renderToJson(pad(s.duel));
    pressDigit(tree, 3);
    expect(s.placed).toEqual([[4, 3]]);
    expect(s.noted).toEqual([]);
  });

  it('MIAS-4 the bar reads FRESH at the tap — Miasma landing after the render still bars', () => {
    const s = stubDuel({ pencil: true, miasma: false, selected: 4 });
    const tree = renderToJson(pad(s.duel));
    s.setMiasma(true); // the fog lands between the render and the press
    pressDigit(tree, 3);
    expect(s.placed).toEqual([]);
    expect(s.noted).toEqual([]);
  });

  it('MIAS-5 under Miasma the digit labels stop claiming pencil mode', () => {
    const s = stubDuel({ pencil: true, miasma: true, selected: 4 });
    const tree = renderToJson(pad(s.duel));
    const labels: string[] = [];
    walk(tree, (n) => {
      const l = n.props.accessibilityLabel;
      if (typeof l === 'string' && /^[1-9],/.test(l)) labels.push(l);
    });
    expect(labels.length).toBe(9);
    for (const l of labels) expect(l).not.toContain(i18n.duel.pad.pencil);
    // and the same pad without the fog keeps the suffix — the law is Miasma's, not a removal
    const clear = stubDuel({ pencil: true, miasma: false, selected: 4 });
    const tree2 = renderToJson(pad(clear.duel));
    const labels2: string[] = [];
    walk(tree2, (n) => {
      const l = n.props.accessibilityLabel;
      if (typeof l === 'string' && /^[1-9],/.test(l)) labels2.push(l);
    });
    expect(labels2[0]).toContain(i18n.duel.pad.pencil);
  });
});
