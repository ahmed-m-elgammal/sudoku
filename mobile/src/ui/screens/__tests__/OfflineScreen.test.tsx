// OfflineScreen — the component-level gate (specs/17 phase 5.8).
//
// The wire is the seam's business — the net client is mocked at the module
// boundary — but the RECOVERY LAW the screen owns is pinned end to end:
//
//   OFF-1    the plate renders its copy: the ASSIZE wordmark (the web's own
//            literal), the title, the body, the three offline buttons (the web's
//            own literals), and the retry footer while offline
//   OFF-2    the three buttons route the web's exact payloads — tutorial duel,
//            folio map, Shade-due matchmaking
//   OFF-3    the recovery law: connect fails on mount → the screen holds; the
//            8 s poll re-probes and a succeeded connect routes to the
//            Antechamber (the done-when: "fires on disconnect, recovers on
//            reconnect")
//   OFF-4    the poll is a real 8 s interval — the mount probe is NOT the
//            recovery path, the interval is (advance 7 s: nothing; 8 s: probe)
//
// REPORTED DEFECT (web, inherited — see the screen header): nothing routes to
// 'offline' in either build; these tests drive the screen directly, as the
// GameShell case would.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { i18n } from '@/i18n';
import { useUi } from '@/state/ui';
import { net } from '@/game/net/client';
import OfflineScreen from '@/ui/screens/OfflineScreen';

vi.mock('@/game/net/client', () => ({
  net: { connect: vi.fn() },
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

const renderer = require('react-test-renderer') as typeof import('react-test-renderer'); // eslint-disable-line @typescript-eslint/no-require-imports

async function renderScreen(): Promise<{ toJSON: () => unknown; unmount: () => void }> {
  let tree: ReturnType<typeof renderer.create> | null = null;
  await renderer.act(async () => {
    tree = renderer.create(<OfflineScreen />);
  });
  return tree as unknown as { toJSON: () => unknown; unmount: () => void };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.mocked(net.connect).mockReset();
  useUi.setState({ screen: 'offline', prev: null });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  useUi.setState({ screen: 'boot', prev: null });
});

describe('OfflineScreen (specs/17 5.8)', () => {
  it('OFF-1 renders the plate: wordmark, title, body, the three buttons, the retry footer', async () => {
    vi.mocked(net.connect).mockResolvedValue(false);
    const tree = await renderScreen();
    const text = findAllText(tree.toJSON());
    // the web's own literals carried verbatim
    expect(text).toContain('ASSIZE');
    expect(text).toContain('Tutorial');
    expect(text).toContain('Folios');
    expect(text).toContain('Shade duel');
    // the dictionary copy
    expect(text).toContain(i18n.offline.title);
    expect(text).toContain(i18n.offline.body);
    // offline footer: retry + the web's own trailing ellipsis (the host double
    // keeps them as separate text nodes; the web renders one joined string)
    expect(text).toContain(i18n.offline.retry);
    expect(text).toContain('…');
    expect(text).not.toContain(i18n.common.continue);
    // the three buttons announce themselves
    for (const label of ['Tutorial', 'Folios', 'Shade duel']) {
      expect(findAllLabelled(tree.toJSON(), 'Pressable', label)).toHaveLength(1);
    }
  });

  it("OFF-2 the three buttons route the web's exact payloads", async () => {
    vi.mocked(net.connect).mockResolvedValue(false);
    const tree = await renderScreen();
    const press = async (label: string) => {
      await renderer.act(async () => {
        (findAllLabelled(tree.toJSON(), 'Pressable', label)[0]!.props.onPress as () => void)();
      });
    };
    await press('Tutorial');
    expect(useUi.getState().screen).toBe('tutorial');
    expect(useUi.getState().duelMode).toBe('tutorial');

    useUi.setState({ screen: 'offline', prev: null });
    await press('Folios');
    expect(useUi.getState().screen).toBe('folioMap');

    useUi.setState({ screen: 'offline', prev: null });
    await press('Shade duel');
    expect(useUi.getState().screen).toBe('matchmaking');
    expect(useUi.getState().duelMode).toBe('shade');
  });

  it('OFF-3 holds while offline and recovers on reconnect (the done-when)', async () => {
    vi.mocked(net.connect).mockResolvedValue(false);
    const tree = await renderScreen();
    expect(useUi.getState().screen).toBe('offline');

    // the court reopens: the next probe succeeds and routes to the Antechamber
    vi.mocked(net.connect).mockResolvedValue(true);
    await renderer.act(async () => {
      await vi.advanceTimersByTimeAsync(8000);
    });
    expect(useUi.getState().screen).toBe('antechamber');
    tree.unmount();
  });

  it('OFF-4 the poll is a real 8 s interval — 7 s probes nothing', async () => {
    vi.mocked(net.connect).mockResolvedValue(false);
    const tree = await renderScreen();
    expect(net.connect).toHaveBeenCalledTimes(1); // the mount probe
    await renderer.act(async () => {
      await vi.advanceTimersByTimeAsync(7000);
    });
    expect(net.connect).toHaveBeenCalledTimes(1); // not yet
    await renderer.act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(net.connect).toHaveBeenCalledTimes(2); // the 8 s tick
    tree.unmount();
  });
});
