// SettingsScreen — the component-level gate (specs/17 phase 5.7).
//
// The screen reads the REAL save store (the MMKV double) and writes through the
// REAL save update; the seams that need native chrome are mocked at the module
// boundary (the Ribbon double, the display provider double, the clipboard seam,
// the safe-area insets). What the tests pin is what the SCREEN does:
//
//   SET-A    every row renders its copy from the dictionary — the twelve rows of
//            the first panel, the about/privacy panel, the action buttons
//            (nothing reworded, nothing added; the web's own "ON"/"EN" literals)
//   SET-B    the display switches change the save immediately — the done-when:
//            each toggle flips its settings key through the real save update
//   SET-C    the text-size buttons write settings.text (S/M/L)
//   SET-D    the slider wiring: the a11y increment/decrement of one 0.05 step
//            writes the save, and a refused step writes NOTHING (the web
//            input's change contract, fail-closed at both ends)
//   SET-E    Export hands the save to the exportText seam as assize-save.json,
//            pretty-printed; Import replaces the store on a v:2 paste (the
//            web's silence on success) and refuses a hostile paste with the
//            error sound
//   SET-F    Delete my data opens the confirm alert with the web's exact
//            message; cancel keeps the session, the destructive button purges
//            storage and re-enters at a fresh boot (the idbClearAll + reload
//            translation)
//   SET-G    the G13 replay row survives the full port verbatim: same
//            dictionary key, same payload law, fresh duel nonce
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Alert } from 'react-native';
import { i18n } from '@/i18n';
import { useUi } from '@/state/ui';
import { useSave, freshSave, type SaveStateV2 } from '@/state/save';
import { storage, __resetStorageBackends } from '@/platform/storage';
import { audio } from '@/platform/audio';
import { exportText } from '@/platform/clipboard';
import SettingsScreen from '@/ui/screens/SettingsScreen';
import { EXPORT_FILE_NAME, exportPayload } from '@/ui/screens/ledgerLaw';

vi.mock('@/platform/clipboard', () => ({
  clipboard: { copy: vi.fn(async () => true), read: vi.fn(async () => '') },
  exportText: vi.fn(async () => 'shared'),
}));

vi.mock('@/platform/display', () => ({
  useDisplaySettings: () => ({ contrast: false, text: 'm' as const }),
  useMotionReduced: () => false,
}));

vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

// the Ribbon double: same four tabs, real routing — see LedgerProfile's header note.
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
    const go = useUi((s: { go: (screen: 'antechamber' | 'folioMap' | 'cabinet' | 'ledger') => void }) => s.go);
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

/** every node of a type carrying a label — the field/button label pair shares one. */
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
    tree = renderer.create(<SettingsScreen />);
  });
  return tree as unknown as { toJSON: () => unknown; unmount: () => void };
}

/** the alert's buttons array (the confirm dialog chrome, recorded by the double). */
function alertButtons(): { text: string; style?: string; onPress?: () => void }[] {
  const calls = vi.mocked(Alert.alert).mock.calls;
  return ((calls[calls.length - 1]?.[2] ?? []) as { text: string; style?: string; onPress?: () => void }[]);
}

beforeEach(async () => {
  __resetStorageBackends();
  await storage.clearAll();
  vi.mocked(Alert.alert).mockClear();
  vi.mocked(exportText).mockClear();
  await useSave.getState().load();
  useUi.setState({ screen: 'settings', prev: 'antechamber' });
});

afterEach(() => {
  vi.restoreAllMocks();
  useUi.setState({ screen: 'boot', prev: null });
});

describe('SettingsScreen (specs/17 5.7)', () => {
  it('SET-A every row renders its dictionary copy — nothing reworded, nothing added', async () => {
    const tree = await renderScreen();
    const text = findAllText(tree.toJSON());
    const expected = [
      i18n.settings.title,
      i18n.settings.music, i18n.settings.effects, i18n.settings.haptics,
      i18n.settings.colorblind, i18n.settings.colorblindNote,
      i18n.settings.highContrast, i18n.settings.reducedMotion, i18n.settings.textSize,
      i18n.settings.small, i18n.settings.medium, i18n.settings.large,
      i18n.settings.autoNotes, i18n.settings.highlights, i18n.settings.leftHand,
      i18n.settings.language, i18n.settings.telemetry, i18n.settings.telemetryNote,
      i18n.settings.about, i18n.settings.aboutBody,
      i18n.settings.privacy, i18n.settings.privacyBody,
      i18n.settings.exportSave, i18n.settings.importSave, i18n.settings.deleteData,
      // the web screen's own literals, carried verbatim
      'ON', 'EN',
    ];
    for (const copy of expected) expect(text, copy).toContain(copy);
  });

  it('SET-B the display switches change the save immediately (the done-when)', async () => {
    const tree = await renderScreen();
    const switches: [string, keyof SaveStateV2['settings']][] = [
      [i18n.settings.haptics, 'haptics'],
      [i18n.settings.highContrast, 'contrast'],
      [i18n.settings.reducedMotion, 'reducedMotion'],
      [i18n.settings.autoNotes, 'autoNotes'],
      [i18n.settings.highlights, 'highlights'],
      [i18n.settings.leftHand, 'leftHand'],
      [i18n.settings.telemetry, 'telemetry'],
    ];
    for (const [label, key] of switches) {
      const before = useSave.getState().save!.settings[key] as boolean;
      const toggle = find(tree.toJSON(), label)!;
      expect(toggle, label).toBeTruthy();
      expect(toggle.props.accessibilityRole).toBe('switch');
      expect(toggle.props.accessibilityState).toEqual({ checked: before });
      await renderer.act(async () => { (toggle.props.onPress as () => void)(); });
      expect(useSave.getState().save!.settings[key], label).toBe(!before);
      expect(find(tree.toJSON(), label)!.props.accessibilityState).toEqual({ checked: !before });
      // flip it back for the next row's baseline
      await renderer.act(async () => { (find(tree.toJSON(), label)!.props.onPress as () => void)(); });
      expect(useSave.getState().save!.settings[key], label).toBe(before);
    }
  });

  it('SET-C the text-size buttons write settings.text and announce selection', async () => {
    const tree = await renderScreen();
    for (const t of ['small', 'medium', 'large'] as const) {
      const expected = t === 'small' ? 's' : t === 'medium' ? 'm' : 'l';
      const btn = find(tree.toJSON(), i18n.settings[t])!;
      await renderer.act(async () => { (btn.props.onPress as () => void)(); });
      expect(useSave.getState().save!.settings.text).toBe(expected);
      // the pressed button now announces itself selected (the web's aria-pressed)
      expect(find(tree.toJSON(), i18n.settings[t])!.props.accessibilityState).toEqual({ selected: true });
    }
  });

  it('SET-D the sliders write one 0.05 step via a11y actions — and refuse out-of-range steps', async () => {
    const tree = await renderScreen();
    const rows = [[i18n.settings.music, 'music'], [i18n.settings.effects, 'fx']] as const;
    for (const [label, key] of rows) {
      // the handler is re-read from the FRESH tree before every act — a drag fires
      // faster than React re-renders, and a held reference would read a stale value
      const handler = () =>
        (find(tree.toJSON(), label)!.props.onAccessibilityAction as (e: { nativeEvent: { actionName: string } }) => void);
      const slider = find(tree.toJSON(), label)!;
      expect(slider.props.accessibilityRole).toBe('adjustable');
      const before = useSave.getState().save!.settings[key];
      expect((slider.props.accessibilityValue as { now: number }).now).toBe(before);
      // increment: one step up
      await renderer.act(async () => { handler()({ nativeEvent: { actionName: 'increment' } }); });
      expect(useSave.getState().save!.settings[key]).toBeCloseTo(before + 0.05, 10);
      // decrement: back to the value
      await renderer.act(async () => { handler()({ nativeEvent: { actionName: 'decrement' } }); });
      expect(useSave.getState().save!.settings[key]).toBe(before);
    }
    // the ceiling refuses: pin music at max, re-mount (a fresh value prop), and
    // increment again — the save does not move
    useSave.getState().update((s) => ({ ...s, settings: { ...s.settings, music: 1 } }));
    const tree2 = await renderScreen();
    const music = find(tree2.toJSON(), i18n.settings.music)!;
    expect((music.props.accessibilityValue as { now: number }).now).toBe(1);
    const act2 = music.props.onAccessibilityAction as (e: { nativeEvent: { actionName: string } }) => void;
    await renderer.act(async () => { act2({ nativeEvent: { actionName: 'increment' } }); });
    expect(useSave.getState().save!.settings.music).toBe(1);
  });

  it('SET-E export hands the save to the seam; import honours the v:2 gate both ways', async () => {
    const tree = await renderScreen();
    // export: assize-save.json, the pretty-printed save, application/json
    const exportBtn = find(tree.toJSON(), i18n.settings.exportSave)!;
    await renderer.act(async () => { (exportBtn.props.onPress as () => void)(); });
    expect(exportText).toHaveBeenCalledOnce();
    const [name, payload, mime] = vi.mocked(exportText).mock.calls[0];
    expect(name).toBe(EXPORT_FILE_NAME);
    expect(mime).toBe('application/json');
    expect(payload).toBe(exportPayload(useSave.getState().save!));

    // import: the paste field + the import button share the web input's label
    const paste = async (text: string) => {
      const f = findAllLabelled(tree.toJSON(), 'TextInput', i18n.settings.importSave)[0]!;
      await renderer.act(async () => { (f.props.onChangeText as (t: string) => void)(text); });
    };
    const pressImport = async () => {
      // re-read from the FRESH tree: the button's onPress closes over saveText,
      // and a held reference would import the stale paste
      const b = findAllLabelled(tree.toJSON(), 'Pressable', i18n.settings.importSave)[0]!;
      await renderer.act(async () => { (b.props.onPress as () => void)(); });
    };

    // a hostile paste is refused fail-closed with the error sound, store intact
    await paste('not json at all');
    const errSpy = vi.spyOn(audio, 'error');
    await pressImport();
    expect(errSpy).toHaveBeenCalledOnce();

    // a v:2 paste replaces the store — silently (the web's success discipline)
    const imported = freshSave('A Imported Clerk');
    imported.settings.reducedMotion = true;
    await paste(JSON.stringify(imported));
    await pressImport();
    expect(useSave.getState().save!.name).toBe('A Imported Clerk');
    expect(useSave.getState().save!.settings.reducedMotion).toBe(true);
    expect(errSpy).toHaveBeenCalledOnce(); // no second error: the landed import is silent
  });

  it('SET-F delete opens the confirm with the web message; confirming purges and re-boots', async () => {
    const tree = await renderScreen();
    const deleteBtn = find(tree.toJSON(), i18n.settings.deleteData)!;
    await renderer.act(async () => { (deleteBtn.props.onPress as () => void)(); });
    expect(Alert.alert).toHaveBeenCalledOnce();
    const [title, message] = vi.mocked(Alert.alert).mock.calls[0];
    expect(message).toBe(i18n.settings.deleteConfirm);

    // cancel: the session survives untouched
    const cancel = alertButtons()[0]!;
    expect(cancel.style).toBe('cancel');
    await renderer.act(async () => { cancel.onPress?.(); });
    expect(useSave.getState().save).not.toBeNull();
    expect(useUi.getState().screen).toBe('settings');

    // confirm: storage wiped, a fresh save minted, back at boot, stack cleared
    const confirm = alertButtons()[1]!;
    expect(confirm.style).toBe('destructive');
    await renderer.act(async () => { confirm.onPress?.(); });
    const save = useSave.getState().save!;
    expect(save.v).toBe(2);
    expect(save.tutorialDone).toBe(false);
    expect(save.economy.ink).toBe(0);
    expect(save.name).toBeTruthy(); // a re-minted guest identity answers the roll
    expect(useUi.getState().screen).toBe('boot');
    expect(useUi.getState().prev).toBeNull();
    // the wiped-and-re-minted save is the one on disk
    const stored = await storage.get<SaveStateV2>('save', 'me');
    expect(stored?.v).toBe(2);
    expect(stored?.tutorialDone).toBe(false);
  });

  it('SET-G the G13 replay row survives the full port verbatim', async () => {
    const tree = await renderScreen();
    const row = find(tree.toJSON(), i18n.tutorial.relearn)!;
    expect(row).toBeTruthy();
    await renderer.act(async () => { (row.props.onPress as () => void)(); });
    const ui = useUi.getState();
    expect(ui.screen).toBe('tutorial');
    expect(ui.duelMode).toBe('tutorial');
    expect(ui.lastResult).toBeNull();
    expect(ui.serverDuel).toBeNull();
    expect(ui.prev).toBe('settings');
  });
});
