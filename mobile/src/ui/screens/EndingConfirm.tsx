// EndingConfirm — the S19 confirm sheet (web EndingChoice.tsx:139-155).
//
// Extracted from the EndingChoice port to hold the ~300-line ceiling. Presentational
// by contract: the parent owns the verdict state and the seal write; this surface
// owns only the blocking dialog. `onRequestClose` = the Return action — Android back
// inside a visible RN Modal fires it, and the Modals.tsx dismissal law is that
// dismissing a confirm sheet cancels it.
//
// Translation notes:
//  - the sheet is `.panel.modal-sheet`: bg-raised, 1px line-strong, radius, plus the
//    engraved ::before ring (absolute View at inset 4, 1px theme.line, radius 2 —
//    the ResultScreen port's established translation).
//  - the scrim is `theme.modalScrim` (globals.css `.modal-backdrop`
//    rgba(10,10,11,0.72), lifted into tokens.ts); `backdrop-filter: blur(2px)` has
//    no RN equivalent — reported, not invented.
//  - web role="dialog" aria-modal -> the RN Modal surface (inherently modal) + the
//    Modals.tsx 'alert' role and label.
//  - web h2 with no font-size renders at the browser default, 1.5em x 15px root =
//    22 — the DuelModal title precedent.
//  - buttons are .btn / .btn-primary: display face, 0.06em, min 44pt, 1.5px border,
//    brass for primary, brass-dim for the plain one (the FolioDetail Begin law);
//    the web :active dips to `translateY(1px)` + a darker ground, rendered here as
//    the established pressed-opacity translation.
import { useMemo } from 'react';
import { Modal as RNModal, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { audio } from '@/platform/audio';
import { useDisplaySettings } from '@/platform/display';
import { fonts, layout, palette, themeFor, type as typeScale } from '@/theme/tokens';
import { i18n } from '@/i18n';

export interface EndingConfirmProps {
  /** the armed verdict's accent — the web's `ENDINGS[chosen].accent` */
  accent: string;
  /** the armed verdict's title — the web's `ENDINGS[chosen].title` line */
  title: string;
  onSeal: () => void;
  onReturn: () => void;
}

export default function EndingConfirm({ accent, title, onSeal, onReturn }: EndingConfirmProps) {
  const display = useDisplaySettings();
  const theme = useMemo(
    () => themeFor({ contrast: display.contrast, text: display.text }),
    [display.contrast, display.text],
  );
  const fs = typeScale(theme.textScale);
  const { width: winW } = useWindowDimensions();

  return (
    <RNModal
      transparent
      animationType="fade"
      visible
      onRequestClose={() => {
        audio.uiTap();
        onReturn();
      }}
    >
      {/* web .modal-backdrop: the modalScrim token; place-items center; padding 16 */}
      <View style={[styles.backdrop, { backgroundColor: theme.modalScrim }]}>
        <View
          accessibilityRole="alert"
          accessibilityLabel={i18n.endingChoice.confirmTitle}
          style={[
            styles.sheet,
            { width: Math.min(winW * 0.92, 360), backgroundColor: theme.bgRaised, borderColor: theme.lineStrong },
          ]}
        >
          <View style={[styles.ring, { borderColor: theme.line }]} pointerEvents="none" />
          <Text accessibilityRole="header" style={[styles.sheetTitle, { color: accent }]}>
            {i18n.endingChoice.confirmTitle}
          </Text>
          <Text style={[styles.sheetBody, { color: theme.fgDim, fontSize: fs.sm }]}>
            {i18n.endingChoice.confirmBody}
          </Text>
          <Text style={[styles.sheetVerdict, { color: palette.parchmentLight, fontSize: fs.md }]}>
            {title}
          </Text>
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              onPress={onSeal}
              style={({ pressed }) => [
                styles.btn,
                { backgroundColor: palette.charcoal, borderColor: palette.brass, opacity: pressed ? 0.82 : 1 },
              ]}
            >
              <Text style={[styles.btnText, { color: palette.parchmentLight, fontSize: fs.md, letterSpacing: 0.06 * fs.md }]}>
                {i18n.endingChoice.confirm}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                audio.uiTap();
                onReturn();
              }}
              style={({ pressed }) => [
                styles.btn,
                { backgroundColor: palette.charcoal, borderColor: palette.brassDim, opacity: pressed ? 0.82 : 1 },
              ]}
            >
              <Text style={[styles.btnText, { color: theme.fg, fontSize: fs.md, letterSpacing: 0.06 * fs.md }]}>
                {i18n.endingChoice.return}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </RNModal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  // web .panel.modal-sheet: bg-raised, 1px line-strong, radius — plus the ::before ring
  sheet: {
    padding: 20,
    borderWidth: 1,
    borderRadius: layout.radius,
    alignItems: 'center',
  },
  ring: { position: 'absolute', top: 4, left: 4, right: 4, bottom: 4, borderWidth: 1, borderRadius: 2 },
  sheetTitle: { fontFamily: fonts.display, fontSize: 22, marginBottom: 8, textAlign: 'center' },
  sheetBody: { fontFamily: fonts.body, textAlign: 'center' },
  // web margin '10px 0 0'
  sheetVerdict: { fontFamily: fonts.display, marginTop: 10, textAlign: 'center' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 14 },
  // web .btn: padding 10x18, 1.5px border, radius; .btn-primary border brass / text
  // parchment-light; plain .btn border brass-dim / text fg
  btn: {
    minHeight: layout.touch,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderRadius: layout.radius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: { fontFamily: fonts.display }, // 0.06em rides inline
});
