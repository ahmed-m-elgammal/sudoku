// LedgerProfile — the component-level gate (specs/17 phase 5.6).
//
// The ledger reads the REAL save store (MMKV double) and the REAL identity
// storage; the net seam is mocked at the module boundary (the wire itself is the
// server's business) and the art seam is mocked (Metro-only requires — the
// cabinetArt law). What the tests pin is what the SCREEN does:
//
//   LEDGER-1   the copy lands from the dictionary — title, the five section
//              headings, the stat labels, the Order rows (web literals included)
//   LEDGER-2   the header tells the truth about the save: name input mirrors
//              save.name, the rank line reads rankOfStanding, the T13 serverInk
//              audit line appears only on an ok+finite auth (hidden offline)
//   LEDGER-3   the spark polyline carries the law's exact points; the four
//              counters read the save
//   LEDGER-4   the win-rate bars read stats.byOrder (with the missing-Order
//              fallback) — width and label both
//   LEDGER-5   Marginalia: every dictionary entry renders; an earned one at full
//              opacity, the rest at the web's 0.45; 'endless-ten' has no art and
//              degrades without one (the web's broken <img>, ported honestly)
//   LEDGER-6   the last 20 pleas: W/L/D tinting, the Shade/Human tag, the empty
//              state; the cap is the law's
//   LEDGER-7   Amend writes the save AND the Keychain identity AND re-auths
//   LEDGER-8   "Write the code" mints a valid code, hashes it into the identity,
//              and re-auths carrying the recoveryHash (the 5.6 done-when's first
//              half); Copy hands the code to the clipboard
//   LEDGER-9   import save: the v:2 paste replaces the store (reliquary sound);
//              a hostile paste is refused fail-closed (error sound)
//   LEDGER-10  import code: a valid code restores the server-known Ink as MAX —
//              the done-when's "moves Ink to another device", both directions
//   LEDGER-11  the Ribbon exits to the Cabinet (the wiring box of spec 17)
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { i18n } from '@/i18n';
import { useUi } from '@/state/ui';
import { useSave, freshSave } from '@/state/save';
import { storage, __resetStorageBackends } from '@/platform/storage';
import { audio } from '@/platform/audio';
import { generateRecoveryCode } from '@/state/identity';
import { net } from '@/game/net/client';
import { exportText, clipboard } from '@/platform/clipboard';
import LedgerProfile from '@/ui/screens/LedgerProfile';
import { sparkPoints } from '@/ui/screens/ledgerLaw';

vi.mock('@/game/net/client', () => ({
  net: {
    auth: vi.fn(),
    recovery: vi.fn(),
    connect: vi.fn(),
    on: vi.fn(),
    send: vi.fn(),
  },
  proto: {},
}));

vi.mock('@/ui/screens/ledgerArt', () => ({
  // the honest double: mirrors the real seam's inventory — 'endless-ten' has no
  // art file, so the double degrades it identically ('' → no Image rendered)
  rankArt: (id: string) => `art://rank-${id}`,
  achievementArt: (id: string) => (id === 'endless-ten' ? '' : `art://achievement-${id}`),
  purseArt: (which: string) => `art://purse-${which}`,
}));

vi.mock('@/platform/clipboard', () => ({
  clipboard: { copy: vi.fn(async () => true), read: vi.fn(async () => '') },
  share: { available: vi.fn(async () => false), share: vi.fn(async () => {}), writeTextFile: vi.fn(async () => 'file:///cache/x') },
  exportText: vi.fn(async () => 'shared'),
}));

vi.mock('@/platform/display', () => ({
  useDisplaySettings: () => ({ contrast: false, text: 'm' as const }),
  useMotionReduced: () => false,
}));

vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

// the Ribbon double: same four tabs, real routing — see SeasonLedger's header note.
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
function findAll(tree: unknown, type: string, out: Node[] = []): Node[] {
  if (!isNode(tree)) return out;
  if (tree.type === type) out.push(tree);
  for (const c of tree.children ?? []) findAll(c, type, out);
  return out;
}
function findAllText(tree: unknown, out: string[] = []): string[] {
  if (!isNode(tree)) return out;
  for (const c of tree.children ?? []) {
    if (typeof c === 'string' || typeof c === 'number') out.push(String(c));
    else findAllText(c, out);
  }
  return out;
}
/** every leaf joined — for the composite lines (the audit line, `75%`, `vs Foe`). */
function textOf(tree: unknown): string {
  return findAllText(tree).join('');
}

const renderer = require('react-test-renderer') as typeof import('react-test-renderer'); // eslint-disable-line @typescript-eslint/no-require-imports

async function renderScreen(): Promise<{ toJSON: () => unknown; unmount: () => void }> {
  let tree: ReturnType<typeof renderer.create> | null = null;
  await renderer.act(async () => {
    tree = renderer.create(<LedgerProfile />);
  });
  return tree as unknown as { toJSON: () => unknown; unmount: () => void };
}

const press = async (tree: { toJSON: () => unknown }, label: string) => {
  const node = find(tree.toJSON(), label);
  expect(node, `no pressable labelled ${label}`).toBeTruthy();
  await renderer.act(async () => { (node!.props.onPress as () => void)(); });
};

const type = async (tree: { toJSON: () => unknown }, label: string, text: string) => {
  const node = find(tree.toJSON(), label);
  expect(node, `no input labelled ${label}`).toBeTruthy();
  await renderer.act(async () => { (node!.props.onChangeText as (t: string) => void)(text); });
};

const flush = async () => {
  await renderer.act(async () => { await Promise.resolve(); });
};

let tick = 0;
beforeEach(async () => {
  __resetStorageBackends();
  await storage.clearAll();
  tick = 0;
  vi.spyOn(Date, 'now').mockImplementation(() => 1_700_000_000_000 + ++tick * 1000);
  vi.mocked(net.auth).mockReset();
  vi.mocked(net.recovery).mockReset();
  vi.mocked(net.auth).mockResolvedValue(null);
  await useSave.getState().load();
  useUi.setState({ screen: 'ledger', prev: 'antechamber' });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('LedgerProfile (specs/17 5.6)', () => {
  it('LEDGER-1 the dictionary copy lands: title, sections, stats, Order rows', async () => {
    const tree = await renderScreen();
    const text = findAllText(tree.toJSON());
    expect(text).toContain(i18n.ledger.title);
    expect(text).toContain(i18n.ledger.standingGraph);
    expect(text).toContain(i18n.ledger.winRate);
    expect(text).toContain(i18n.ledger.achievements);
    expect(text).toContain(i18n.ledger.recent);
    expect(text).toContain(i18n.ledger.recovery);
    expect(text).toContain(i18n.ledger.recoveryBody);
    expect(text).toContain(i18n.ledger.duels);
    expect(text).toContain(i18n.ledger.wins);
    expect(text).toContain(i18n.ledger.losses);
    expect(text).toContain(i18n.ledger.streak);
    // the web's raw Order keys (textTransform capitalizes at render time)
    for (const o of ['scholar', 'executioner', 'apothecary', 'warden']) expect(text).toContain(o);
  });

  it('LEDGER-2 the header mirrors the save; the T13 audit line appears only on ok+finite', async () => {
    // offline first: auth unresolved → no audit line
    let tree = await renderScreen();
    expect(findAllText(tree.toJSON()).join(' ')).not.toContain(i18n.ledger.serverInk);
    tree.unmount();

    // a finite server ink → the line lands (composed of nested Text leaves)
    vi.mocked(net.auth).mockResolvedValue({ ok: true, standing: 1000, name: 'x', ink: 555 });
    tree = await renderScreen();
    await flush();
    expect(textOf(tree.toJSON())).toContain(`${i18n.ledger.serverInk} 555 ink`);
    tree.unmount();

    // a non-finite ink is refused by the audit guard
    vi.mocked(net.auth).mockResolvedValue({ ok: true, standing: 1000, name: 'x', ink: Number.NaN });
    tree = await renderScreen();
    await flush();
    expect(findAllText(tree.toJSON()).join(' ')).not.toContain(i18n.ledger.serverInk);
    tree.unmount();

    // the name input mirrors save.name; the rank line reads rankOfStanding
    tree = await renderScreen();
    const nameInput = find(tree.toJSON(), i18n.ledger.nameEdit);
    expect(nameInput!.props.value).toBe(useSave.getState().save!.name);
    expect(nameInput!.props.maxLength).toBe(24);
    // the rank line is a composite of nested leaves
    expect(textOf(tree.toJSON())).toContain('Scrivener · Third Division · Standing 1000');
  });

  it('LEDGER-3 the spark carries the law\'s points; the counters read the save', async () => {
    useSave.getState().update((s) => ({
      ...s,
      stats: { ...s.stats, duels: 7, wins: 4, losses: 2, longestStreak: 3, standingHistory: [1000, 1040, 990, 1080] },
    }));
    const tree = await renderScreen();
    const polys = findAll(tree.toJSON(), 'Polyline');
    expect(polys).toHaveLength(1);
    expect(polys[0].props.points).toBe(sparkPoints([1000, 1040, 990, 1080]));
    expect(polys[0].props.stroke).toBeDefined();
    const text = findAllText(tree.toJSON());
    expect(text).toContain('7');
    expect(text).toContain('3');
  });

  it('LEDGER-4 the win-rate bars read stats.byOrder', async () => {
    useSave.getState().update((s) => ({
      ...s,
      stats: { ...s.stats, byOrder: { scholar: { w: 3, l: 1 }, executioner: { w: 0, l: 2 } } },
    }));
    const tree = await renderScreen();
    const text = findAllText(tree.toJSON());
    expect(text).toContain('75');  // 3/(3+1), rendered as `75%`
    expect(textOf(tree.toJSON())).toContain('75%');
    expect(textOf(tree.toJSON())).toContain('0%');   // apothecary/warden missing → fallback; executioner 0/2
  });

  it('LEDGER-5 Marginalia: earned at full opacity, the rest dimmed, endless-ten artless', async () => {
    useSave.getState().update((s) => ({ ...s, achievements: { 'first-blood': 1 } }));
    const tree = await renderScreen();
    const text = findAllText(tree.toJSON());
    // every dictionary entry's title renders
    for (const [, a] of Object.entries(i18n.achievements)) expect(text).toContain(a.title);
    // cells: one Image per entry with art, none for 'endless-ten'
    const icons = findAll(tree.toJSON(), 'Image').filter((n) => String((n.props.source as { uri: string } | undefined)?.uri).startsWith('art://achievement-'));
    expect(icons).toHaveLength(Object.keys(i18n.achievements).length - 1);
    const uris = icons.map((n) => String((n.props.source as { uri: string } | undefined)?.uri));
    expect(uris).toContain('art://achievement-first-blood');
    expect(uris).not.toContain('art://achievement-endless-ten');
  });

  it('LEDGER-6 the recent pleas: tint labels, Shade tag, and the honest empty state', async () => {
    let tree = await renderScreen();
    expect(findAllText(tree.toJSON())).toContain(i18n.common.empty);
    tree.unmount();

    useSave.getState().update((s) => ({
      ...s,
      stats: {
        ...s.stats,
        recent: [
          { t: 1, mode: 'ranked', result: 'w', foe: 'Sallow Bell 12', shade: false, order: 'scholar' },
          { t: 2, mode: 'ranked', result: 'l', foe: 'Gaunt Notary 4821', shade: true, order: 'warden' },
        ],
      },
    }));
    tree = await renderScreen();
    const joined = textOf(tree.toJSON());
    const text = findAllText(tree.toJSON());
    expect(joined).toContain('W');
    expect(joined).toContain('L');
    expect(joined).toContain('vs Sallow Bell 12');
    expect(joined).toContain('vs Gaunt Notary 4821');
    expect(text).toContain(i18n.ledger.shadeTag);
    expect(text).toContain(i18n.ledger.humanTag);
  });

  it('LEDGER-7 Amend writes the save, the identity, and re-auths under the new name', async () => {
    const tree = await renderScreen();
    await type(tree, i18n.ledger.nameEdit, 'Wry Lantern 7734');
    await press(tree, i18n.ledger.rename);
    await flush();

    expect(useSave.getState().save!.name).toBe('Wry Lantern 7734');
    const identity = await storage.get<{ name: string }>('identity', 'me');
    expect(identity!.name).toBe('Wry Lantern 7734');
    expect(net.auth).toHaveBeenCalledWith(expect.objectContaining({ name: 'Wry Lantern 7734' }));
  });

  it('LEDGER-8 "Write the code" mints a valid code into the identity and re-auths; Copy hands it over', async () => {
    const tree = await renderScreen();
    await press(tree, i18n.ledger.recoveryShow);
    await flush(); await flush();

    // the code renders and verifies against the recovery law
    const identity = await storage.get<{ recoveryHash: string | null }>('identity', 'me');
    expect(identity!.recoveryHash).toBeTruthy();
    expect(net.auth).toHaveBeenCalledWith(expect.objectContaining({ recoveryHash: identity!.recoveryHash }));

    // Copy rides the clipboard seam
    const codeNode = findAll(tree.toJSON(), 'Text').find((n) => n.children?.every((c) => typeof c === 'string') && String(n.children?.[0]).split('-').length === 5);
    expect(codeNode).toBeTruthy();
    await press(tree, i18n.ledger.recoveryCopy);
    expect(clipboard.copy).toHaveBeenCalled();

    // Export save: the pretty-printed payload rides the share seam under the web's name
    const save = useSave.getState().save!;
    await press(tree, i18n.ledger.export);
    expect(exportText).toHaveBeenCalledWith('assize-save.json', JSON.stringify(save, null, 2), 'application/json');
  });

  it('LEDGER-9 import save: a v:2 paste replaces the store; a hostile paste is refused', async () => {
    const reliquary = vi.spyOn(audio, 'reliquary');
    const error = vi.spyOn(audio, 'error');

    const tree = await renderScreen();
    const payload = JSON.stringify({ ...freshSave('Sallow Bell 1000'), economy: { ...freshSave('x').economy, ink: 777 } });
    await type(tree, i18n.ledger.import, payload);
    await press(tree, `${i18n.ledger.import}: ${i18n.ledger.export}`);
    expect(useSave.getState().save!.economy.ink).toBe(777);
    expect(useSave.getState().save!.name).toBe('Sallow Bell 1000');
    expect(reliquary).toHaveBeenCalled();

    // hostile paste: refused fail-closed, the save untouched
    reliquary.mockClear(); error.mockClear();
    const inkBefore = useSave.getState().save!.economy.ink;
    await type(tree, i18n.ledger.import, '{"v":1}');
    await press(tree, `${i18n.ledger.import}: ${i18n.ledger.export}`);
    expect(useSave.getState().save!.economy.ink).toBe(inkBefore);
    expect(error).toHaveBeenCalled();
    expect(reliquary).not.toHaveBeenCalled();
  });

  it('LEDGER-10 import code: the server-known Ink restores as MAX — both directions', async () => {
    // the server knows 500, the local purse is empty → 500
    vi.mocked(net.recovery).mockResolvedValue({ ok: true, standing: 1000, ink: 500 });
    let tree = await renderScreen();
    const code = generateRecoveryCode();
    await type(tree, 'Recovery code', code);
    await press(tree, `${i18n.ledger.import}: ${i18n.ledger.recovery}`);
    await flush();
    expect(useSave.getState().save!.economy.ink).toBe(500);

    // un-synced local Ink the server never heard about wins
    useSave.getState().update((s) => ({ ...s, economy: { ...s.economy, ink: 900 } }));
    tree.unmount();
    tree = await renderScreen();
    await type(tree, 'Recovery code', generateRecoveryCode());
    await press(tree, `${i18n.ledger.import}: ${i18n.ledger.recovery}`);
    await flush();
    expect(useSave.getState().save!.economy.ink).toBe(900);
  });

  it('LEDGER-11 the Ribbon exits to the Cabinet', async () => {
    const tree = await renderScreen();
    await press(tree, 'Cabinet');
    expect(useUi.getState().screen).toBe('cabinet');
  });
});
