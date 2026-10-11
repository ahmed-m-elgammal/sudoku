// ErrorBoundary — the component gate for the DAY1 root-boundary fix.
//
// The regression this locks out: the app shipped with NO error boundary anywhere —
// a single render-time throw unmounted the whole tree, and a release build showed
// the app simply vanishing. The boundary under App.tsx must:
//
//   EB-1  pass a clean subtree through untouched
//   EB-2  catch a render-time throw and render the themed fallback plate
//   EB-3  Resume clears the error and remounts the subtree (zustand keeps the save
//         and the screen machine, so "resume" is real, not a restart)
//   EB-4  report the throw on the warn channel (dev breadcrumbs, EAS build logs)
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Text } from 'react-native';
import { i18n } from '@/i18n';
import ErrorBoundary from '@/ui/ErrorBoundary';

const renderer = require('react-test-renderer') as typeof import('react-test-renderer'); // eslint-disable-line @typescript-eslint/no-require-imports

type Props = Record<string, unknown>;
type Node = { type: string; props: Props; children?: (Node | string)[] };

function isNode(n: unknown): n is Node {
  return !!n && typeof n === 'object' && 'props' in (n as Node);
}

function findAllLabelled(tree: unknown, type: string, label: string, out: Node[] = []): Node[] {
  if (!isNode(tree)) return out;
  if (tree.type === type && tree.props?.accessibilityLabel === label) out.push(tree);
  for (const c of tree.children ?? []) findAllLabelled(c, type, label, out);
  return out;
}
function findAllText(tree: unknown, out: string[] = []): string[] {
  if (!isNode(tree)) return out;
  for (const c of tree.children ?? []) {
    if (typeof c === 'string') out.push(c);
    else findAllText(c, out);
  }
  return out;
}

// React logs every caught render error through console.error, and the boundary
// itself breadcrumbs through console.warn — silence both for the run.
const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
vi.spyOn(console, 'error').mockImplementation(() => {});

afterEach(() => {
  warn.mockClear();
});

describe('ErrorBoundary (the DAY1 root boundary)', () => {
  it('EB-1 a clean subtree renders untouched', () => {
    let tree: ReturnType<typeof renderer.create> | null = null;
    renderer.act(() => {
      tree = renderer.create(
        <ErrorBoundary><Text>the page reads clean</Text></ErrorBoundary>,
      );
    });
    expect(findAllText((tree as unknown as { toJSON: () => unknown }).toJSON())).toContain('the page reads clean');
    expect(findAllText((tree as unknown as { toJSON: () => unknown }).toJSON())).not.toContain(i18n.errorBoundary.title);
  });

  it('EB-2 a render-time throw lands on the fallback plate, not a dead app', () => {
    const Bomb = () => { throw new Error('the page tore'); };
    let tree: ReturnType<typeof renderer.create> | null = null;
    renderer.act(() => {
      tree = renderer.create(<ErrorBoundary><Bomb /></ErrorBoundary>);
    });
    const text = findAllText((tree as unknown as { toJSON: () => unknown }).toJSON());
    expect(text).toContain('ASSIZE');
    expect(text).toContain(i18n.errorBoundary.title);
    expect(text).toContain(i18n.errorBoundary.body);
    // the one recovery affordance announces itself
    expect(findAllLabelled((tree as unknown as { toJSON: () => unknown }).toJSON(), 'Pressable', i18n.errorBoundary.retry)).toHaveLength(1);
  });

  it('EB-3 Resume clears the error and remounts the subtree', () => {
    let shouldThrow = true;
    const Fragile = () => {
      if (shouldThrow) throw new Error('the page tore');
      return <Text>the page reads clean</Text>;
    };
    let tree: ReturnType<typeof renderer.create> | null = null;
    renderer.act(() => {
      tree = renderer.create(<ErrorBoundary><Fragile /></ErrorBoundary>);
    });
    expect(findAllText((tree as unknown as { toJSON: () => unknown }).toJSON())).toContain(i18n.errorBoundary.title);

    // the wound heals: the next mount succeeds, so Resume must come back clean
    shouldThrow = false;
    const pressed = findAllLabelled((tree as unknown as { toJSON: () => unknown }).toJSON(), 'Pressable', i18n.errorBoundary.retry)[0]!;
    renderer.act(() => {
      (pressed.props.onPress as () => void)();
    });
    expect(findAllText((tree as unknown as { toJSON: () => unknown }).toJSON())).toContain('the page reads clean');
    expect(findAllText((tree as unknown as { toJSON: () => unknown }).toJSON())).not.toContain(i18n.errorBoundary.title);
  });

  it('EB-4 the boundary reports the throw with the [assize] marker', () => {
    const Bomb = () => { throw new Error('the page tore'); };
    renderer.act(() => {
      renderer.create(<ErrorBoundary><Bomb /></ErrorBoundary>);
    });
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('[assize]'),
      expect.stringContaining('the page tore'),
      expect.anything(),
    );
  });
});
