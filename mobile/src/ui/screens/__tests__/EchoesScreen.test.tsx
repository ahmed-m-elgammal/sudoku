// EchoesScreen — the component-level gate (specs/17 phase 5.1).
//
// The shelf has no module-scope asset requires, so it renders under vitest with the
// RN host double — the full flow is provable here against the REAL storage ring
// (expo-sqlite is forced onto its in-memory tier, exactly as echoes.test.ts does):
//
//   SHELF-1  the copy lands from the dictionary; a bare shelf says so honestly
//   SHELF-2  seeded echoes render their cards — the chit badge rides the row,
//            the count line counts, the describe line is the shared law's
//   SHADE-1  "Duel your Shade" navigates duelMode 'shade' with the newest echo's
//            replay + a mined profile (T17)
//   REPLAY-1 "Face this echo" navigates duelMode 'replay' with the SAME replay
//            the shelf stored — byte-identical data, campaignDuel cleared
//   CHIT-1   sealing a chit copies an ASSIZE1- code that carries NO names, and
//            the modal tells the truth about the clipboard (T19)
//   IMPORT-1 breaking a chit lands it on the shelf imported AND anonymous —
//            the two-way privacy pass, through the real ring
//   IMPORT-2 a forged chit is refused with the honest note; the shelf is unchanged
//   BACK-1   back returns to the Antechamber (the wiring box of spec 17)
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type React from 'react';
import { View, Text, TextInput } from 'react-native';
import { i18n } from '@/i18n';
import { useUi } from '@/state/ui';
import { useSave } from '@/state/save';
import { __resetStorageBackends } from '@/platform/storage';
import { clipboard } from '@/platform/clipboard';
import { saveEcho, type DuelReplay } from '@/game/echoes';
import { encodeEchoCode, REDACTED_CLERK, REDACTED_ECHO } from '@shared/echoShare';
import EchoesScreen from '@/ui/screens/EchoesScreen';

// hoisted above the imports by vitest. The screen renders against the REAL storage
// ring — expo-sqlite is forced onto its in-memory tier exactly as echoes.test.ts does.
vi.mock('expo-sqlite', () => ({
  openDatabaseAsync: vi.fn(async () => null),
}));

vi.mock('@/platform/display', () => ({
  useDisplaySettings: () => ({ contrast: false, text: 'm' as const }),
  useMotionReduced: () => false,
}));

vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

vi.mock('@/platform/clipboard', () => ({
  clipboard: {
    copy: vi.fn(async () => true),
    read: vi.fn(async () => ''),
  },
  share: { available: vi.fn(async () => false), share: vi.fn(), writeTextFile: vi.fn() },
  exportText: vi.fn(),
}));

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

/** the host double keeps a TextInput's payload in props, not children */
function findInputValue(tree: unknown, value: string): Node | null {
  if (!isNode(tree)) return null;
  if (tree.type === 'TextInput' && typeof tree.props?.value === 'string' && tree.props.value.includes(value)) return tree;
  for (const c of tree.children ?? []) {
    const hit = findInputValue(c, value);
    if (hit) return hit;
  }
  return null;
}

const renderer = require('react-test-renderer') as typeof import('react-test-renderer'); // eslint-disable-line @typescript-eslint/no-require-imports

async function renderScreen(): Promise<{ toJSON: () => unknown; unmount: () => void }> {
  let tree: ReturnType<typeof renderer.create> | null = null;
  await renderer.act(async () => {
    tree = renderer.create(<EchoesScreen />);
  });
  // let the shelf's refresh chain land (probe → storage → setState)
  await renderer.act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
  return tree as unknown as { toJSON: () => unknown; unmount: () => void };
}

const press = async (tree: { toJSON: () => unknown }, label: string) => {
  const node = find(tree.toJSON(), label);
  expect(node, `no pressable labelled ${label}`).toBeTruthy();
  const onPress = node!.props.onPress as () => void | Promise<void>;
  await renderer.act(async () => { await onPress(); });
};

const echo = (over: Partial<DuelReplay> = {}): DuelReplay => ({
  v: 1,
  seed: 'shelf-seed-001',
  tier: 'Hard',
  orders: ['scholar', 'executioner'],
  names: ['Ahmed', 'the Shade'],
  durationMs: 180_000,
  actions: [
    { t: 4_000, kind: 'place', cell: 10, digit: 2 },
    { t: 8_000, kind: 'place', cell: 11, digit: 9 },
    { t: 15_000, kind: 'ability', id: 'augur' },
    { t: 20_000, kind: 'place', cell: 12, digit: 4 },
    { t: 26_000, kind: 'place', cell: 13, digit: 6 },
    { t: 31_000, kind: 'place', cell: 14, digit: 8 },
    { t: 36_000, kind: 'place', cell: 15, digit: 1 },
    { t: 41_000, kind: 'place', cell: 16, digit: 3 },
    { t: 46_000, kind: 'place', cell: 17, digit: 5 },
    { t: 51_000, kind: 'place', cell: 18, digit: 7 },
  ],
  outcome: { winner: 0, reason: 'seals' },
  ...over,
});

let tick = 0;
beforeEach(async () => {
  __resetStorageBackends();
  tick = 0;
  vi.spyOn(Date, 'now').mockImplementation(() => 1_700_000_000_000 + ++tick * 1000);
  vi.mocked(clipboard.copy).mockClear();
  await useSave.getState().load();
  useUi.setState({
    screen: 'echoes', prev: 'antechamber',
    pendingEcho: null, pendingPersonalShade: null, campaignDuel: null,
    duelMode: 'practice', lastResult: null, serverDuel: null,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  useUi.setState({ pendingEcho: null, pendingPersonalShade: null });
});

describe('EchoesScreen (specs/17 5.1)', () => {
  it('SHELF-1 renders the dictionary copy; a bare shelf says so honestly', async () => {
    const tree = await renderScreen();
    const text = findAllText(tree.toJSON());
    expect(text).toContain(i18n.echoes.title);
    expect(text).toContain(i18n.echoes.sub);
    expect(text).toContain(i18n.echoes.empty);
    // '← ' and the copy are separate JSX children under the host double
    expect(text).toContain(i18n.echoes.back);
    expect(text).toContain(i18n.echoes.importChit);
  });

  it('SHELF-2 seeded echoes render as cards with the badge, count and describe line', async () => {
    await saveEcho(echo({ seed: 'a', names: ['Aldric', 'Foe One'] }));
    await saveEcho(echo({ seed: 'b', outcome: { winner: 1, reason: 'seals' } }), { imported: true });
    const tree = await renderScreen();
    const text = findAllText(tree.toJSON());
    expect(text).toContain('Shade of ');       // the web literal, its own child
    expect(text).toContain('Aldric');
    expect(text).toContain(i18n.echoes.chitBadge); // the imported row tells its tale
    expect(text).toContain(tf2('echoes.count', { n: 2 }));
    expect(text).toContain('Hard · 9 ink · won'); // describeEcho, the shared law
    expect(text).toContain('scholar');
    expect(text).toContain('executioner');
    expect(text).toContain(`${i18n.echoes.yourShadeTitle}`);
  });

  it('SHADE-1 Duel your Shade navigates duelMode shade with the newest echo + a mined profile', async () => {
    await saveEcho(echo({ seed: 'mine-me' }));
    const tree = await renderScreen();
    await press(tree, i18n.echoes.yourShadeDuel);

    const ui = useUi.getState();
    expect(ui.screen).toBe('duel');
    expect(ui.duelMode).toBe('shade');
    expect(ui.campaignDuel).toBeNull();
    expect(ui.pendingPersonalShade?.replay.seed).toBe('mine-me');
    const p = ui.pendingPersonalShade!.profile;
    // the mined profile is clamped and paced like a real player (the T17 law)
    expect(p.name).toBe('Shade of Ahmed');
    expect(Array.isArray(p.placeDelayMs)).toBe(true);
    expect(p.placeDelayMs[0]).toBeGreaterThanOrEqual(1500);
  });

  it('REPLAY-1 Face this echo navigates duelMode replay with the byte-identical stored replay', async () => {
    const stored = echo({ seed: 'byte-faithful', names: ['Aldric', 'Foe One'] });
    await saveEcho(stored);
    const tree = await renderScreen();
    await press(tree, `${i18n.echoes.duel}: Aldric`);

    const ui = useUi.getState();
    expect(ui.screen).toBe('duel');
    expect(ui.duelMode).toBe('replay');
    expect(ui.campaignDuel).toBeNull();
    // the runtime receives exactly what the shelf validated and stored
    expect(ui.pendingEcho).toEqual(stored);
  });

  it('CHIT-1 sealing a chit copies an ASSIZE1- code with no names inside', async () => {
    await saveEcho(echo({ names: ['Clerk Al-Subashi', 'Magistrate Vael'] }));
    const tree = await renderScreen();
    await press(tree, i18n.echoes.sealChit);

    expect(vi.mocked(clipboard.copy)).toHaveBeenCalledTimes(1);
    const code = vi.mocked(clipboard.copy).mock.calls[0][0] as string;
    expect(code.startsWith('ASSIZE1-')).toBe(true);
    expect(code).not.toContain('Al-Subashi');
    expect(code).not.toContain('Vael');

    // the modal tells the truth: sealed — on your clipboard, payload shown by hand
    const text = findAllText(tree.toJSON());
    expect(text).toContain(i18n.echoes.chitTitle);
    expect(text).toContain(i18n.echoes.chitBody);
    expect(text).toContain(i18n.echoes.copied);
    expect(findInputValue(tree.toJSON(), code)).toBeTruthy(); // the manual-copy fallback
  });

  it('IMPORT-1 a broken-open chit lands on the shelf imported AND anonymous', async () => {
    const code = encodeEchoCode(echo({ names: ['Clerk Al-Subashi', 'Magistrate Vael'] }))!;
    const tree = await renderScreen();

    await press(tree, i18n.echoes.importChit);
    const input = find(tree.toJSON(), i18n.echoes.importPlaceholder);
    expect(input).toBeTruthy();
    await renderer.act(async () => {
      (input!.props.onChangeText as (t: string) => void)(`  ${code}\n`);
    });
    await press(tree, i18n.echoes.importAction);
    // the success path CLOSES the sheet and refreshes the shelf beneath it —
    // the web build's own behaviour (the 'ok' note renders inside the closing modal,
    // so the refreshed shelf IS the acknowledgement)
    await renderer.act(async () => { await new Promise((r) => setTimeout(r, 0)); });

    const text = findAllText(tree.toJSON());
    expect(text).not.toContain(i18n.echoes.importTitle); // the sheet is gone
    expect(text).toContain(i18n.echoes.chitBadge);       // the new row tells its tale

    const ui = useUi.getState();
    expect(ui.screen).toBe('echoes'); // still here, the shelf refreshed beneath
    expect(ui.pendingEcho).toBeNull();
    const shelf = await (await import('@/game/echoes')).listEchoes();
    expect(shelf).toHaveLength(1);
    expect(shelf[0].imported).toBe(true);
    // THE PRIVACY PASS, second half: even an honest chit lands nameless
    expect(shelf[0].replay.names).toEqual([REDACTED_CLERK, REDACTED_ECHO]);
  });

  it('IMPORT-2 a forged chit is refused with the honest note and an unchanged shelf', async () => {
    const tree = await renderScreen();
    await press(tree, i18n.echoes.importChit);
    const input = find(tree.toJSON(), i18n.echoes.importPlaceholder)!;
    await renderer.act(async () => {
      (input.props.onChangeText as (t: string) => void)('ASSIZE1-forged-wax');
    });
    await press(tree, i18n.echoes.importAction);

    expect(findAllText(tree.toJSON())).toContain(i18n.echoes.importBad);
    const shelf = await (await import('@/game/echoes')).listEchoes();
    expect(shelf).toHaveLength(0);
    expect(useUi.getState().screen).toBe('echoes');
  });

  it('BACK-1 back returns to the Antechamber', async () => {
    const tree = await renderScreen();
    await press(tree, i18n.echoes.back);
    expect(useUi.getState().screen).toBe('antechamber');
  });
});

// tiny local tf so the test does not re-derive the substitution twice
function tf2(path: string, vars: Record<string, string | number>): string {
  const parts = path.split('.');
  let cur: unknown = i18n;
  for (const p of parts) cur = (cur as Record<string, unknown>)[p];
  return (cur as string).replace(/\{(\w+)\}/g, (_m, k: string) => String(vars[k]));
}

// keep the host doubles referenced (they ride the react-native mock)
void View; void Text; void TextInput;
