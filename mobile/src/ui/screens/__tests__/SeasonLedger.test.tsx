// SeasonLedger — the component-level gate (specs/17 phase 5.3).
//
// The ledger is art-free, so it renders under vitest with the RN host double
// against the REAL save store (MMKV double) — the full flow is provable here:
//
//   SEASON-1  the copy lands from the dictionary — title, timer, progress, all 30 tiers
//   SEASON-2  locked tiers read their cumulative cost and refuse; a funded tier claims
//   SEASON-3  the 5.3 done-when: a claim grants once — the second press is refused
//   SEASON-4  the three tracks: ink ×10, sigils ⌈n/4⌉, cosmetic moves nothing
//   SEASON-5  the Patron line tells the truth about the save's patron flag
//   SEASON-6  the Ribbon exits to the Cabinet (the wiring box of spec 17)
//
// The real Ribbon is Metro-only (module-scope SVG require), so the tests mount an
// honest double: the same four labels, wired to the real useUi().go — the routing
// this screen's wiring box rests on is still exercised end to end.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { i18n, tf } from '@/i18n';
import { useUi } from '@/state/ui';
import { useSave } from '@/state/save';
import { __resetStorageBackends, storage } from '@/platform/storage';
import SeasonLedger from '@/ui/screens/SeasonLedger';
import { cumulative } from '@/ui/screens/seasonLaw';

vi.mock('@/platform/display', () => ({
  useDisplaySettings: () => ({ contrast: false, text: 'm' as const }),
  useMotionReduced: () => false,
}));

vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

// the Ribbon double: same four tabs, real routing — see the header note.
vi.mock('@/ui/Ribbon', async () => {
  const React = await import('react');
  const { Pressable, Text, View } = await import('react-native');
  const { useUi } = await import('@/state/ui');
  const { audio } = await import('@/platform/audio');
  const TABS = [
    { id: 'antechamber', label: 'Duel' },
    { id: 'folioMap', label: 'Folios' },
    { id: 'cabinet', label: 'Cabinet' },
    { id: 'ledger', label: 'Ledger' },
  ] as const;
  const TestRibbon = () => {
    const go = useUi((s: { go: (s: 'antechamber' | 'folioMap' | 'cabinet' | 'ledger') => void }) => s.go);
    return React.createElement(
      View,
      null,
      TABS.map((t) =>
        React.createElement(
          Pressable,
          {
            key: t.id,
            accessibilityRole: 'button',
            accessibilityLabel: t.label,
            onPress: () => { audio.uiTap(); go(t.id); },
          },
          React.createElement(Text, null, t.label),
        ),
      ),
    );
  };
  return { default: TestRibbon };
});

type Props = Record<string, unknown>;
type Node = { type: string; props: Props; children?: (Node | string)[] };

function isNode(n: unknown): n is Node {
  return !!n && typeof n === 'object' && 'props' in (n as Node);
}

function find(tree: unknown, label: string): Node | null {
  if (!isNode(tree)) return null;
  if (tree.props?.accessibilityLabel === label) return tree;
  for (const c of tree.children ?? []) {
    const hit = find(c, label);
    if (hit) return hit;
  }
  return null;
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
    tree = renderer.create(<SeasonLedger />);
  });
  return tree as unknown as { toJSON: () => unknown; unmount: () => void };
}

const press = async (tree: { toJSON: () => unknown }, label: string) => {
  const node = find(tree.toJSON(), label);
  expect(node, `no pressable labelled ${label}`).toBeTruthy();
  const onPress = node!.props.onPress as () => void;
  await renderer.act(async () => { onPress(); });
};

let tick = 0;
beforeEach(async () => {
  __resetStorageBackends();
  // the wipe must reach the BACKEND, not just the probe — the MMKV double's store
  // survives a reset, and a leftover save would bleed the previous test's claims in
  await storage.clearAll();
  tick = 0;
  vi.spyOn(Date, 'now').mockImplementation(() => 1_700_000_000_000 + ++tick * 1000);
  await useSave.getState().load();
  useUi.setState({ screen: 'season', prev: 'antechamber', campaignDuel: null, duelMode: 'practice', lastResult: null });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('SeasonLedger (specs/17 5.3)', () => {
  it('SEASON-1 renders the dictionary copy: title, timer, progress, all 30 tiers', async () => {
    const tree = await renderScreen();
    const text = findAllText(tree.toJSON());
    expect(text).toContain(i18n.season.title);
    // a fresh season is 8 weeks out; 0 ink → 100 Season Ink to Tier 1
    expect(text).toContain(tf('season.timeLeft', { weeks: 8 }));
    expect(text).toContain(tf('season.progress', { ink: 100, next: 1 }));
    for (const t of i18n.season.tiers) expect(text).toContain(t.name);
    expect(text).toContain('30'); // the last tier's numeral
  });

  it('SEASON-2 locked tiers read their cumulative cost; a funded tier offers Claim', async () => {
    const tree = await renderScreen(); // ink 0 — nothing unlocked
    expect(findAllText(tree.toJSON())).toContain(`${cumulative(1)} ink`);
    expect(find(tree.toJSON(), `${i18n.season.claim}: Mended Quill`)).toBeNull();

    useSave.getState().update((s) => ({ ...s, season: { ...s.season, ink: 150 } }));
    const tree2 = await renderScreen();
    expect(find(tree2.toJSON(), `${i18n.season.claim}: Mended Quill`)).toBeTruthy();
    // tier 2 costs 300 — still locked, still reading its price
    expect(findAllText(tree2.toJSON())).toContain(`${cumulative(2)} ink`);
    expect(find(tree2.toJSON(), `${i18n.season.claim}: Ash Wax Seal`)).toBeNull();
  });

  it('SEASON-3 claiming grants once — the ledger law of phase 5.3', async () => {
    useSave.getState().update((s) => ({ ...s, season: { ...s.season, ink: 100 } }));
    const tree = await renderScreen();
    await press(tree, `${i18n.season.claim}: Mended Quill`);

    let save = useSave.getState().save!;
    expect(save.season.claimed).toEqual(['f1']);
    expect(save.economy.ink).toBe(10);
    expect(save.economy.pending).toHaveLength(1);
    expect(save.economy.pending[0]).toMatchObject({ duelId: 'season-f1', mode: 'season', delta: 10 });

    // the button now reads Claimed — a second press (even bypassing disabled) is refused
    expect(findAllText(tree.toJSON())).toContain(i18n.season.claimed);
    const again = find(tree.toJSON(), `${i18n.season.claimed}: Mended Quill`);
    expect(again).toBeTruthy();
    await renderer.act(async () => { (again!.props.onPress as () => void)(); });
    save = useSave.getState().save!;
    expect(save.economy.ink).toBe(10);
    expect(save.season.claimed).toEqual(['f1']);
  });

  it('SEASON-4 the three tracks: sigils by ⌈n/4⌉, cosmetics by nothing', async () => {
    useSave.getState().update((s) => ({ ...s, season: { ...s.season, ink: cumulative(5) } }));
    const tree = await renderScreen();
    await press(tree, `${i18n.season.claim}: Ink Bottle Sigil`); // tier 5 — sigils
    await press(tree, `${i18n.season.claim}: Ash Wax Seal`);     // tier 2 — cosmetic

    const save = useSave.getState().save!;
    expect(save.economy.sigils).toBe(2);   // ⌈5/4⌉
    expect(save.economy.ink).toBe(0);      // the cosmetic tier moved nothing
    expect(save.economy.pending).toHaveLength(0); // sigils/cosmetics ride no ledger entry
    expect(save.season.claimed).toEqual(['f5', 'f2']); // push order: sigil tier pressed first
  });

  it('SEASON-5 the Patron line follows the save', async () => {
    const tree = await renderScreen();
    expect(findAllText(tree.toJSON())).toContain(i18n.season.patronUnlock);

    useSave.getState().update((s) => ({ ...s, season: { ...s.season, patron: true } }));
    const tree2 = await renderScreen();
    expect(findAllText(tree2.toJSON())).toContain(i18n.season.patron);
  });

  it('SEASON-6 the Ribbon exits to the Cabinet', async () => {
    const tree = await renderScreen();
    await press(tree, 'Cabinet');
    expect(useUi.getState().screen).toBe('cabinet');
  });
});
