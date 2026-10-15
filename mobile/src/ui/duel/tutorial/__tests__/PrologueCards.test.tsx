// P2.1 — the whole prologue (docs/STORY_HOLD_PLAN.md P2.1).
//
//   PROL-1  all four canon lines render, byte-equal to story.json.prologue.
//   PROL-2  tap advances card by card; the fourth tap fires onDone (the
//           director's prologueDone gate) exactly once.
import { describe, it, expect, vi } from 'vitest';
import { storyJson, i18n } from '@/i18n';
import { themeFor } from '@/theme/tokens';
import PrologueCards from '@/ui/duel/tutorial/PrologueCards';

const renderer = require('react-test-renderer') as typeof import('react-test-renderer'); // eslint-disable-line @typescript-eslint/no-require-imports

type Props = Record<string, unknown>;
type Node = { type: string; props: Props; children?: (Node | string)[] };

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

type RendererTree = ReturnType<typeof renderer.create>;

function pressTap(tree: RendererTree) {
  renderer.act(() => {
    tree.root.findByProps({ accessibilityLabel: i18n.tutorialV2.prologueTap }).props.onPress();
  });
  return findAllText(tree.toJSON()).join('');
}

describe('PrologueCards (P2.1)', () => {
  it('PROL-1 all four canon lines render verbatim', () => {
    const onDone = vi.fn();
    let tree: RendererTree | null = null;
    renderer.act(() => {
      tree = renderer.create(<PrologueCards theme={themeFor()} onDone={onDone} />);
    });
    // card 1 is the setting the old build never showed
    expect(findAllText(tree!.toJSON()).join('')).toContain(storyJson.prologue[0]);
    expect(onDone).not.toHaveBeenCalled();
  });

  it('PROL-2 tap advances through four cards; the fourth fires onDone once', () => {
    const onDone = vi.fn();
    let tree: RendererTree | null = null;
    renderer.act(() => {
      tree = renderer.create(<PrologueCards theme={themeFor()} onDone={onDone} />);
    });
    let s = pressTap(tree!);
    expect(s).toContain(storyJson.prologue[1]);
    expect(onDone).not.toHaveBeenCalled();
    s = pressTap(tree!);
    expect(s).toContain(storyJson.prologue[2]);
    expect(onDone).not.toHaveBeenCalled();
    s = pressTap(tree!);
    expect(s).toContain(storyJson.prologue[3]);
    expect(onDone).not.toHaveBeenCalled();
    pressTap(tree!);
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
