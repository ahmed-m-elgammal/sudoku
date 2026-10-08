// settingsActions.tsx — the export / import / delete panel of the Settings screen
// (S18, specs/17 phase 5.7), extracted from the screen (the ledgerRecovery/
// friendPanels split — the no-god-files law): it is the one stateful block of the
// settings, so it is one file.
//
// PORT of the actions <section> in ../src/app/game/SettingsScreen.tsx (:85-119):
//   - "Export save" (`<a download>`, :87-98): the save as assize-save.json through
//     the exportText seam — the same translation the Great Ledger's recovery
//     section uses, with the web's exact file name and pretty-printed payload;
//   - "Import save" (`<input type="file">`, :99-106): the file input becomes a
//     paste field + Import button (no document picker in the stack). The parse
//     law is the web's: JSON.parse in a try, the `parsed?.v === 2` gate, the
//     object handed to the store UNMIGRATED (the reported quirk ledgerLaw
//     carries), the error sound on a refused paste and SILENCE on a landed one
//     (the web's exact sound discipline, which differs from the Ledger's);
//   - "Delete my data" (:107-117): `confirm(deleteConfirm)` → `Alert.alert` with
//     the web's exact message and Cancel / Delete-my-data buttons (the
//     CabinetScreen/DailyScreen alert translation), then the purge law in
//     ./settingsPurge (the web's idbClearAll + location.reload()).
//
// The web's row order (export, import input, delete) is preserved in one
// flex-wrap row; the fresh-read-at-the-await law (the friendLaw lesson) governs
// the export, exactly as the web reads useSave.getState().save at click time.
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSave } from '@/state/save';
import { audio } from '@/platform/audio';
import { exportText } from '@/platform/clipboard';
import { fonts, layout, palette, type Theme, type as typeScale } from '@/theme/tokens';
import { i18n } from '@/i18n';
import { EXPORT_FILE_NAME, exportPayload, parseSaveImport } from './ledgerLaw';
import { purgeAndReboot } from './settingsPurge';

type Fs = ReturnType<typeof typeScale>;

export interface SettingsActionsProps {
  theme: Theme;
  fs: Fs;
}

export default function SettingsActions({ theme, fs }: SettingsActionsProps) {
  // the paste field — the web's <input type="file"> (see header)
  const [saveText, setSaveText] = useState('');

  const exportSave = async () => {
    // fresh read at the await — the friendLaw lesson, the web's own
    // useSave.getState().save read (:90)
    const cur = useSave.getState().save;
    if (!cur) return;
    await exportText(EXPORT_FILE_NAME, exportPayload(cur), 'application/json');
  };

  const importSave = () => {
    const parsed = parseSaveImport(saveText);
    if (!parsed) {
      audio.error();
      return;
    }
    useSave.getState().update(() => parsed);
    setSaveText('');
  };

  const confirmDelete = () => {
    // the web confirm() → the platform's dialog chrome (CabinetScreen precedent):
    // the message is the web's exact string; the buttons are the browser's
    // OK/Cancel chrome, in this port's words
    Alert.alert(
      i18n.settings.deleteData,
      i18n.settings.deleteConfirm,
      [
        { text: i18n.common.cancel, style: 'cancel' },
        { text: i18n.settings.deleteData, style: 'destructive', onPress: () => { void purgeAndReboot(); } },
      ],
    );
  };

  return (
    <View style={[styles.section, { backgroundColor: theme.bgRaised, borderColor: theme.lineStrong }]}>
      <View style={[styles.ring, { borderColor: theme.line }]} pointerEvents="none" />
      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={i18n.settings.exportSave}
          onPress={() => { void exportSave(); }}
          style={[styles.btn, styles.btnGhost, { borderColor: theme.lineStrong }]}
        >
          <Text style={[styles.btnText, { color: theme.fg, fontSize: fs.md }]}>{i18n.settings.exportSave}</Text>
        </Pressable>
        <TextInput
          multiline
          value={saveText}
          onChangeText={setSaveText}
          placeholder={i18n.settings.importSave}
          placeholderTextColor={theme.fgDim}
          accessibilityLabel={i18n.settings.importSave}
          style={[styles.field, { backgroundColor: palette.charcoal, borderColor: theme.lineStrong, color: theme.fg, fontSize: fs.sm }]}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={i18n.settings.importSave}
          onPress={importSave}
          style={[styles.btn, styles.btnGhost, { borderColor: theme.lineStrong }]}
        >
          <Text style={[styles.btnText, { color: theme.fg, fontSize: fs.md }]}>{i18n.settings.importSave}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={i18n.settings.deleteData}
          onPress={confirmDelete}
          style={[styles.btn, styles.btnOxblood]}
        >
          <Text style={[styles.btnText, { color: palette.parchmentLight, fontSize: fs.md }]}>{i18n.settings.deleteData}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // web section.panel: margin '10px 16px', padding 14, radius, 1px line-strong
  section: {
    marginHorizontal: 16,
    marginTop: 10,
    padding: 14,
    borderWidth: 1,
    borderRadius: layout.radius,
  },
  // web .panel::before: absolute inset 4, 1px var(--line), radius 2
  ring: { position: 'absolute', top: 4, left: 4, right: 4, bottom: 4, borderWidth: 1, borderRadius: 2 },
  // web actions div: flex, gap 8, flexWrap
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  // web .btn: 1.5px brass-dim border, radius, padding '10px 18px' → the 44pt floor
  btn: {
    minHeight: layout.touch,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderRadius: layout.radius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // web .btn-ghost: line-strong border, transparent ground
  btnGhost: { backgroundColor: 'transparent' },
  // web .btn-oxblood: oxblood-deep ground, oxblood border
  btnOxblood: { backgroundColor: palette.oxbloodDeep, borderColor: palette.oxblood },
  // web .btn: font-display, fs-md, letter-spacing 0.06em
  btnText: { fontFamily: fonts.display, letterSpacing: 0.06 },
  // the paste field: the text-input chrome (charcoal ground, line-strong border),
  // sized to hold a save JSON at a readable size
  field: {
    flexGrow: 1,
    minWidth: 160,
    minHeight: 64,
    borderWidth: 1,
    borderRadius: layout.radius,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontFamily: fonts.body,
  },
});
