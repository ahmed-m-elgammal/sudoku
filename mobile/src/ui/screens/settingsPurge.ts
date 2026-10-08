// settingsPurge.ts — the mobile translation of the web SettingsScreen's delete-data
// flow (SettingsScreen.tsx:107-117):
//
//   if (confirm(i18n.settings.deleteConfirm)) { void idbClearAll(); location.reload(); }
//
// The web's idbClearAll wipes the four IndexedDB stores (identity, save, duels,
// notes) and the reload re-enters at boot, where a fresh guest identity and a fresh
// save are minted. On a phone there is no page to reload, so the SAME user-visible
// outcome is produced in place, in the boot order App.tsx established:
//
//   1. storage.clearAll()   — the KV tiers (the port of idbClearAll; MMKV /
//                             AsyncStorage / fs, all four STORES)
//   2. sql.clear()          — the echo ring. On the web the ring lives IN the idb
//                             'duels' store, so the web's wipe takes it; on mobile
//                             it lives in SQLite, so the purge must take it too or
//                             the delete would lie about the echoes.
//   3. re-mint              — the save store reset to its pristine {save: null,
//                             loaded: false} and load() re-run: a fresh guest
//                             identity (new id, new secret — the Keychain row is
//                             overwritten) and a freshSave, exactly what the web's
//                             reload lands on.
//   4. boot                 — GameShell re-enters at 'boot' with the stack cleared
//                             (prev: null) so hardware-back cannot return into the
//                             purged session.
//
// REPORTED DEFECT (web build, inherited — report, do not fix): the web fires
// idbClearAll() WITHOUT awaiting it before location.reload() — the reload can beat
// the wipe to the disk and the delete silently lands only partially (a classic
// unload race). The port awaits the clear before the re-mint: the same visible
// flow, the wipe guaranteed. Fixing the web build is not this port's licence.
import { storage, sql } from '@/platform/storage';
import { useSave } from '@/state/save';
import { useUi } from '@/state/ui';

export async function purgeAndReboot(): Promise<void> {
  await storage.clearAll();
  await sql.clear();

  useSave.setState({ save: null, loaded: false });
  await useSave.getState().load();

  // the web reload re-enters at boot; the stack is cleared so a hardware back
  // cannot walk back into the purged session
  useUi.setState({ screen: 'boot', prev: null });
}
