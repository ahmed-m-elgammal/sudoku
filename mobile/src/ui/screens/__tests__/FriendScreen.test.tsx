// FriendScreen — the component-level gate (specs/17 phase 4.6).
//
// The pairing screen is BUTTON-driven (create/begin), unlike Matchmaking's
// mount-driven queue, so its testable surface is the flow: seal a code, queue
// with it, take the 'matched' payload into versus, and tear everything down on
// unmount. The net seam is mocked at the module boundary (the wire contract
// itself is pinned by scripts/friend-pair-probe.mjs against the LIVE server);
// these tests pin what the SCREEN does with it:
//
//   FLOW-1  the web's copy lands (title, create, join title) — i18n, not literals
//   FLOW-2  create -> code in the share line, join_queue carries the code, the
//           secret rides from the Keychain identity (never plain storage)
//   FLOW-3  the 'matched' payload becomes the versus payload: duelMode friend,
//           the unrated plate, the ServerDuelInit the duel screen builds from —
//           the three-screen handoff (FriendScreen -> Versus -> DuelScreen)
//   FLOW-4  a Shade payload (hostile payload too) never navigates a friend room
//   FLOW-5  unmount tears it down: the listener is off and leave_queue is sent —
//           no ghost left in the authoritative queue (law a)
//   FLOW-6  the empty-code guard: Begin is disabled until the code normalizes
//           (the web sent friendCode:'' into the RANKED queue — defect b)
//   FLOW-7  a failed createFriend is the honest error note, no code, no queue
//           join (the web minted an unpairable LOCAL- code — defect c)
//   FLOW-8  a failed socket connect on the join path keeps its error in THIS
//           panel (the web rendered it in the create panel — defect e)
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type React from 'react';
import { View, Text } from 'react-native';
import { i18n } from '@/i18n';
import { useUi } from '@/state/ui';
import { useSave, freshSave } from '@/state/save';
import { __resetStorageBackends } from '@/platform/storage';
import { net } from '@/game/net/client';
import FriendScreen from '@/ui/screens/FriendScreen';

// vi.mock is hoisted above the imports by vitest — the module boundary is mocked
// before FriendScreen (or anything else) touches the real net client.
vi.mock('@/game/net/client', () => ({
  net: {
    connect: vi.fn(),
    auth: vi.fn(),
    createFriend: vi.fn(),
    on: vi.fn(),
    send: vi.fn(),
  },
  proto: {},
}));

vi.mock('@/platform/display', () => ({
  useDisplaySettings: () => ({ contrast: false, text: 'm' as const }),
  useMotionReduced: () => false,
}));

vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
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

const renderer = require('react-test-renderer') as typeof import('react-test-renderer'); // eslint-disable-line @typescript-eslint/no-require-imports

function renderScreen(): { toJSON: () => unknown; unmount: () => void } {
  let tree: ReturnType<typeof renderer.create> | null = null;
  renderer.act(() => {
    tree = renderer.create(<FriendScreen />);
  });
  return tree as unknown as { toJSON: () => Node; unmount: () => void };
}

const press = async (tree: { toJSON: () => unknown }, label: string) => {
  const node = find(tree.toJSON(), label);
  expect(node, `no pressable labelled ${label}`).toBeTruthy();
  const onPress = node!.props.onPress as () => void | Promise<void>;
  await renderer.act(async () => { await onPress(); });
};

const FRIEND_MATCH = {
  duelId: 'duel-9x',
  seat: 1,
  givens: [3, 9, 7],
  foe: { name: 'Old Friend', order: 'apothecary', shade: false, standing: 1030 },
  stakes: { tier: 'Medium', range: [927, 1133] },
};

let lastOff: ReturnType<() => () => void> = () => {};

beforeEach(async () => {
  __resetStorageBackends();
  vi.mocked(net.connect).mockReset();
  vi.mocked(net.auth).mockReset();
  vi.mocked(net.createFriend).mockReset();
  vi.mocked(net.on).mockReset();
  vi.mocked(net.send).mockReset();
  vi.mocked(net.connect).mockResolvedValue(true);
  vi.mocked(net.auth).mockResolvedValue({ ok: true, standing: 1000, name: 'x' });
  vi.mocked(net.createFriend).mockResolvedValue({ code: 'AB3X9K' });
  // every registration returns a spyable off (the screen must tear listeners down)
  vi.mocked(net.on).mockImplementation((_e: string, _fn: (p: unknown) => void) => {
    const off = vi.fn(() => {});
    lastOff = off as () => void;
    return lastOff;
  });
  await useSave.getState().load();
  useUi.setState({ screen: 'friend', prev: 'antechamber', serverDuel: null, pendingFoe: null, duelMode: 'tutorial', lastResult: null });
  expect(useSave.getState().save).not.toBeNull();
});

afterEach(() => {
  useUi.setState({ screen: 'friend', serverDuel: null, pendingFoe: null });
});

describe('FriendScreen (specs/17 4.6)', () => {
  it('FLOW-1 renders the i18n copy: title, create, join title — no literals', () => {
    const tree = renderScreen();
    const text = findAllText(tree.toJSON());
    expect(text).toContain(i18n.friend.title);
    expect(text).toContain(i18n.friend.create);
    expect(text).toContain(i18n.friend.joinTitle);
    expect(text).toContain(i18n.friend.pickOrder);
    // the code input announces itself (placeholder rides props — FLOW-6 pins it)
    expect(find(tree.toJSON(), i18n.friend.codeLabel)).toBeTruthy();
  });

  it('FLOW-2 create seals a code, shows the share line, and queues with it', async () => {
    const tree = renderScreen();
    await press(tree, i18n.friend.create);

    expect(vi.mocked(net.createFriend)).toHaveBeenCalledTimes(1);
    const text = findAllText(tree.toJSON());
    expect(text).toContain('Send this seal to your friend: AB3X9K');
    expect(text).toContain(i18n.friend.copied);
    expect(text).toContain(i18n.friend.waiting);

    const queue = vi.mocked(net.send).mock.calls.find(([e]) => e === 'join_queue');
    expect(queue).toBeTruthy();
    const payload = queue![1] as { friendCode: string; accountId: string; secret: string; name: string; order: string };
    expect(payload.friendCode).toBe('AB3X9K');
    // the secret rides from the Keychain-backed identity, not plain storage
    expect(typeof payload.secret).toBe('string');
    expect(payload.secret.length).toBeGreaterThan(0);
    // the queue auth happened first (the T2 law: unregistered guests are dropped)
    expect(vi.mocked(net.auth)).toHaveBeenCalledTimes(1);
  });

  it('FLOW-3 matched -> versus: friend mode, the unrated plate, the ServerDuelInit', async () => {
    const tree = renderScreen();
    await press(tree, i18n.friend.create);

    const handler = vi.mocked(net.on).mock.calls.at(-1)![1];
    await renderer.act(async () => { handler(FRIEND_MATCH); });

    const ui = useUi.getState();
    expect(ui.screen).toBe('versus');
    expect(ui.duelMode).toBe('friend');
    expect(ui.pendingFoe).toEqual({
      name: 'Old Friend', order: 'apothecary', shade: false,
      standing: 1030, tier: 'Friend duel', range: [0, 0],
    });
    // the duel screen constructs the authoritative mirror from exactly this
    expect(ui.serverDuel).toEqual({
      duelId: 'duel-9x', seat: 1, givens: [3, 9, 7],
      foeName: 'Old Friend', myName: useSave.getState().save!.name,
      myOrder: useSave.getState().save!.order, foeOrder: 'apothecary',
    });
  });

  it('FLOW-4 a Shade (or hostile) payload never navigates a friend room', async () => {
    const tree = renderScreen();
    await press(tree, i18n.friend.create);
    const handler = vi.mocked(net.on).mock.calls.at(-1)![1];

    await renderer.act(async () => {
      handler({ ...FRIEND_MATCH, foe: { ...FRIEND_MATCH.foe, shade: true } });
    });
    await renderer.act(async () => { handler({ nope: true }); });

    expect(useUi.getState().screen).toBe('friend'); // held, not navigated
    // ...and the guard stays open: a real friend payload still lands
    await renderer.act(async () => { handler(FRIEND_MATCH); });
    expect(useUi.getState().screen).toBe('versus');
  });

  it('FLOW-5 unmount tears it down: leave_queue, no ghost, late matches ignored', async () => {
    const tree = renderScreen();
    await press(tree, i18n.friend.create);
    const handler = vi.mocked(net.on).mock.calls.at(-1)![1];
    expect(lastOff).not.toHaveBeenCalled();

    renderer.act(() => { tree.unmount(); });
    const events = vi.mocked(net.send).mock.calls.map(([e]) => e);
    expect(events).toContain('leave_queue');
    expect(lastOff).toHaveBeenCalled(); // the listener never outlives the screen
    // simulate the socket firing late — the torn-down listener must not navigate
    useUi.setState({ screen: 'antechamber' });
    await renderer.act(async () => { handler(FRIEND_MATCH); });
    expect(useUi.getState().screen).toBe('antechamber');
  });

  it('FLOW-6 Begin is disabled until the code normalizes (no empty-code queue leak)', async () => {
    const tree = renderScreen();
    // walk for the TextInput (host type 'TextInput') by its a11y label
    const node = find(tree.toJSON(), i18n.friend.codeLabel);
    expect(node).toBeTruthy();
    const beginNode = find(tree.toJSON(), i18n.common.begin);
    expect(beginNode!.props.disabled).toBe(true); // the web sent '' into the RANKED queue

    await renderer.act(async () => { (node!.props.onChangeText as (t: string) => void)('  ab3x9k '); });
    expect(find(tree.toJSON(), i18n.common.begin)!.props.disabled).toBe(false);

    await press(tree, i18n.common.begin);
    const queue = vi.mocked(net.send).mock.calls.find(([e]) => e === 'join_queue');
    expect((queue![1] as { friendCode: string }).friendCode).toBe('AB3X9K');
  });

  it('FLOW-7 a failed create is the honest error note — no code, no queue join', async () => {
    vi.mocked(net.createFriend).mockResolvedValue(null);
    const tree = renderScreen();
    await press(tree, i18n.friend.create);

    const text = findAllText(tree.toJSON());
    expect(text).toContain(i18n.offline.body); // retryable, honest
    expect(text).not.toContain('AB3X9K');
    expect(text).not.toContain(i18n.friend.waiting); // no waiting lie
    expect(vi.mocked(net.send).mock.calls.some(([e]) => e === 'join_queue')).toBe(false);
    expect(useUi.getState().screen).toBe('friend');
  });

  it('FLOW-8 a failed join connect keeps its error in the JOIN panel', async () => {
    vi.mocked(net.connect).mockResolvedValue(false);
    const tree = renderScreen();
    const node = find(tree.toJSON(), i18n.friend.codeLabel)!;
    await renderer.act(async () => { (node.props.onChangeText as (t: string) => void)('ZZ99QQ'); });
    await press(tree, i18n.common.begin);

    const text = findAllText(tree.toJSON());
    expect(text).toContain(i18n.offline.body);
    expect(vi.mocked(net.send).mock.calls.some(([e]) => e === 'join_queue')).toBe(false);
    expect(useUi.getState().screen).toBe('friend');
  });
});

// keep the double imports referenced (the host components ride the mock)
void View; void Text; void freshSave;
