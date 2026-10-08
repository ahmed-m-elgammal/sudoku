// CabinetScreen — the component-level gate (specs/17 phase 5.4).
//
// The screen imports its preview art through cabinetArt.ts (the Metro-only seam);
// the tests mock THAT SEAM so the real screen component renders under vitest with
// the RN host double against the REAL save store (MMKV double):
//
//   CAB-1  the boards tab lands with the dictionary title, the purse, and the
//          web's exact per-item states (starter equipped, prices in Ink/Sigils)
//   CAB-2  all six tabs carry the web's items and counts
//   CAB-3  buy with Ink: the preview's Buy spends it, joins owned, and files the
//          T13 spend entry (mode 'spend', negative delta)
//   CAB-4  a light purse: the error sound, nothing moves, the preview still closes
//   CAB-5  buy with Sigils: the purse spends, no ledger entry (the web's own paths)
//   CAB-6  equip persists — across an app restart, the 5.4 done-when
//   CAB-7  an equipped item is disabled and refuses a second equip
//   CAB-8  the Patron's Pouch stays the TODO(T5) stub, honestly
//   CAB-9  Close dismisses the preview without buying
//
// The real Ribbon is Metro-only, so the tests mount an honest double (see
// SeasonLedger.test.tsx) — same four labels, real useUi().go.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Alert } from 'react-native';
import { i18n } from '@/i18n';
import { useUi } from '@/state/ui';
import { useSave } from '@/state/save';
import { __resetStorageBackends, storage } from '@/platform/storage';
import { audio } from '@/platform/audio';
import CabinetScreen from '@/ui/screens/CabinetScreen';

vi.mock('@/ui/screens/cabinetArt', () => ({
  cabinetArtUri: vi.fn(() => ''),
}));

vi.mock('@/platform/display', () => ({
  useDisplaySettings: () => ({ contrast: false, text: 'm' as const }),
  useMotionReduced: () => false,
}));

vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

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
    tree = renderer.create(<CabinetScreen />);
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
  // survives a reset, and a leftover save would bleed the previous test's purse in
  await storage.clearAll();
  tick = 0;
  vi.spyOn(Date, 'now').mockImplementation(() => 1_700_000_000_000 + ++tick * 1000);
  vi.mocked(Alert.alert).mockClear();
  await useSave.getState().load();
  useUi.setState({ screen: 'cabinet', prev: 'antechamber', campaignDuel: null, duelMode: 'practice', lastResult: null });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('CabinetScreen (specs/17 5.4)', () => {
  it('CAB-1 the boards tab: title, purse, and the web\'s exact per-item states', async () => {
    useSave.getState().update((s) => ({ ...s, economy: { ...s.economy, ink: 123, sigils: 45 } }));
    const tree = await renderScreen();
    const text = findAllText(tree.toJSON());
    expect(text).toContain(i18n.cabinet.title);
    expect(text).toContain('123');
    expect(text).toContain('45');
    for (const label of Object.values(i18n.cabinet.tabs)) expect(text).toContain(label);
    // the starter board rides equipped; the shop items read their prices
    expect(find(tree.toJSON(), `${i18n.common.equipped}: Aged Vellum`)).toBeTruthy();
    expect(text).toContain('400 Ink');
    expect(text).toContain('700 Ink');
    expect(text).toContain('40 Sigils');
    expect(text).toContain(i18n.cabinet.patronNote);
  });

  it('CAB-2 all six tabs carry the web\'s items and counts', async () => {
    const tree = await renderScreen();

    await press(tree, i18n.cabinet.tabs.seals);
    const seals = findAllText(tree.toJSON());
    for (const name of ['Oxblood', 'Black', 'Verdigris', 'Gilt', 'Ash']) expect(seals).toContain(name);
    expect(find(tree.toJSON(), `${i18n.common.equipped}: Oxblood`)).toBeTruthy();

    await press(tree, i18n.cabinet.tabs.frames);
    const frames = findAllText(tree.toJSON());
    for (const name of ['Bronze Frame', 'Iron Frame', 'Bone-inlay Frame', 'Black-lacquer Frame']) {
      expect(frames).toContain(name);
    }

    await press(tree, i18n.cabinet.tabs.numerals);
    const numerals = findAllText(tree.toJSON());
    for (const name of ['Linocut Numerals', 'Court Caslon', 'Gothic Numerals']) expect(numerals).toContain(name);

    await press(tree, i18n.cabinet.tabs.stamps);
    const stamps = findAllText(tree.toJSON());
    for (const name of ['Fleur-de-lis', 'Laurel', 'Crown', 'Tower', 'Scales']) expect(stamps).toContain(name);
    expect(stamps).toContain('15 Sigils');

    await press(tree, i18n.cabinet.tabs.banners);
    const banners = findAllText(tree.toJSON());
    for (const name of ['Plain Verdict', 'Rubric Verdict', 'The Ninth Banner']) expect(banners).toContain(name);
    expect(find(tree.toJSON(), `${i18n.common.equipped}: Plain Verdict`)).toBeTruthy();
  });

  it('CAB-3 buy with Ink: spends, joins owned, files the T13 spend entry', async () => {
    useSave.getState().update((s) => ({ ...s, economy: { ...s.economy, ink: 400 } }));
    const tree = await renderScreen();

    await press(tree, `400 Ink: Bone`); // the price button opens the preview
    expect(find(tree.toJSON(), `${i18n.common.buy}: Bone`)).toBeTruthy(); // the panel is open
    expect(findAllText(tree.toJSON())).toContain('Scraped white, cold to the touch.');
    expect(findAllText(tree.toJSON())).toContain('400 Ink');

    await press(tree, `${i18n.common.buy}: Bone`);
    const save = useSave.getState().save!;
    expect(save.economy.ink).toBe(0);
    expect(save.cosmetics.owned).toContain('board-bone');
    const spend = save.economy.pending.find((p) => p.mode === 'spend');
    expect(spend).toBeTruthy();
    expect(spend!.delta).toBe(-400);
    expect(spend!.duelId.startsWith('spend-board-bone-')).toBe(true);
    // the preview closed and the item now offers Equip
    expect(find(tree.toJSON(), `${i18n.common.buy}: Bone`)).toBeNull();
    expect(find(tree.toJSON(), `${i18n.common.equip}: Bone`)).toBeTruthy();
  });

  it('CAB-4 a light purse: the error sound, nothing moves, the preview still closes', async () => {
    const errSpy = vi.spyOn(audio, 'error');
    const relSpy = vi.spyOn(audio, 'reliquary');
    useSave.getState().update((s) => ({ ...s, economy: { ...s.economy, ink: 399 } }));
    const tree = await renderScreen();

    await press(tree, `400 Ink: Bone`);
    await press(tree, `${i18n.common.buy}: Bone`);

    const save = useSave.getState().save!;
    expect(save.economy.ink).toBe(399);
    expect(save.cosmetics.owned).not.toContain('board-bone');
    expect(save.economy.pending).toHaveLength(0);
    expect(errSpy).toHaveBeenCalledTimes(1);
    expect(relSpy).not.toHaveBeenCalled();
    expect(find(tree.toJSON(), `${i18n.common.buy}: Bone`)).toBeNull(); // closed regardless
  });

  it('CAB-5 buy with Sigils: the purse spends, no ledger entry', async () => {
    const relSpy = vi.spyOn(audio, 'reliquary');
    useSave.getState().update((s) => ({ ...s, economy: { ...s.economy, sigils: 40 } }));
    const tree = await renderScreen();

    await press(tree, `40 Sigils: Cathedral Rubric`);
    await press(tree, `${i18n.common.buy}: Cathedral Rubric`);

    const save = useSave.getState().save!;
    expect(save.economy.sigils).toBe(0);
    expect(save.cosmetics.owned).toContain('board-cathedral');
    expect(save.economy.pending).toHaveLength(0); // the Sigil path records no entry
    expect(relSpy).toHaveBeenCalled();
  });

  it('CAB-6 equip persists — across an app restart (the 5.4 done-when)', async () => {
    useSave.getState().update((s) => ({
      ...s,
      cosmetics: { ...s.cosmetics, owned: [...s.cosmetics.owned, 'board-bone'] },
    }));
    const tree = await renderScreen();

    await press(tree, `${i18n.common.equip}: Bone`);
    expect(useSave.getState().save!.cosmetics.equipped.board).toBe('board-bone');
    expect(find(tree.toJSON(), `${i18n.common.equipped}: Bone`)).toBeTruthy();
    expect(find(tree.toJSON(), `${i18n.common.equip}: Aged Vellum`)).toBeTruthy(); // dethroned

    // the restart: a cold read comes back from the store with the equip intact
    __resetStorageBackends();
    useSave.setState({ save: null, loaded: false });
    await useSave.getState().load();
    expect(useSave.getState().save!.cosmetics.equipped.board).toBe('board-bone');
  });

  it('CAB-7 an equipped item is disabled and refuses a second equip', async () => {
    const tree = await renderScreen();
    const node = find(tree.toJSON(), `${i18n.common.equipped}: Aged Vellum`);
    expect(node).toBeTruthy();
    await renderer.act(async () => { (node!.props.onPress as () => void)(); });
    expect(useSave.getState().save!.cosmetics.equipped.board).toBe('board-aged-vellum');
  });

  it('CAB-8 the Patron\'s Pouch stays the TODO(T5) stub, honestly', async () => {
    const tree = await renderScreen();
    await press(tree, 'Patron’s Pouch — 80 / 300 / 1000 Sigils');
    expect(vi.mocked(Alert.alert)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(Alert.alert)).toHaveBeenCalledWith('TODO(T5): payments are stubbed in this build. See /TODO.md.');
  });

  it('CAB-9 Close dismisses the preview without buying', async () => {
    const tree = await renderScreen();
    await press(tree, `400 Ink: Bone`);
    expect(find(tree.toJSON(), `${i18n.common.buy}: Bone`)).toBeTruthy();
    await press(tree, i18n.common.close);
    expect(find(tree.toJSON(), `${i18n.common.buy}: Bone`)).toBeNull();
    expect(useSave.getState().save!.cosmetics.owned).not.toContain('board-bone');
  });
});
