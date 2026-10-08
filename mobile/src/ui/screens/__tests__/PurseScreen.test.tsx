// PurseScreen — the component-level gate (specs/17 phase 5.5).
//
// The screen is one tap target wrapping the three-line explainer, so its
// testable surface is small and total:
//
//   PURSE-1  the copy lands from the dictionary — title, the three lines, the
//            tap-to-continue footer (nothing reworded, nothing added)
//   PURSE-2  the three icons ride the art seam at the web's 26×26, in the web's
//            order (ink-drop, sigil-coin, chest-closed)
//   PURSE-3  a tap ANYWHERE turns the page to the Antechamber with the ui tap —
//            the web's whole-page onClick
//   PURSE-4  the root is a button labelled with the tapToContinue copy (the web
//            page's own affordance; it has no other label)
//
// The art seam is mocked (the cabinetArt law — the real requires are Metro-only);
// the real i18n, the real screen machine and the real audio seam stay live.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { i18n } from '@/i18n';
import { useUi } from '@/state/ui';
import { useSave } from '@/state/save';
import { __resetStorageBackends, storage } from '@/platform/storage';
import { audio } from '@/platform/audio';
import PurseScreen from '@/ui/screens/PurseScreen';

vi.mock('@/ui/screens/ledgerArt', () => ({
  rankArt: (id: string) => `art://rank-${id}`,
  achievementArt: (id: string) => `art://achievement-${id}`,
  purseArt: (which: string) => `art://purse-${which}`,
}));

vi.mock('@/platform/display', () => ({
  useDisplaySettings: () => ({ contrast: false, text: 'm' as const }),
  useMotionReduced: () => false,
}));

type Props = Record<string, unknown>;
type Node = { type: string; props: Props; children?: (Node | string)[] };

function isNode(n: unknown): n is Node {
  return !!n && typeof n === 'object' && 'props' in (n as Node);
}

function findAll(tree: unknown, type: string, out: Node[] = []): Node[] {
  if (!isNode(tree)) return out;
  if (tree.type === type) out.push(tree);
  for (const c of tree.children ?? []) findAll(c, type, out);
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

const renderer = require('react-test-renderer') as typeof import('react-test-renderer'); // eslint-disable-line @typescript-eslint/no-require-imports

async function renderScreen(): Promise<{ toJSON: () => unknown; unmount: () => void }> {
  let tree: ReturnType<typeof renderer.create> | null = null;
  await renderer.act(async () => {
    tree = renderer.create(<PurseScreen />);
  });
  return tree as unknown as { toJSON: () => unknown; unmount: () => void };
}

beforeEach(async () => {
  __resetStorageBackends();
  await storage.clearAll();
  vi.spyOn(Date, 'now').mockImplementation(() => 1_700_000_000_000);
  await useSave.getState().load();
  useUi.setState({ screen: 'purse', prev: null });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('PurseScreen (specs/17 5.5)', () => {
  it('PURSE-1 the dictionary copy lands: title, the three explainer lines, the footer', async () => {
    const tree = await renderScreen();
    const text = findAllText(tree.toJSON());
    expect(text).toContain(i18n.purse.title);
    expect(text).toContain(i18n.purse.ink);
    expect(text).toContain(i18n.purse.sigils);
    expect(text).toContain(i18n.purse.reliquary);
    expect(text).toContain(i18n.common.tapToContinue);
  });

  it('PURSE-2 the three icons ride the art seam at 26×26, in the web\'s order', async () => {
    const tree = await renderScreen();
    const icons = findAll(tree.toJSON(), 'Image');
    const uris = icons.map((n) => (n.props.source as { uri: string } | undefined)?.uri as string);
    expect(uris).toEqual(['art://purse-inkDrop', 'art://purse-sigilCoin', 'art://purse-chestClosed']);
    for (const icon of icons) {
      // Art paints through the native <Image>: the geometry lands in style, not props
      const base = Array.isArray(icon.props.style) ? icon.props.style[0] : icon.props.style;
      expect(base.width).toBe(26);
      expect(base.height).toBe(26);
    }
  });

  it('PURSE-3 a tap anywhere turns the page to the Antechamber', async () => {
    const tree = await renderScreen();
    const root = findAll(tree.toJSON(), 'Pressable')[0];
    expect(root).toBeTruthy();
    const tap = vi.spyOn(audio, 'uiTap');
    await renderer.act(async () => { (root!.props.onPress as () => void)(); });
    expect(tap).toHaveBeenCalledOnce();
    expect(useUi.getState().screen).toBe('antechamber');
  });

  it('PURSE-4 the root is a button labelled with the tapToContinue copy', async () => {
    const tree = await renderScreen();
    const root = findAll(tree.toJSON(), 'Pressable')[0];
    expect(root!.props.accessibilityRole).toBe('button');
    expect(root!.props.accessibilityLabel).toBe(i18n.common.tapToContinue);
  });
});
