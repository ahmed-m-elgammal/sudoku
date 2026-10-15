// P2.5 — the Clerk's Lexicon (docs/STORY_HOLD_PLAN.md P2.5).
//
//   LEX-S1  the screen renders all five sections with entries.
//   LEX-S2  a rite entry shows its fiction name and true cooldown value.
//   LEX-S3  a status entry shows its suffered duration.
//   LEX-S4  the pause sheet offers the Lexicon and hands it a tap.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useSave } from '@/state/save';
import { __resetStorageBackends, storage } from '@/platform/storage';
import { themeFor } from '@/theme/tokens';
import { i18n } from '@/i18n';
import LexiconScreen from '@/ui/screens/LexiconScreen';
import { PauseModal } from '@/ui/duel/Modals';

vi.mock('@/platform/display', () => ({
  useDisplaySettings: () => ({ contrast: false, text: 'm' as const }),
  useMotionReduced: () => false,
}));

// the lib ships Flow-typed syntax this toolchain cannot parse (the established
// screen-test pattern — see SettingsScreen.test.tsx).
vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

// Metro-only binary requires (the cabinetArt/ledgerArt law — mock the seam).
vi.mock('@/theme/assets', () => ({
  imageForPath: () => null,
  images: {},
}));
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

function findByLabel(tree: unknown, label: string): Node | null {
  if (!isNode(tree)) return null;
  if ((tree.props as Record<string, unknown>).accessibilityLabel === label) return tree;
  for (const c of tree.children ?? []) {
    const hit = findByLabel(c, label);
    if (hit) return hit;
  }
  return null;
}

const renderer = require('react-test-renderer') as typeof import('react-test-renderer'); // eslint-disable-line @typescript-eslint/no-require-imports

function renderText(el: React.ReactElement): string {
  let tree: { toJSON: () => unknown } | null = null;
  renderer.act(() => {
    tree = renderer.create(el);
  });
  return findAllText(tree!.toJSON()).join('');
}

beforeEach(async () => {
  __resetStorageBackends();
  await storage.clearAll();
  useSave.setState({ save: null, loaded: false, quarantinedAt: null });
  await useSave.getState().load();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('LexiconScreen (P2.5)', () => {
  it('LEX-S1 all five sections render', () => {
    const s = renderText(<LexiconScreen />);
    for (const section of ['The Court', 'The Tablet', "The Foe's Arts", 'The Orders', 'The Ladder']) {
      expect(s).toContain(section);
    }
  });

  it('LEX-S2 a rite shows its fiction name and true cooldown', () => {
    const s = renderText(<LexiconScreen />);
    expect(s).toContain('Augur');
    expect(s).toContain('40 s');
    expect(s).toContain('Marginalia');
  });

  it('LEX-S3 a status shows its suffered duration', () => {
    const s = renderText(<LexiconScreen />);
    expect(s).toContain('Miasma');
    expect(s).toContain('10 s');
  });

  it('LEX-S4 the pause sheet offers the Lexicon and hands it a tap', () => {
    const onLexicon = vi.fn();
    let tree: { toJSON: () => unknown; root?: unknown } | null = null;
    renderer.act(() => {
      tree = renderer.create(
        <PauseModal
          theme={themeFor()}
          foeName="Halbrecht"
          onResume={() => {}}
          onConcede={() => {}}
          onLexicon={onLexicon}
        />,
      );
    });
    const btn = findByLabel(tree!.toJSON(), i18n.duel.lexicon.title);
    expect(btn, 'pause sheet must offer the Lexicon').not.toBeNull();
    renderer.act(() => {
      (btn!.props as Record<string, () => void>).onPress();
    });
    expect(onLexicon).toHaveBeenCalledTimes(1);
  });
});
