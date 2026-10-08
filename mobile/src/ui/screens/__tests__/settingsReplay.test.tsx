// SettingsScreen — the G13 replay entry, end to end.
//
// The settings screen is still the Phase A stub, but its one real row — the tutorial
// replay entry (G13) — is live UI, so it gets the full press-proof the pure law tests
// cannot give: render the screen, press the row, watch the real screen machine land
// in a clean tutorial duel. The Antechamber card routes through the SAME
// `tutorialReplayPayload` builder (its module-scope asset requires are Metro-only, so
// it cannot render under vitest — see replayEntry.test.ts for the split of proof).
//
//   SET-1  the row renders its copy from the dictionary, announced to access
//   SET-2  pressing it routes: tutorial mode, bumped nonce, no stale verdict
//   SET-3  it presses again — and again: the lesson is RE-playable, every entry
//          remounts a fresh duel (the G13 acceptance: "replay works")
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type React from 'react';
import { useUi } from '@/state/ui';
import { useSave } from '@/state/save';
import { storage, __resetStorageBackends } from '@/platform/storage';
import { i18n } from '@/i18n';
import SettingsScreen from '@/ui/screens/SettingsScreen';

// the full settings port (5.7) mounts the Ribbon and reads the safe-area insets —
// both Metro/native seams every other hub-screen test doubles (Cabinet,
// SeasonLedger, LedgerProfile). This file's assertions are untouched.
vi.mock('@/ui/Ribbon', async () => {
  const React = await import('react');
  const { View } = await import('react-native');
  return { default: () => React.createElement(View, null) };
});

vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

/** the store's own state type — UiStore itself is not exported */
type UiState = ReturnType<typeof useUi.getState>;

// eslint-disable-next-line @typescript-eslint/no-require-imports
const renderer = require('react-test-renderer') as typeof import('react-test-renderer');

type Node = { type: string; props: Record<string, unknown>; children?: (Node | string)[] };

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

async function renderScreen(): Promise<{ toJSON: () => unknown; unmount: () => void }> {
  let tree: ReturnType<typeof renderer.create> | null = null;
  await renderer.act(async () => {
    tree = renderer.create(<SettingsScreen />);
  });
  return tree as unknown as { toJSON: () => unknown; unmount: () => void };
}

beforeEach(async () => {
  // the full settings port reads the REAL save store and returns null until it is
  // loaded (the stub was a bare label; every other screen test loads the save)
  __resetStorageBackends();
  await storage.clearAll();
  await useSave.getState().load();
  // a dirty session that must survive nothing: mode/endless verdict, stale nonce
  useUi.setState({
    screen: 'settings',
    prev: 'antechamber',
    duelMode: 'endless',
    duelNonce: 7,
    lastResult: { winner: 1 } as unknown as UiState['lastResult'],
    serverDuel: { duelId: 'stale' } as unknown as UiState['serverDuel'],
  });
});

afterEach(async () => {
  useUi.setState({
    screen: 'boot', prev: null, duelMode: 'tutorial', duelNonce: 0,
    lastResult: null, serverDuel: null,
  });
});

describe('SettingsScreen · the G13 replay entry', () => {
  it('SET-1 renders the replay row from the dictionary (never a literal)', async () => {
    const tree = await renderScreen();
    const text = findAllText(tree.toJSON());
    expect(text).toContain(i18n.tutorial.relearn);
    const row = find(tree.toJSON(), i18n.tutorial.relearn);
    expect(row, 'the replay row must announce itself to access').toBeTruthy();
  });

  it('SET-2 pressing the row lands in a clean tutorial duel (mode, nonce, no verdict)', async () => {
    const tree = await renderScreen();
    const row = find(tree.toJSON(), i18n.tutorial.relearn)!;
    await renderer.act(async () => {
      await (row.props.onPress as () => void)();
    });
    const ui = useUi.getState();
    expect(ui.screen).toBe('tutorial');
    expect(ui.duelMode).toBe('tutorial');
    expect(ui.duelNonce).toBe(8); // 7 + 1 — the shell remounts DuelScreen fresh
    expect(ui.lastResult).toBeNull();
    expect(ui.serverDuel).toBeNull();
    expect(ui.prev).toBe('settings');
  });

  it('SET-3 it replays again after again — every entry bumps a fresh duel', async () => {
    const tree = await renderScreen();
    for (let i = 0; i < 3; i++) {
      const row = find(tree.toJSON(), i18n.tutorial.relearn)!;
      await renderer.act(async () => {
        await (row.props.onPress as () => void)();
      });
      expect(useUi.getState().screen).toBe('tutorial');
      expect(useUi.getState().duelNonce).toBe(8 + i);
      // re-enter the settings as a real player would between replays
      await renderer.act(async () => {
        useUi.setState({ screen: 'settings', prev: 'antechamber' });
      });
    }
  });
});
