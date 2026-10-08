// TutorialCoach — the component-level gate for the M1 docked note (G1/G3/G4).
//
// The coach is the tutorial's margin note, docked in the layout flow, with the skip
// chip in the banner row. Its testable surface:
//   COACH-1  the note copy and the skip chip land (i18n, not literals)
//   COACH-2  (G1) the augur note is readable for 2.5 s BEFORE the free rite is
//            granted — the old screen effect granted on the note's first frame,
//            which self-destructed the note
//   COACH-3  a non-augur note never schedules the grant
//   COACH-4  an already-granted duel never schedules the grant (idempotence law)
//   COACH-5  unmount withdraws the pending grant (cleanup law)
//   COACH-6  the skip chip presses exactly once into the screen's onSkip
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type React from 'react';
import { i18n } from '@/i18n';
import { themeFor } from '@/theme/tokens';
import TutorialCoach from '@/ui/duel/TutorialCoach';
import type { DuelRuntime } from '@/game/duelRuntime';

function renderToJson(element: React.ReactElement) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const renderer = require('react-test-renderer');
  let tree: { toJSON: () => unknown; unmount: () => void } | null = null;
  renderer.act(() => {
    tree = renderer.create(element);
  });
  return tree!;
}

/** A duel double carrying only the members the coach touches. */
function makeDuel(granted = false) {
  return {
    freeAugurGranted: granted,
    grantFreeAugur: vi.fn(),
  } as unknown as DuelRuntime;
}

/** Walk the JSON tree collecting every node of a host type. */
function findAll(node: unknown, type: string, out: Record<string, unknown>[] = []): Record<string, unknown>[] {
  if (!node || typeof node !== 'object') return out;
  const n = node as Record<string, unknown>;
  if (n.type === type) out.push(n);
  if (Array.isArray(n.children)) for (const c of n.children) findAll(c, type, out);
  return out;
}

const text = (node: unknown): string =>
  findAll(node, 'Text')
    .map((t) => {
      const kids = t.children as unknown[] | undefined;
      return typeof kids?.[0] === 'string' ? (kids[0] as string) : '';
    })
    .join('|');

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('TutorialCoach · the docked note (M1 G1/G4)', () => {
  it('COACH-1 renders the note copy and the skip chip from i18n', () => {
    const duel = makeDuel();
    const tree = renderToJson(
      <TutorialCoach duel={duel} note="select" theme={themeFor()} onSkip={() => {}} />,
    );
    const json = tree.toJSON();
    expect(text(json)).toContain(i18n.tutorial.notes.select);
    expect(text(json)).toContain(i18n.tutorial.skip);
  });

  it('COACH-2 (G1) the augur note holds 2.5 s before the free rite is granted', () => {
    const duel = makeDuel();
    const tree = renderToJson(
      <TutorialCoach duel={duel} note="augur" theme={themeFor()} onSkip={() => {}} />,
    );
    // the first frame grants NOTHING — this is the bug that flashed the note away
    expect(duel.grantFreeAugur).not.toHaveBeenCalled();
    renderer_act(tree, () => vi.advanceTimersByTime(2499));
    expect(duel.grantFreeAugur).not.toHaveBeenCalled();
    renderer_act(tree, () => vi.advanceTimersByTime(1));
    expect(duel.grantFreeAugur).toHaveBeenCalledTimes(1);
  });

  it('COACH-3 a non-augur note never schedules the grant', () => {
    const duel = makeDuel();
    const tree = renderToJson(
      <TutorialCoach duel={duel} note="pencil" theme={themeFor()} onSkip={() => {}} />,
    );
    renderer_act(tree, () => vi.advanceTimersByTime(60_000));
    expect(duel.grantFreeAugur).not.toHaveBeenCalled();
  });

  it('COACH-4 an already-granted duel never schedules the grant', () => {
    const duel = makeDuel(true);
    const tree = renderToJson(
      <TutorialCoach duel={duel} note="augur" theme={themeFor()} onSkip={() => {}} />,
    );
    renderer_act(tree, () => vi.advanceTimersByTime(60_000));
    expect(duel.grantFreeAugur).not.toHaveBeenCalled();
  });

  it('COACH-5 unmount withdraws the pending grant', () => {
    const duel = makeDuel();
    const tree = renderToJson(
      <TutorialCoach duel={duel} note="augur" theme={themeFor()} onSkip={() => {}} />,
    );
    renderer_act(tree, () => vi.advanceTimersByTime(1000));
    renderer_act(tree, () => tree!.unmount());
    renderer_act(tree, () => vi.advanceTimersByTime(10_000));
    expect(duel.grantFreeAugur).not.toHaveBeenCalled();
  });

  it('COACH-6 the skip chip presses once into onSkip', () => {
    const duel = makeDuel();
    const onSkip = vi.fn();
    const tree = renderToJson(
      <TutorialCoach duel={duel} note="select" theme={themeFor()} onSkip={onSkip} />,
    );
    const pressables = findAll(tree.toJSON(), 'Pressable');
    expect(pressables).toHaveLength(1); // G4 — the ONLY pressable is the banner-row skip
    renderer_act(tree, () => (pressables[0].props as { onPress: () => void }).onPress());
    expect(onSkip).toHaveBeenCalledTimes(1);
  });
});

/** react-test-renderer.act, required lazily (see baseline.test.tsx for the law). */
function renderer_act(tree: { toJSON: () => unknown }, fn: () => void) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const renderer = require('react-test-renderer');
  renderer.act(fn);
}
