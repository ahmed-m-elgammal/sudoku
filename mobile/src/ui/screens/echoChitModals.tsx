// echoChitModals.tsx — the two T19 sheets, extracted from the shelf (the
// friendPanels precedent; the no-god-files law): the sealed chit a Clerk passes
// on, and the break-a-chit import with its ok/bad notes.
//
// PORT of the two `.modal-backdrop` dialogs in ../src/app/game/EchoesScreen.tsx.
// The web's dialogs are RNModal + theme.modalScrim here, conditionally mounted by
// the caller exactly like the web's `{chit && ...}`; Android hardware-back closes
// the sheet (onRequestClose), the same dismissal the Close button offers. The web
// sheet is `width: min(92vw, 420px)` — 92% with a 420 cap here.
import { Modal as RNModal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { fonts, layout, palette, type Theme, type as typeScale } from '@/theme/tokens';
import { i18n } from '@/i18n';

type Fs = ReturnType<typeof typeScale>;

export interface SealedChitModalProps {
  /** the ASSIZE1- payload — sealed, no names inside */
  chit: string;
  /** the clipboard answered — the modal tells the truth either way */
  copied: boolean;
  theme: Theme;
  fs: Fs;
  onCopy: () => void;
  onClose: () => void;
}

export function SealedChitModal({ chit, copied, theme, fs, onCopy, onClose }: SealedChitModalProps) {
  return (
    <RNModal transparent animationType="fade" visible onRequestClose={onClose}>
      <View style={[styles.backdrop, { backgroundColor: theme.modalScrim }]}>
        <View
          accessibilityLabel={i18n.echoes.chitTitle}
          style={[styles.sheet, { backgroundColor: theme.bgRaised, borderColor: theme.lineStrong }]}
        >
          <Text accessibilityRole="header" style={[styles.sheetTitle, { color: theme.fg, fontSize: fs.xl }]}>
            {i18n.echoes.chitTitle}
          </Text>
          <Text style={[styles.dim, { color: theme.fgDim, fontSize: fs.xs }]}>{i18n.echoes.chitBody}</Text>
          <TextInput
            multiline
            editable={false}
            value={chit}
            style={[styles.chitBox, { color: theme.fgDim, borderColor: theme.fgDim, backgroundColor: theme.bg, fontSize: fs.xs }]}
          />
          <Text style={[styles.dim, { color: copied ? palette.brass : theme.fgDim, fontSize: fs.xs, marginTop: 6 }]}>
            {copied ? i18n.echoes.copied : i18n.echoes.copyFail}
          </Text>
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={i18n.echoes.copy}
              onPress={onCopy}
              style={({ pressed }) => [styles.modalBtn, styles.primaryModalBtn, { opacity: pressed ? 0.85 : 1 }]}
            >
              <Text style={[styles.btnText, { color: palette.parchmentLight, fontSize: fs.sm }]}>{i18n.echoes.copy}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={i18n.common.close}
              onPress={onClose}
              style={({ pressed }) => [styles.modalBtn, { borderColor: theme.lineStrong, opacity: pressed ? 0.85 : 1 }]}
            >
              <Text style={[styles.dim, { color: theme.fg, fontSize: fs.sm }]}>{i18n.common.close}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </RNModal>
  );
}

export interface ImportChitModalProps {
  text: string;
  /** the honest verdicts: broken wax, or a place on the shelf */
  note: 'ok' | 'bad' | null;
  theme: Theme;
  fs: Fs;
  onChangeText: (t: string) => void;
  onImport: () => void;
  onClose: () => void;
}

export function ImportChitModal({ text, note, theme, fs, onChangeText, onImport, onClose }: ImportChitModalProps) {
  return (
    <RNModal transparent animationType="fade" visible onRequestClose={onClose}>
      <View style={[styles.backdrop, { backgroundColor: theme.modalScrim }]}>
        <View
          accessibilityLabel={i18n.echoes.importTitle}
          style={[styles.sheet, { backgroundColor: theme.bgRaised, borderColor: theme.lineStrong }]}
        >
          <Text accessibilityRole="header" style={[styles.sheetTitle, { color: theme.fg, fontSize: fs.xl }]}>
            {i18n.echoes.importTitle}
          </Text>
          <Text style={[styles.dim, { color: theme.fgDim, fontSize: fs.xs }]}>{i18n.echoes.chitBody}</Text>
          <TextInput
            multiline
            value={text}
            onChangeText={onChangeText}
            placeholder={i18n.echoes.importPlaceholder}
            accessibilityLabel={i18n.echoes.importPlaceholder}
            style={[styles.chitBox, { color: theme.fg, borderColor: theme.fgDim, backgroundColor: theme.bg, fontSize: fs.xs }]}
          />
          {note === 'bad' && (
            <Text style={[styles.dim, { color: theme.danger, fontSize: fs.xs, marginTop: 6 }]}>{i18n.echoes.importBad}</Text>
          )}
          {note === 'ok' && (
            <Text style={[styles.dim, { color: palette.brass, fontSize: fs.xs, marginTop: 6 }]}>{i18n.echoes.importOk}</Text>
          )}
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={i18n.echoes.importAction}
              onPress={onImport}
              style={({ pressed }) => [styles.modalBtn, styles.primaryModalBtn, { opacity: pressed ? 0.85 : 1 }]}
            >
              <Text style={[styles.btnText, { color: palette.parchmentLight, fontSize: fs.sm }]}>{i18n.echoes.importAction}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={i18n.common.close}
              onPress={onClose}
              style={({ pressed }) => [styles.modalBtn, { borderColor: theme.lineStrong, opacity: pressed ? 0.85 : 1 }]}
            >
              <Text style={[styles.dim, { color: theme.fg, fontSize: fs.sm }]}>{i18n.common.close}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </RNModal>
  );
}

const styles = StyleSheet.create({
  // web .modal-backdrop over the page
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  // web .panel.modal-sheet: width min(92vw, 420px), padding 20
  sheet: { width: '92%', maxWidth: 420, borderRadius: layout.radius, borderWidth: 1, padding: 20 },
  sheetTitle: { fontFamily: fonts.display, marginBottom: 8 },
  dim: { fontFamily: fonts.body },
  // web textarea: width 100%, height 90, marginTop 10, 1px fg-dim border, radius 6
  chitBox: { width: '100%', height: 90, marginTop: 10, borderWidth: 1, borderRadius: layout.radiusLg, padding: 8, textAlignVertical: 'top', fontFamily: fonts.body },
  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  modalBtn: { flex: 1, minHeight: layout.touch, borderWidth: 1, borderRadius: layout.radius, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  primaryModalBtn: { borderColor: palette.brass, borderWidth: 1.5 },
  btnText: { fontFamily: fonts.display },
});
