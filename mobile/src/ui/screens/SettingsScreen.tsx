// SettingsScreen — S18: audio, haptics, contrast, motion, text size, auto-notes,
// highlights, left-hand layout, language, telemetry opt-out, export/import, delete
// data, about/privacy (specs/17 phase 5.7).
//
// PORT of ../src/app/game/SettingsScreen.tsx (118 lines). The setting law is the
// web's own: every row writes `save.settings` through the save store, and the app
// reacts immediately — the DisplaySettingsProvider cascade (themeFor's contrast,
// the text scale, the motion guard) and the App-level volumes/haptics effect are
// the mobile word for the web's `document.documentElement.dataset` cascade. The
// spec's done-when — "all four display switches change the app immediately" — is
// that cascade, not per-screen restyling.
//
// Translation notes (the AGENTS.md platform table, nothing more):
//  - `<input type="range" min=0 max=1 step=0.05>` → SettingSlider (see its header;
//    the web's inline synth.setMusic/setFx calls are applied by the App-level
//    settings effect the moment the save changes — the haptics toggle's path);
//  - the web's inline Toggle → SettingToggle (its own file: the knob animates);
//  - `<a download>` + `<input type="file">` → the exportText seam + a paste field
//    with an Import button — the whole actions panel lives in ./settingsActions
//    (the ledgerRecovery split — the one stateful block, one file), including the
//    parse law and the delete-data confirm → ./settingsPurge flow;
//  - the colorblind row's static brass "ON" and the language row's static "EN" are
//    the web screen's own literals (not in the frozen dictionary) — carried
//    verbatim, like the Ribbon's tabs;
//  - `<b>` → the face the web set at fontWeight '700' (RN cannot synthesize
//    weights for the registered serif — the request states the intent);
//  - the `page-turn`-class chrome and the CSS transitions are page chrome this
//    port renders settled (the ResultScreen/Reliquary standing decision);
//  - G13 (docs/TUTORIAL_OPTIMIZATION_PLAN.md M1 item 7) — the tutorial replay row
//    that lived in the Phase A stub SURVIVES VERBATIM: same dictionary key, same
//    shared payload law, the hub-card framing at the 44 pt floor. It is the one
//    deliberate mobile addition on this screen and it keeps a standalone panel
//    above the Ribbon.
import { useMemo, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSave, type SaveStateV2 } from '@/state/save';
import { useUi } from '@/state/ui';
import { useDisplaySettings } from '@/platform/display';
import { fonts, layout, palette, themeFor, type Theme, type as typeScale } from '@/theme/tokens';
import { i18n } from '@/i18n';
import Ribbon from '@/ui/Ribbon';
import { tutorialReplayPayload } from './replayEntry';
import SettingSlider from './SettingSlider';
import SettingToggle from './SettingToggle';
import SettingsActions from './settingsActions';

type Fs = ReturnType<typeof typeScale>;
type Settings = SaveStateV2['settings'];

/**
 * The slider reports EVERY gesture event (the web input's onChange contract); the
 * save is written only when the value actually moved a step. The compare reads the
 * STORE, not the render snapshot — a drag fires faster than React re-renders, and
 * the friendLaw lesson is to read fresh at the call.
 */
function writeSlider(key: 'music' | 'fx', next: number): void {
  const store = useSave.getState();
  if (store.save?.settings[key] === next) return;
  store.update((cur) => ({ ...cur, settings: { ...cur.settings, [key]: next } }));
}

/** the web Row, lifted verbatim: flex, gap 10, padding '8px 0', 1px var(--line) bottom. */
function Row({ label, note, theme, fs, children }: {
  label: string; note?: string; theme: Theme; fs: Fs; children?: ReactNode;
}) {
  return (
    <View style={[styles.row, { borderBottomColor: theme.line }]}>
      <View style={styles.rowText}>
        <Text style={[styles.rowLabel, { color: theme.fg, fontSize: fs.sm }]}>{label}</Text>
        {note ? <Text style={[styles.rowNote, { color: theme.fgDim, fontSize: fs.xs }]}>{note}</Text> : null}
      </View>
      {children}
    </View>
  );
}

export default function SettingsScreen() {
  const save = useSave((s) => s.save);
  const go = useUi((st) => st.go);
  // G13 — bumped so a replay always remounts the duel with a fresh runtime
  const duelNonce = useUi((st) => st.duelNonce);
  const display = useDisplaySettings();
  const theme = useMemo(
    () => themeFor({ contrast: display.contrast, text: display.text }),
    [display.contrast, display.text],
  );
  const insets = useSafeAreaInsets();
  const fs = typeScale(theme.textScale);

  if (!save) return null;
  const s = save.settings;
  const set = (patch: Partial<Settings>) => {
    useSave.getState().update((cur) => ({ ...cur, settings: { ...cur.settings, ...patch } }));
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.bg }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* web header: padding 'calc(var(--safe-top) + 14px) 16px 4px' */}
        <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
          <Text accessibilityRole="header" style={[styles.h1, { color: theme.fg, fontSize: fs.lg }]}>
            {i18n.settings.title}
          </Text>
        </View>

        {/* web section.panel: margin '8px 16px', padding '6px 14px' */}
        <View style={[styles.panelFirst, { backgroundColor: theme.bgRaised, borderColor: theme.lineStrong }]}>
          <View style={[styles.ring, { borderColor: theme.line }]} pointerEvents="none" />
          <Row label={i18n.settings.music} theme={theme} fs={fs}>
            <SettingSlider
              value={s.music}
              label={i18n.settings.music}
              onChange={(v) => writeSlider('music', v)}
              theme={theme}
            />
          </Row>
          <Row label={i18n.settings.effects} theme={theme} fs={fs}>
            <SettingSlider
              value={s.fx}
              label={i18n.settings.effects}
              onChange={(v) => writeSlider('fx', v)}
              theme={theme}
            />
          </Row>
          <Row label={i18n.settings.haptics} theme={theme} fs={fs}>
            <SettingToggle on={s.haptics} label={i18n.settings.haptics} onToggle={() => set({ haptics: !s.haptics })} theme={theme} />
          </Row>
          <Row label={i18n.settings.colorblind} note={i18n.settings.colorblindNote} theme={theme} fs={fs}>
            {/* the web's static brass ON — always on, shapes ride every claim/status */}
            <Text style={[styles.staticOn, { color: palette.brass, fontSize: fs.xs }]}>ON</Text>
          </Row>
          <Row label={i18n.settings.highContrast} theme={theme} fs={fs}>
            <SettingToggle on={s.contrast} label={i18n.settings.highContrast} onToggle={() => set({ contrast: !s.contrast })} theme={theme} />
          </Row>
          <Row label={i18n.settings.reducedMotion} theme={theme} fs={fs}>
            <SettingToggle on={s.reducedMotion} label={i18n.settings.reducedMotion} onToggle={() => set({ reducedMotion: !s.reducedMotion })} theme={theme} />
          </Row>
          <Row label={i18n.settings.textSize} theme={theme} fs={fs}>
            {(['s', 'm', 'l'] as const).map((t) => (
              <Pressable
                key={t}
                accessibilityRole="button"
                accessibilityState={{ selected: s.text === t }}
                accessibilityLabel={i18n.settings[t === 's' ? 'small' : t === 'm' ? 'medium' : 'large']}
                onPress={() => set({ text: t })}
                style={[styles.sizeBtn, { borderColor: s.text === t ? palette.brass : theme.lineStrong }]}
              >
                <Text style={[styles.sizeBtnText, { color: s.text === t ? palette.brass : theme.fgDim, fontSize: fs.sm }]}>
                  {i18n.settings[t === 's' ? 'small' : t === 'm' ? 'medium' : 'large']}
                </Text>
              </Pressable>
            ))}
          </Row>
          <Row label={i18n.settings.autoNotes} theme={theme} fs={fs}>
            <SettingToggle on={s.autoNotes} label={i18n.settings.autoNotes} onToggle={() => set({ autoNotes: !s.autoNotes })} theme={theme} />
          </Row>
          <Row label={i18n.settings.highlights} theme={theme} fs={fs}>
            <SettingToggle on={s.highlights} label={i18n.settings.highlights} onToggle={() => set({ highlights: !s.highlights })} theme={theme} />
          </Row>
          <Row label={i18n.settings.leftHand} theme={theme} fs={fs}>
            <SettingToggle on={s.leftHand} label={i18n.settings.leftHand} onToggle={() => set({ leftHand: !s.leftHand })} theme={theme} />
          </Row>
          <Row label={i18n.settings.language} theme={theme} fs={fs}>
            {/* the web's static EN — T14 keeps one dictionary; the structure is ready */}
            <Text style={[styles.staticEn, { color: theme.fgDim, fontSize: fs.sm }]}>EN</Text>
          </Row>
          <Row label={i18n.settings.telemetry} note={i18n.settings.telemetryNote} theme={theme} fs={fs}>
            <SettingToggle on={s.telemetry} label={i18n.settings.telemetry} onToggle={() => set({ telemetry: !s.telemetry })} theme={theme} />
          </Row>
        </View>

        {/* web section.panel: margin '10px 16px', padding 14 — about/privacy */}
        <View style={[styles.panel, { backgroundColor: theme.bgRaised, borderColor: theme.lineStrong }]}>
          <View style={[styles.ring, { borderColor: theme.line }]} pointerEvents="none" />
          <Text accessibilityRole="header" style={[styles.h2, { color: theme.fg, fontSize: fs.md }]}>
            {i18n.settings.about}
          </Text>
          <Text style={[styles.bodyGap, { color: theme.fgDim, fontSize: fs.sm }]}>{i18n.settings.aboutBody}</Text>
          <Text accessibilityRole="header" style={[styles.h3, { color: theme.fg, fontSize: fs.sm }]}>
            {i18n.settings.privacy}
          </Text>
          <Text style={[styles.body, { color: theme.fgDim, fontSize: fs.sm }]}>{i18n.settings.privacyBody}</Text>
        </View>

        {/* web section.panel: margin '10px 16px', padding 14 — export / import /
            delete (the stateful actions block, one file per the no-god-files law) */}
        <SettingsActions theme={theme} fs={fs} />

        {/* G13 — the tutorial replay row, carried verbatim from the Phase A stub */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={i18n.tutorial.relearn}
          onPress={() => go('tutorial', tutorialReplayPayload(duelNonce))}
          style={[styles.relearn, { backgroundColor: theme.bgRaised, borderColor: theme.lineStrong }]}
        >
          <Text style={[styles.relearnText, { color: theme.fg, fontSize: fs.md }]}>{i18n.tutorial.relearn}</Text>
        </Pressable>
      </ScrollView>
      <Ribbon />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  // web main.hub: paddingBottom 'calc(var(--ribbon-h) + var(--safe-bottom))' — the
  // Ribbon is in-flow here; the scroll's own padding keeps the last row clear
  scroll: { paddingBottom: 16 },
  // web header: '... 14px) 16px 4px'
  header: { paddingHorizontal: 16, paddingBottom: 4 },
  // web h1: font-display; the screen-title size is the port's fs.lg
  h1: { fontFamily: fonts.display },
  // web section.panel: margin '8px 16px', padding '6px 14px', radius, 1px line-strong
  panelFirst: {
    marginHorizontal: 16,
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderRadius: layout.radius,
  },
  // web section.panel: margin '10px 16px', padding 14
  panel: {
    marginHorizontal: 16,
    marginTop: 10,
    padding: 14,
    borderWidth: 1,
    borderRadius: layout.radius,
  },
  // web .panel::before: absolute inset 4, 1px var(--line), radius 2
  ring: { position: 'absolute', top: 4, left: 4, right: 4, bottom: 4, borderWidth: 1, borderRadius: 2 },
  // web Row: flex, gap 10, padding '8px 0', 1px var(--line) bottom border
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1 },
  rowText: { flex: 1 },
  // web <b style={{ fontFamily: 'var(--font-display)' }}>: the display face
  rowLabel: { fontFamily: fonts.display },
  // web note <p>: fs-xs, fg-dim
  rowNote: { fontFamily: fonts.body, marginTop: 2 },
  // web <b style={{ color: 'var(--brass)' }}>ON</b>: fs-xs
  staticOn: { fontFamily: fonts.body, fontWeight: '700' },
  // web <b style={{ color: 'var(--fg-dim)' }}>EN</b>: fs-sm
  staticEn: { fontFamily: fonts.body, fontWeight: '700' },
  // web textSize button: 1px brass/line-strong, minHeight 34, minWidth 34
  sizeBtn: {
    minHeight: 34,
    minWidth: 34,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderRadius: layout.radius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sizeBtnText: { fontFamily: fonts.body },
  // web h2: font-display, fs-md
  h2: { fontFamily: fonts.display },
  // web aboutBody <p>: fg-dim, fs-sm, margin '6px 0 10px'
  bodyGap: { fontFamily: fonts.body, marginTop: 6, marginBottom: 10 },
  // web h3: font-display, fs-sm
  h3: { fontFamily: fonts.display },
  // web privacyBody <p>: fg-dim, fs-sm
  body: { fontFamily: fonts.body },
  // G13 replay row: hub-card framing at the 44pt floor (the stub's law, verbatim)
  relearn: {
    minHeight: layout.touch,
    marginHorizontal: 16,
    marginTop: 10,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderWidth: 1,
    borderRadius: layout.radius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  relearnText: { fontFamily: fonts.display },
});
