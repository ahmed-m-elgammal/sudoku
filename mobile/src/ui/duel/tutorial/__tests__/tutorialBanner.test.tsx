// TutorialBanner — the M2 docked banner, end to end (docs/TUTORIAL_OPTIMIZATION_PLAN.md
// §5.3). The v1 docked note's laws carry over to the v2 banner and stay pinned:
//
//   TUTORIAL-B-1  the copy lands from the dictionary (plain + flavor), never a literal
//   TUTORIAL-B-2  the progress dots announce "Step n of 9" to access
//   TUTORIAL-B-3  the t1 CTA fires the continue gate; the skip chip fires onSkip
//   TUTORIAL-B-4  NO node of the banner tree is absolutely positioned — the G3 law:
//                 the docked note can never cover a cell (COACH-7's v2 twin)
//   TUTORIAL-B-5  the t9 telegraph replaces the plain line ("The Shade eyes Row 3…")
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type React from 'react';
import { i18n, tf } from '@/i18n';
import TutorialBanner from '@/ui/duel/tutorial/TutorialBanner';
import type { DuelRuntime } from '@/game/duelRuntime';
import type { TutorialPhase } from '@/game/tutorialDirector';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const renderer = require('react-test-renderer') as typeof import('react-test-renderer');

type Node = { type: string; props: Record<string, unknown>; children?: (Node | string)[] };

function isNode(n: unknown): n is Node {
  return !!n && typeof n === 'object' && 'props' in (n as Node);
}

function findAllText(tree: unknown, out: string[] = []): string[] {
  if (!isNode(tree)) return out;
  for (const c of tree.children ?? []) {
    if (typeof c === 'string') out.push(c);
    else findAllText(c, out);
  }
  return out;
}

function findByLabel(tree: unknown, label: string): Node | null {
  if (!isNode(tree)) return null;
  if (tree.props?.accessibilityLabel === label) return tree;
  for (const c of tree.children ?? []) {
    const hit = findByLabel(c, label);
    if (hit) return hit;
  }
  return null;
}

function flattenStyles(n: unknown, out: Record<string, unknown>[] = []): Record<string, unknown>[] {
  if (!isNode(n)) return out;
  const style = n.props?.style;
  const arr = Array.isArray(style) ? style : style ? [style] : [];
  for (const s of arr) {
    if (s && typeof s === 'object') out.push(s as Record<string, unknown>);
  }
  for (const c of n.children ?? []) flattenStyles(c, out);
  return out;
}

const fakeDuel = (): DuelRuntime => ({
  freeAugurGranted: false,
  grantFreeAugur: () => {},
}) as unknown as DuelRuntime;

function renderBanner(phase: TutorialPhase, opts: { telegraph?: { unit: 'row'; n: number } } = {}) {
  const onGate = vi.fn();
  const onSkip = vi.fn();
  let tree: ReturnType<typeof renderer.create> | null = null;
  renderer.act(() => {
    tree = renderer.create(
      <TutorialBanner
        duel={fakeDuel()}
        phase={phase}
        target={phase === 't6' ? { kind: 'cell', cell: 0 } : null}
        telegraph={opts.telegraph ?? null}
        theme={{
          bg: '#000', bgRaised: '#111', bgSunken: '#222', fg: '#eee', fgDim: '#aaa', fgBright: '#fff',
          accent: '#700', accentDeep: '#500', line: '#333', lineStrong: '#444', focus: '#a50',
          danger: '#700', ok: '#365', floodYou: 'rgba(0,0,0,0)', floodYouSettle: 'rgba(0,0,0,0)',
          floodYouCold: 'rgba(0,0,0,0)', floodYouColdSettle: 'rgba(0,0,0,0)', floodFoe: 'rgba(0,0,0,0)',
          floodFoeSettle: 'rgba(0,0,0,0)', heatWash: 'rgba(0,0,0,0)', heatWashAlpha: 0.6,
          cdTrack: 'rgba(0,0,0,0)', hushVeil: 'rgba(0,0,0,0)', cellSelected: 'rgba(0,0,0,0)',
          cellSameDigit: 'rgba(0,0,0,0)', worldDim: 'rgba(0,0,0,0)', worldDimDeep: 'rgba(0,0,0,0)',
          modalScrim: 'rgba(0,0,0,0)', youRowWash: 'rgba(0,0,0,0)', stampRing: 'rgba(0,0,0,0)',
          tileArtAlpha: 0.28, textScale: 1,
        }}
        onGate={onGate}
        onSkip={onSkip}
      />,
    );
  });
  return { onGate, onSkip, toJSON: () => tree?.toJSON() };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('TutorialBanner · the M2 docked banner', () => {
  it('TUTORIAL-B-1 the copy lands from the dictionary: plain line, then flavor line', () => {
    const json = renderBanner('t3').toJSON();
    const text = findAllText(json);
    expect(text).toContain(i18n.tutorialV2.t3Plain);
    expect(text).toContain(i18n.tutorialV2.t3Flavor);
  });

  it('TUTORIAL-B-2 the progress dots announce the taught step to access', () => {
    const json = renderBanner('t4').toJSON();
    const dots = findByLabel(json, tf('tutorialV2.step', { n: 4, total: 9 }));
    expect(dots).not.toBeNull();
    expect(findAllText(json)).not.toContain(tf('tutorialV2.step', { n: 5, total: 9 }));
  });

  it('TUTORIAL-B-3 the t1 CTA fires the continue gate; the skip chip fires onSkip', () => {
    const { onGate, onSkip, toJSON } = renderBanner('t1');
    const cta = findByLabel(toJSON(), i18n.tutorialV2.t1Cta);
    expect(cta).not.toBeNull();
    renderer.act(() => { (cta!.props.onPress as () => void)(); });
    expect(onGate).toHaveBeenCalledWith('continue');
    const skip = findByLabel(toJSON(), i18n.tutorial.skip);
    expect(skip).not.toBeNull();
    renderer.act(() => { (skip!.props.onPress as () => void)(); });
    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  it('TUTORIAL-B-4 no node of the banner tree is absolutely positioned (the G3 law, v2)', () => {
    for (const phase of ['t1', 't3', 't6', 't9'] as TutorialPhase[]) {
      const json = renderBanner(phase).toJSON();
      const styles = flattenStyles(json);
      expect(styles.length).toBeGreaterThan(0);
      for (const s of styles) expect(s.position).not.toBe('absolute');
    }
  });

  it('TUTORIAL-B-5 the t9 telegraph replaces the plain line with the announced unit', () => {
    const json = renderBanner('t9', { telegraph: { unit: 'row', n: 3 } }).toJSON();
    const text = findAllText(json);
    expect(text).toContain(tf('tutorialV2.telegraph', { unit: tf('tutorialV2.unitRow', { n: 3 }) }));
    expect(text).not.toContain(i18n.tutorialV2.t9Plain);
  });
});
