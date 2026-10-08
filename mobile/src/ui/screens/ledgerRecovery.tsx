// ledgerRecovery.tsx — the Recovery section of the Great Ledger (S17, spec §7/§17),
// extracted from the screen (the friendPanels/echoChitModals split — the no-god-files
// law): it is the one stateful block of the profile, so it is one file.
//
// PORT of the recovery <section> in ../src/app/game/LedgerProfile.tsx (:145-226).
// Four flows:
//   - "Write the code": generateRecoveryCode → shown + hashed into the Keychain
//     identity → quiet re-auth carries the recoveryHash to the server (spec 5.6
//     done-when: a recovery code moves Ink to another device).
//   - "Copy": the code, through the clipboard seam (web navigator.clipboard).
//   - "Export save": the save as assize-save.json — the web's <a download> rides
//     the exportText seam (share sheet, clipboard fallback). The web's file
//     INPUT has no RN equivalent (no document picker in the stack), so the import
//     half of that flow is a paste field + its own "Import save" button — the
//     parse law (v:2, fail-closed) and both outcome sounds are the web's.
//   - "Import save" (the code field): validateRecoveryCode → net.recovery → the
//     T13 max law (ledgerLaw.restoredInk) → reliquary sound; else error.
//
// Translation notes (the AGENTS.md platform table, nothing more):
//  - the web section has NO synth.uiTap() anywhere — its only sounds are the
//    reliquary/error outcomes; the port keeps exactly that discipline;
//  - the code input's aria-label "Recovery code" is the web screen's own literal
//    (LedgerProfile.tsx:200 — not in the frozen dictionary), carried verbatim;
//  - the web's post-hash `useSave.update((s) => ({ ...s }))` (:155) is a data
//    no-op (an identical save re-written); the port leaves it out — the identity
//    write is the real effect;
//  - both text fields wear the web's text-input chrome (charcoal ground,
//    line-strong border) at the 44 pt touch floor; the paste field clears on a
//    landed import (the echo-import seam's acknowledged translation of a file
//    picker — picking a new file replaces the content).
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSave, type SaveStateV2 } from '@/state/save';
import { loadIdentity, saveIdentity, generateRecoveryCode, hashRecoveryCode, validateRecoveryCode } from '@/state/identity';
import { net } from '@/game/net/client';
import { audio } from '@/platform/audio';
import { clipboard, exportText } from '@/platform/clipboard';
import { fonts, layout, palette, type Theme, type as typeScale } from '@/theme/tokens';
import { i18n } from '@/i18n';
import { EXPORT_FILE_NAME, exportPayload, parseSaveImport, recoveryInkFrom, restoredInk } from './ledgerLaw';

type Fs = ReturnType<typeof typeScale>;

export interface RecoverySectionProps {
  save: SaveStateV2;
  theme: Theme;
  fs: Fs;
}

export default function RecoverySection({ save, theme, fs }: RecoverySectionProps) {
  const [code, setCode] = useState<string | null>(null);
  const [saveText, setSaveText] = useState('');
  const [codeText, setCodeText] = useState('');

  const writeCode = async () => {
    const c = generateRecoveryCode();
    setCode(c);
    const hash = await hashRecoveryCode(c);
    const id = await loadIdentity();
    id.recoveryHash = hash;
    await saveIdentity(id);
    void net.auth({ id: id.id, secret: id.secret, name: save.name, recoveryHash: hash });
  };

  const exportSave = async () => {
    // fresh read at the await — the friendLaw lesson, and the web's own
    // useSave.getState().save read (:175)
    const cur = useSave.getState().save;
    if (!cur) return;
    await exportText(EXPORT_FILE_NAME, exportPayload(cur), 'application/json');
  };

  const importSave = async () => {
    const parsed = parseSaveImport(saveText);
    if (!parsed) {
      audio.error();
      return;
    }
    useSave.getState().update(() => parsed);
    setSaveText('');
    audio.reliquary();
  };

  const importCode = async () => {
    if (!validateRecoveryCode(codeText)) {
      audio.error();
      return;
    }
    const id = await loadIdentity();
    const res = await net.recovery({ code: codeText, id: id.id, secret: id.secret });
    // T13 — the response carries the server-known Ink: apply it (max — the
    // client may hold un-synced local ink the server never heard about).
    const ink = recoveryInkFrom(res);
    if (ink !== null) {
      useSave.getState().update((cur) => ({
        ...cur,
        economy: { ...cur.economy, ink: restoredInk(cur.economy.ink, ink) },
      }));
      audio.reliquary();
    } else {
      audio.error();
    }
  };

  return (
    <View style={[styles.section, { backgroundColor: theme.bgRaised, borderColor: theme.lineStrong }]}>
      <View style={[styles.ring, { borderColor: theme.line }]} pointerEvents="none" />
      <Text accessibilityRole="header" style={[styles.h2, { color: theme.fg, fontSize: fs.md, letterSpacing: 0.02 * fs.md }]}>
        {i18n.ledger.recovery}
      </Text>
      <Text style={[styles.body, { color: theme.fgDim, fontSize: fs.sm }]}>{i18n.ledger.recoveryBody}</Text>

      {/* web row 1: the code ritual */}
      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={i18n.ledger.recoveryShow}
          onPress={() => { void writeCode(); }}
          style={[styles.btn, { borderColor: palette.brassDim, backgroundColor: palette.charcoal }]}
        >
          <Text style={[styles.btnText, { color: theme.fg, fontSize: fs.md, letterSpacing: 0.06 * fs.md }]}>{i18n.ledger.recoveryShow}</Text>
        </Pressable>
        {code && (
          <>
            <Text style={[styles.code, { color: palette.brass, fontSize: fs.sm }]}>{code}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={i18n.ledger.recoveryCopy}
              onPress={() => { void clipboard.copy(code); }}
              style={[styles.btn, styles.btnGhost, { borderColor: theme.lineStrong }]}
            >
              <Text style={[styles.btnText, { color: theme.fg, fontSize: fs.md, letterSpacing: 0.06 * fs.md }]}>{i18n.ledger.recoveryCopy}</Text>
            </Pressable>
          </>
        )}
      </View>

      {/* web row 2: export / import — the file input is a paste field here (see header) */}
      <View style={[styles.row, { marginTop: 10 }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={i18n.ledger.export}
          onPress={() => { void exportSave(); }}
          style={[styles.btn, styles.btnGhost, { borderColor: theme.lineStrong }]}
        >
          <Text style={[styles.btnText, { color: theme.fg, fontSize: fs.md, letterSpacing: 0.06 * fs.md }]}>{i18n.ledger.export}</Text>
        </Pressable>
        <TextInput
          multiline
          value={saveText}
          onChangeText={setSaveText}
          placeholder={i18n.ledger.importPlaceholder}
          placeholderTextColor={theme.fgDim}
          accessibilityLabel={i18n.ledger.import}
          style={[styles.field, { backgroundColor: palette.charcoal, borderColor: theme.lineStrong, color: theme.fg, flex: 1, minHeight: 76, fontSize: fs.sm }]}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${i18n.ledger.import}: ${i18n.ledger.export}`}
          onPress={() => { void importSave(); }}
          style={[styles.btn, styles.btnGhost, { borderColor: theme.lineStrong }]}
        >
          <Text style={[styles.btnText, { color: theme.fg, fontSize: fs.md, letterSpacing: 0.06 * fs.md }]}>{i18n.ledger.import}</Text>
        </Pressable>
        <TextInput
          value={codeText}
          onChangeText={setCodeText}
          placeholder={i18n.ledger.recovery}
          placeholderTextColor={theme.fgDim}
          autoCapitalize="none"
          accessibilityLabel="Recovery code"
          style={[styles.field, { backgroundColor: palette.charcoal, borderColor: theme.lineStrong, color: theme.fg, flex: 1, fontSize: fs.sm }]}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${i18n.ledger.import}: ${i18n.ledger.recovery}`}
          onPress={() => { void importCode(); }}
          style={[styles.btn, styles.btnGhost, { borderColor: theme.lineStrong }]}
        >
          <Text style={[styles.btnText, { color: theme.fg, fontSize: fs.md, letterSpacing: 0.06 * fs.md }]}>{i18n.ledger.import}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // web section.panel: margin '10px 16px', padding 12, radius, 1px line-strong
  section: {
    marginHorizontal: 16,
    marginVertical: 10,
    padding: 12,
    borderWidth: 1,
    borderRadius: layout.radius,
  },
  // web .panel::before: absolute inset 4, 1px var(--line), radius 2
  ring: { position: 'absolute', top: 4, left: 4, right: 4, bottom: 4, borderWidth: 1, borderRadius: 2 },
  // web h2: font-display, fs-md (0.02em tracking rides the inline style)
  h2: { fontFamily: fonts.display },
  // web p: fg-dim, fs-sm, margin '6px 0'
  body: { fontFamily: fonts.body, marginVertical: 6 },
  // web div flex gap 8 flexWrap
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  // web .btn: 1.5px brass-dim border, radius, padding '10px 18px' → 44 pt floor
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
  // web .btn: letter-spacing 0.06em (rides the inline style)
  btnText: { fontFamily: fonts.display },
  // web code.digits: brass, word-break break-all
  code: { fontFamily: fonts.digit, flexShrink: 1 },
  // web text input: charcoal ground, 1px line-strong, fg, padding '6px 8px'
  // (fontSize rides the inline style — the player's text setting)
  field: {
    borderWidth: 1,
    borderRadius: layout.radius,
    paddingHorizontal: 8,
    paddingVertical: 6,
    minWidth: 140,
    fontFamily: fonts.body,
  },
});
