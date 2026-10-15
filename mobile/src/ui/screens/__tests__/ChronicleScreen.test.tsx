// P2.4 — the Chronicle screen (docs/STORY_HOLD_PLAN.md P2.4).
//
//   CHRON-S1  a fresh save shows all-locked rows and no canon lines.
//   CHRON-S2  reached beats render title + verbatim lines; unreached stay sealed.
//   CHRON-S3  locked reveal/ending rows never spoil the plot.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useSave } from '@/state/save';
import { __resetStorageBackends, storage } from '@/platform/storage';
import { i18n } from '@/i18n';
import ChronicleScreen from '@/ui/screens/ChronicleScreen';

vi.mock('@/platform/display', () => ({
  useDisplaySettings: () => ({ contrast: false, text: 'm' as const }),
  useMotionReduced: () => false,
}));

// the lib ships Flow-typed syntax this toolchain cannot parse (the established
// screen-test pattern — see SettingsScreen.test.tsx).
vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

// the plates registry require()s Metro-bundled .webp twins, which the runner
// cannot parse (same law as the SvgUri ban): degrade to the unmapped frame,
// exactly the StoryCard law for an unmapped plate path.
vi.mock('@/theme/assets', () => ({
  imageForPath: () => null,
}));

// the Ribbon's tab-ribbon.png require() is Metro-only (the SettingsScreen law).
vi.mock('@/ui/Ribbon', () => ({ default: () => null }));

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

// joined WITHOUT a separator: JSX splits one visual line into adjacent string
// children ("Sealed" + " —"), and any separator would break the visual text.
function renderText() {
  let tree: { toJSON: () => unknown } | null = null;
  renderer.act(() => {
    tree = renderer.create(<ChronicleScreen />);
  });
  return findAllText(tree!.toJSON()).join('');
}

async function seedSeen(seen: string[]) {
  await useSave.getState().load();
  useSave.getState().update((cur) => ({
    ...cur,
    campaign: { ...cur.campaign, chronicleSeen: seen },
  }));
}

beforeEach(async () => {
  __resetStorageBackends();
  await storage.clearAll();
  useSave.setState({ save: null, loaded: false, quarantinedAt: null });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ChronicleScreen (P2.4)', () => {
  it('CHRON-S1 a fresh save shows all-locked rows and no canon lines', async () => {
    await useSave.getState().load();
    const s = renderText();
    expect(s).toContain(i18n.duel.chronicle.title);
    expect(s).toContain(`${i18n.duel.chronicle.sealed} —`);
    expect(s).not.toContain('They say the plague came from the river');
    expect(s).not.toContain('The Ninth Seal lifts its mask');
  });

  it('CHRON-S2 reached beats render verbatim; the rest stay sealed', async () => {
    await seedSeen(['prologue', 'folio:halbrecht']);
    const s = renderText();
    expect(s).toContain('They say the plague came from the river');
    expect(s).toContain("The Headsman's yard is quiet");
    expect(s).not.toContain('The Ninth Seal lifts its mask');
    expect(s).toContain(`${i18n.duel.chronicle.sealed} —`);
  });

  it('CHRON-S3 locked reveal/ending rows never spoil the plot', async () => {
    await seedSeen(['prologue']);
    const s = renderText();
    expect(s).not.toContain('I forged the Ledger to strike your name');
    expect(s).not.toContain('They hanged a body shaped like me');
    // (folio IX's map-public title legitimately names the Ninth — titles on the
    // FolioMap are public; the reveal LINES stay sealed)
  });
});
