// P2.3 — the Magistrate speaks at the result (docs/STORY_HOLD_PLAN.md P2.3).
//
//   RES-VOICE-1  a campaign win shows the defeat lines verbatim.
//   RES-VOICE-2  a folio-completing third-duel win adds the folio card.
//   RES-VOICE-3  a campaign loss shows the challenge's opening line as dismissal.
//   RES-VOICE-4  daily (and keyless) results show none of it.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useUi } from '@/state/ui';
import { useSave } from '@/state/save';
import { __resetStorageBackends, storage } from '@/platform/storage';
import ResultScreen from '@/ui/screens/ResultScreen';

vi.mock('@/platform/display', () => ({
  useDisplaySettings: () => ({ contrast: false, text: 'm' as const }),
  useMotionReduced: () => false,
}));

// the lib ships Flow-typed syntax this toolchain cannot parse (the established
// screen-test pattern — see SettingsScreen.test.tsx).
vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

vi.mock('@/platform/audio', () => ({
  audio: { victory: vi.fn(), defeat: vi.fn(), draw: vi.fn() },
}));

// the setup double for react-native-svg has no default export, but this
// screen paints `<Svg>` (the Ledger spark) — same host-double law, plus default.
vi.mock('react-native-svg', async () => {
  const React = await import('react');
  const host = (name: string) => {
    const C = (props: Record<string, unknown>) => React.createElement(name, props);
    C.displayName = name;
    return C;
  };
  const Svg = host('Svg');
  return { __esModule: true, default: Svg, Svg, Polyline: host('Polyline') };
});

// the duel art registry require()s Metro-bundled raster twins, which the
// runner cannot parse (the cabinetArt/ledgerArt law — mock the seam, keep the uri).
vi.mock('@/ui/duel/duelAssets', () => ({
  artUriFor: () => 'art://ink-drop',
}));

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

const renderer = require('react-test-renderer') as typeof import('react-test-renderer'); // eslint-disable-line @typescript-eslint/no-require-imports

function renderScreen() {
  let tree: { toJSON: () => unknown } | null = null;
  renderer.act(() => {
    tree = renderer.create(<ResultScreen />);
  });
  // joined WITHOUT a separator: JSX splits one visual line into adjacent
  // string children, and any separator would break the visual text.
  return findAllText(tree!.toJSON()).join('');
}

const baseResult = {
  reason: 'seals',
  mode: 'campaign',
  claims: [3, 1] as [number, number],
  mistakes: [1, 2] as [number, number],
  abilities: [1, 0] as [number, number],
  timeMs: 60_000,
  sealTimeline: [] as [number, number, number][],
  ratingDelta: null,
  ink: 50,
  shadeDuel: false,
  reliquaryWon: false,
};

async function showCampaignResult(over: Record<string, unknown>) {
  await useSave.getState().load();
  useUi.setState({
    screen: 'result',
    duelMode: 'campaign',
    campaignDuel: { folio: 0, duel: 2 },
    lastResult: { ...baseResult, ...over } as typeof baseResult & { winner: 0 | 1 | 'draw' },
  });
}

beforeEach(async () => {
  __resetStorageBackends();
  await storage.clearAll();
  useSave.setState({ save: null, loaded: false, quarantinedAt: null });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ResultScreen magistrate voice (P2.3)', () => {
  it('RES-VOICE-1 a campaign win shows the defeat lines verbatim', async () => {
    await showCampaignResult({ winner: 0, campaignFolioKey: 'halbrecht' });
    const s = renderScreen();
    expect(s).toContain('A clean cut. I have not felt one in years.');
    expect(s).toContain('The folio is yours. My arm remembers it.');
  });

  it('RES-VOICE-2 a folio-completing third duel adds the folio card', async () => {
    await showCampaignResult({ winner: 0, campaignFolioKey: 'halbrecht' });
    const s = renderScreen();
    expect(s).toContain("The Headsman's yard is quiet");
  });

  it('RES-VOICE-3 a campaign loss shows the dismissal line', async () => {
    await showCampaignResult({ winner: 1, campaignFolioKey: 'halbrecht' });
    const s = renderScreen();
    expect(s).toContain('The block is sanded smooth, Clerk. I sanded it.');
    expect(s).not.toContain('A clean cut.');
  });

  it('RES-VOICE-4 daily results show none of it', async () => {
    await useSave.getState().load();
    useUi.setState({
      screen: 'result',
      duelMode: 'daily',
      campaignDuel: null,
      lastResult: { ...baseResult, winner: 0, mode: 'daily' },
    });
    const s = renderScreen();
    expect(s).not.toContain('A clean cut.');
    expect(s).not.toContain("The Headsman's yard");
    expect(s).not.toContain('The block is sanded smooth');
  });
});
