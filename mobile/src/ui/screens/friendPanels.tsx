// FriendScreen's two panels — the wax-seal (create/share/wait) and the
// "Break a seal" join row, extracted from the screen (the Modals.tsx precedent:
// one screen's related chrome lives together; the flow and the net laws stay in
// FriendScreen.tsx). Every colour/copy/space here comes from tokens or i18n —
// the web's .panel / .btn / .btn-primary / .btn-ghost / input recipes, verbatim.
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { fonts, layout, palette, type as typeScale, type Theme } from '@/theme/tokens';
import { i18n, tf } from '@/i18n';
import { isJoinableCode } from './friendLaw';

type Fs = ReturnType<typeof typeScale>;

/** The web's .panel + its ::before engraved ring. */
function Panel({ theme, children, style }: { theme: Theme; children: ReactNode; style?: object }) {
  return (
    <View style={[styles.panel, style, { backgroundColor: theme.bgRaised, borderColor: theme.lineStrong }]}>
      <View style={[styles.ring, { borderColor: theme.line }]} pointerEvents="none" />
      {children}
    </View>
  );
}

/** The web's .btn.btn-primary — brass border, display face, 0.06em tracking. */
export function BrassButton({ theme, fs, label, onPress, disabled }: {
  theme: Theme; fs: Fs; label: string; onPress: () => void; disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.primary,
        { backgroundColor: theme.bgRaised, borderColor: palette.brass, opacity: disabled ? 0.45 : pressed ? 0.82 : 1 },
      ]}
    >
      <Text style={[styles.btnText, { color: palette.parchmentLight, fontSize: fs.md, letterSpacing: 0.06 * fs.md }]}>
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * The create panel: "Seal a challenge" until a code exists, then the share line,
 * the wax button, the honest error note and the waiting line (laws c/d of the
 * screen header — the error replaces the waiting lie, never accompanies it).
 */
export function FriendCreatePanel({ theme, fs, code, creating, error, onCreate, onCopy }: {
  theme: Theme; fs: Fs;
  code: string | null;
  creating: boolean;
  error: boolean;
  onCreate: () => void;
  onCopy: () => void;
}) {
  return (
    <Panel theme={theme} style={styles.createPanel}>
      {!code ? (
        <>
          <BrassButton theme={theme} fs={fs} label={i18n.friend.create} onPress={onCreate} disabled={creating} />
          {error ? (
            <Text style={[styles.error, { color: theme.fgDim, fontSize: fs.xs, marginTop: 8 }]}>
              {i18n.offline.body}
            </Text>
          ) : null}
        </>
      ) : (
        <>
          {/* the CODE is the join token on both clients (the web's ?duel= link is dead) */}
          <Text style={[styles.share, { color: palette.brass, fontSize: fs.md }]}>
            {tf('friend.shareCode', { code })}
          </Text>
          {/* the web's .btn-ghost: line-strong border, transparent ground */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={i18n.friend.copied}
            onPress={onCopy}
            style={({ pressed }) => [
              styles.ghost,
              { borderColor: theme.lineStrong, opacity: pressed ? 0.82 : 1 },
            ]}
          >
            <Text style={[styles.btnText, { color: theme.fg, fontSize: fs.md, letterSpacing: 0.06 * fs.md }]}>
              {i18n.friend.copied}
            </Text>
          </Pressable>
          {error ? (
            <Text style={[styles.error, { color: theme.fgDim, fontSize: fs.xs, marginTop: 8 }]}>
              {i18n.offline.body}
            </Text>
          ) : (
            <Text style={[styles.waiting, { color: theme.fgDim, fontSize: fs.sm, marginTop: 8 }]}>
              {i18n.friend.waiting}
            </Text>
          )}
        </>
      )}
    </Panel>
  );
}

/**
 * The join panel: the web's "Break a seal" h2 (copy that lived outside i18n on
 * the web — an additive mobile key), the uppercase code input, and Begin, which
 * stays disabled until the code is non-empty (the empty-code ranked-queue leak,
 * refused at the UI's root).
 */
export function FriendJoinPanel({ theme, fs, value, onChange, joining, error, waiting, onBegin }: {
  theme: Theme; fs: Fs;
  value: string;
  onChange: (t: string) => void;
  joining: boolean;
  error: boolean;
  waiting: boolean;
  onBegin: () => void;
}) {
  const ready = isJoinableCode(value);
  return (
    <Panel theme={theme}>
      <Text accessibilityRole="header" style={[styles.joinTitle, { color: theme.fg, fontSize: fs.md }]}>
        {i18n.friend.joinTitle}
      </Text>
      <View style={styles.joinRow}>
        <TextInput
          accessibilityLabel={i18n.friend.codeLabel}
          value={value}
          onChangeText={onChange}
          placeholder={i18n.friend.codePlaceholder}
          placeholderTextColor={theme.fgDim}
          autoCapitalize="characters"
          autoCorrect={false}
          spellCheck={false}
          returnKeyType="go"
          onSubmitEditing={joining ? undefined : onBegin}
          style={[
            styles.input,
            { backgroundColor: palette.charcoal, borderColor: theme.lineStrong, color: theme.fg, fontSize: fs.md, minHeight: layout.touch },
          ]}
        />
        <BrassButton
          theme={theme}
          fs={fs}
          label={i18n.common.begin}
          onPress={onBegin}
          disabled={joining || !ready}
        />
      </View>
      {error ? (
        <Text style={[styles.error, { color: theme.fgDim, fontSize: fs.xs, marginTop: 8 }]}>
          {i18n.offline.body}
        </Text>
      ) : null}
      {waiting ? (
        <Text style={[styles.waiting, { color: theme.fgDim, fontSize: fs.sm, marginTop: 8 }]}>
          {i18n.friend.waiting}
        </Text>
      ) : null}
    </Panel>
  );
}

const styles = StyleSheet.create({
  // web .panel: bg-raised, 1px line-strong, radius, padding 16 + the engraved ring
  panel: { borderWidth: 1, borderRadius: layout.radius, padding: 16 },
  ring: { position: 'absolute', top: 4, left: 4, right: 4, bottom: 4, borderWidth: 1, borderRadius: 2 },
  // web section margin '12px 0' + textAlign center
  createPanel: { marginTop: 12, marginBottom: 12, alignItems: 'center' },
  // web .btn: padding 10/18, 1.5px border, radius, 44 min
  primary: {
    minHeight: layout.touch,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderRadius: layout.radius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // web .btn-ghost
  ghost: {
    minHeight: layout.touch,
    marginTop: 10,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderRadius: layout.radius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: { fontFamily: fonts.display },
  // web share p: brass, body face
  share: { fontFamily: fonts.body, textAlign: 'center' },
  // web offline note: fs-xs, dim
  error: { fontFamily: fonts.body, textAlign: 'center' },
  // web waiting p: italic, dim (the bodyItalic face — RN cannot synthesize italics)
  waiting: { fontFamily: fonts.bodyItalic, textAlign: 'center' },
  // web h2: display face at fs-md (inline override, verbatim)
  joinTitle: { fontFamily: fonts.display, marginBottom: 4 },
  // web div: flex row, gap 8, marginTop 8
  joinRow: { flexDirection: 'row', alignItems: 'stretch', gap: 8, marginTop: 8 },
  // web input: charcoal ground, 1px line-strong, fg, padding 8/10, body face (square)
  input: { flex: 1, borderWidth: 1, paddingVertical: 8, paddingHorizontal: 10, fontFamily: fonts.body },
});
