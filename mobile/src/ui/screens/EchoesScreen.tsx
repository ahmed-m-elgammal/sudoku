// EchoesScreen (T7/T17/T19) — the shelf of stored ink-echoes. Each entry is a
// validated replay of a real duel; tapping one sets the session and enters a replay
// duel where the foe replays that Clerk's recorded ink.
// T17 — "Your Shade": your newest echo mined into a personal profile, so your own
// ink rises against you (fail-closed: faint ink → visible note, the calibrated
// standing Shade answers instead).
// T19 — sealed chits: an echo can be passed to another Clerk as an ASSIZE1- code.
// The privacy pass is structural: export redacts both names, import force-redacts
// again, so no chit — forged or honest — ever puts a name on a shelf.
//
// PORT of ../src/app/game/EchoesScreen.tsx (247 lines). The storage ring is
// @/game/echoes (the SQLite `duels` law) and the screen law it re-exports
// (describeEcho / minePersonalShade) — a screen may not import @shared/replay |
// personalShade directly (mobile/eslint.config.js LAW 3); @shared/echoShare and
// @shared/shade are not engine internals and ride in directly, as on the web.
// The two T19 modal sheets live in echoChitModals.tsx (the no-god-files law).
//
// Translation notes (the AGENTS.md platform table, nothing more):
//  - `synth.uiTap()` → `audio.uiTap()`; the web's clipboard ladder (navigator.clipboard
//    + execCommand fallback) → `clipboard.copy()` — the platform seam already carries
//    the degrade-to-manual-copy law the web modal implements;
//  - 'Shade of {name}' and the '→'/'←' glyphs are the web screen's own literals
//    (EchoesScreen.tsx:127/135/155/165/192) — carried verbatim, not reworded;
//  - the chit button's web minHeight is 36 px; the layout law's 44 pt floor
//    (layout.touch) wins here, as the fidelity table's only sanctioned touch fix.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUi } from '@/state/ui';
import { useSave } from '@/state/save';
import { audio } from '@/platform/audio';
import { useDisplaySettings } from '@/platform/display';
import { clipboard } from '@/platform/clipboard';
import { fonts, layout, palette, themeFor, type as typeScale } from '@/theme/tokens';
import { i18n, tf } from '@/i18n';
import {
  listEchoes, saveEcho, describeEcho, minePersonalShade,
  type EchoEntry, type MinedShade,
} from '@/game/echoes';
import { encodeEchoCode, decodeEchoCode } from '@shared/echoShare';
import { clampProfile, profileForStanding } from '@shared/shade';
import { SealedChitModal, ImportChitModal } from './echoChitModals';

export default function EchoesScreen() {
  const go = useUi((s) => s.go);
  const save = useSave((s) => s.save);
  const display = useDisplaySettings();
  const theme = useMemo(
    () => themeFor({ contrast: display.contrast, text: display.text }),
    [display.contrast, display.text],
  );
  const insets = useSafeAreaInsets();
  const fs = typeScale(theme.textScale);

  const [entries, setEntries] = useState<EchoEntry[] | null>(null); // null = loading
  const [chit, setChit] = useState<string | null>(null);            // sealed chit modal
  const [chitCopied, setChitCopied] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importNote, setImportNote] = useState<'ok' | 'bad' | null>(null);

  const refresh = useCallback(() => { void listEchoes().then((e) => setEntries(e)); }, []);
  useEffect(() => { refresh(); }, [refresh]);

  // your Shade lives in your newest ink — mined once per shelf render, purely
  const mined: MinedShade | null = useMemo(
    () => (entries && entries.length ? minePersonalShade(entries[0].replay) : null),
    [entries],
  );

  const duelYourShade = () => {
    audio.uiTap();
    const newest = entries?.[0];
    if (!newest) return;
    // fail-closed: a faint echo still duels — the calibrated Shade wears the name
    const profile = mined?.profile ?? clampProfile({
      ...profileForStanding(save?.standing ?? 1000),
      name: `Shade of ${newest.replay.names[0]}`,
      order: newest.replay.orders[0],
    });
    go('duel', { duelMode: 'shade', pendingPersonalShade: { replay: newest.replay, profile }, campaignDuel: null });
  };

  const sealChit = async (e: EchoEntry) => {
    audio.uiTap();
    const code = encodeEchoCode(e.replay); // privacy pass: names never leave the device
    if (!code) return;
    setChit(code);
    setChitCopied(false);
    const ok = await clipboard.copy(code);
    if (ok) setChitCopied(true);
  };

  const importChit = async () => {
    const replay = decodeEchoCode(importText); // fail-closed; import re-redacts names
    if (!replay) { setImportNote('bad'); return; }
    const saved = await saveEcho(replay, { imported: true });
    setImportNote(saved ? 'ok' : 'bad');
    if (saved) {
      setImportText('');
      setImportOpen(false);
      refresh();
    }
  };

  const statsLine = (m: MinedShade): string =>
    tf('echoes.yourShadeStats', {
      pace: ((m.profile.placeCadenceMs ?? 0) / 1000).toFixed(1),
      err: String(Math.round((m.telemetry.wrong / Math.max(1, m.telemetry.placements)) * 100)),
      rites: String(m.telemetry.casts),
    });

  return (
    <View style={[styles.root, { backgroundColor: theme.bg }]}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 18, paddingBottom: insets.bottom + 24 }]}>
        {/* web header: flex baseline, gap 10, marginBottom 8 */}
        <View style={styles.header}>
          <Text accessibilityRole="header" style={[styles.title, { color: theme.fg, fontSize: fs.lg }]}>
            {i18n.echoes.title}
          </Text>
          {entries && entries.length > 0 && (
            <Text style={[styles.count, { color: theme.fgDim, fontSize: fs.xs }]}>
              {tf('echoes.count', { n: entries.length })}
            </Text>
          )}
        </View>
        <Text style={[styles.sub, { color: theme.fgDim, fontSize: fs.sm }]}>{i18n.echoes.sub}</Text>

        {entries === null && (
          <Text style={[styles.dimLine, { color: theme.fgDim, fontSize: fs.sm }]}>…</Text>
        )}

        {/* T17 — Your Shade, raised from the newest ink on the shelf (web: accent border) */}
        {entries !== null && entries.length > 0 && (
          <View style={[styles.panel, styles.shadeCard, { backgroundColor: theme.bgRaised, borderColor: theme.accent }]}>
            <View style={[styles.ring, { borderColor: theme.line }]} pointerEvents="none" />
            <Text style={[styles.cardTitle, { color: theme.fg, fontSize: fs.md }]}>{i18n.echoes.yourShadeTitle}</Text>
            <Text style={[styles.dim, { color: theme.fgDim, fontSize: fs.xs, marginTop: 4 }]}>{i18n.echoes.yourShadeSub}</Text>
            <Text style={[styles.dim, { color: mined ? theme.fg : theme.fgDim, fontSize: fs.xs, marginTop: 6 }]}>
              {mined
                ? `Shade of ${entries[0].replay.names[0]} · ${statsLine(mined)}`
                : i18n.echoes.yourShadeFaint}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={i18n.echoes.yourShadeDuel}
              onPress={duelYourShade}
              style={({ pressed }) => [styles.primary, { opacity: pressed ? 0.82 : 1 }]}
            >
              <Text style={[styles.btnText, { color: palette.parchmentLight, fontSize: fs.md }]}>
                {i18n.echoes.yourShadeDuel} →
              </Text>
            </Pressable>
          </View>
        )}

        {entries !== null && entries.length === 0 && (
          <View style={[styles.panel, styles.empty, { backgroundColor: theme.bgRaised, borderColor: theme.lineStrong }]}>
            <Text style={[styles.dim, { color: theme.fgDim, fontSize: fs.sm }]}>{i18n.echoes.empty}</Text>
          </View>
        )}

        {/* the shelf — web div grid gap 10, maxWidth 560 */}
        <View style={styles.column}>
          {(entries ?? []).map((e) => (
            <View
              key={e.key}
              style={[styles.panel, styles.card, { backgroundColor: theme.bgRaised, borderColor: theme.lineStrong }]}
            >
              <View style={[styles.ring, { borderColor: theme.line }]} pointerEvents="none" />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${i18n.echoes.duel}: ${e.replay.names[0]}`}
                onPress={() => {
                  audio.uiTap();
                  go('duel', { duelMode: 'replay', pendingEcho: e.replay, campaignDuel: null });
                }}
                style={styles.cardBody}
              >
                <View style={styles.titleRow}>
                  <Text style={[styles.cardTitle, { color: theme.fg, fontSize: fs.md }]}>
                    Shade of {e.replay.names[0]}
                  </Text>
                  {e.imported && (
                    <Text style={[styles.badge, { color: theme.fgDim, borderColor: theme.fgDim, fontSize: fs.xs }]}>
                      {i18n.echoes.chitBadge}
                    </Text>
                  )}
                </View>
                <Text style={[styles.dim, { color: theme.fgDim, fontSize: fs.xs }]}>
                  {describeEcho(e.replay)} · {e.replay.orders[0]} vs {e.replay.orders[1]}
                </Text>
                <Text style={[styles.duelLink, { color: theme.accent, fontSize: fs.xs, marginTop: 6 }]}>
                  {i18n.echoes.duel} →
                </Text>
              </Pressable>
              {/* T19 — seal this echo into a shareable chit (names redacted) */}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={i18n.echoes.sealChit}
                onPress={() => void sealChit(e)}
                style={({ pressed }) => [styles.chitBtn, { borderColor: theme.fgDim, opacity: pressed ? 0.85 : 1 }]}
              >
                <Text style={[styles.dim, { color: theme.fgDim, fontSize: fs.xs }]}>{i18n.echoes.sealChit}</Text>
              </Pressable>
            </View>
          ))}
        </View>

        {/* T19 — import a chit another Clerk sealed */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={i18n.echoes.importChit}
          onPress={() => { audio.uiTap(); setImportOpen(true); setImportNote(null); }}
          style={({ pressed }) => [
            styles.panel, styles.wideBtn,
            { backgroundColor: theme.bgRaised, borderColor: theme.lineStrong, marginTop: 14, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Text style={[styles.dim, { color: theme.fg, fontSize: fs.sm }]}>{i18n.echoes.importChit}</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={i18n.echoes.back}
          onPress={() => { audio.uiTap(); go('antechamber'); }}
          style={({ pressed }) => [
            styles.panel, styles.wideBtn,
            { backgroundColor: theme.bgRaised, borderColor: theme.lineStrong, marginTop: 12, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Text style={[styles.dim, { color: theme.fgDim, fontSize: fs.sm }]}>← {i18n.echoes.back}</Text>
        </Pressable>
      </ScrollView>

      {/* the sealed chit: copy-paste payload, no names inside */}
      {chit !== null && (
        <SealedChitModal
          chit={chit}
          copied={chitCopied}
          theme={theme}
          fs={fs}
          onCopy={() => { void clipboard.copy(chit).then((ok) => setChitCopied(ok || chitCopied)); }}
          onClose={() => { setChit(null); setChitCopied(false); }}
        />
      )}

      {/* T19 — break a chit: the two-way privacy pass redacts on the way in, always */}
      {importOpen && (
        <ImportChitModal
          text={importText}
          note={importNote}
          theme={theme}
          fs={fs}
          onChangeText={(t) => { setImportText(t); setImportNote(null); }}
          onImport={() => void importChit()}
          onClose={() => { setImportOpen(false); setImportNote(null); }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  // web main.page-turn: padding 'calc(var(--safe-top) + 18px) 16px calc(var(--safe-bottom) + 24px)'
  scroll: { paddingHorizontal: 16 },
  header: { flexDirection: 'row', alignItems: 'baseline', gap: 10, marginBottom: 8 },
  title: { fontFamily: fonts.display },
  count: { fontFamily: fonts.body },
  // web p: color fg-dim, fs-sm, maxWidth 520, marginBottom 14
  sub: { fontFamily: fonts.body, maxWidth: 520, marginBottom: 14 },
  dimLine: { fontFamily: fonts.body },
  // web .panel.card, maxWidth 560, marginBottom 14, borderColor var(--accent)
  shadeCard: { width: '100%', maxWidth: 560, marginBottom: 14, alignSelf: 'center' },
  column: { gap: 10, width: '100%', maxWidth: 560, alignSelf: 'center' },
  // web .panel.card: padding '12px 14px', textAlign left
  card: { paddingVertical: 12, paddingHorizontal: 14 },
  empty: { padding: 16 },
  panel: { borderWidth: 1, borderRadius: layout.radius },
  ring: { position: 'absolute', top: 4, left: 4, right: 4, bottom: 4, borderWidth: 1, borderRadius: 2 },
  cardTitle: { fontFamily: fonts.display },
  dim: { fontFamily: fonts.body },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  // web imported badge: 1px fg-dim border, radius 4, padding '1px 6px'
  badge: { borderWidth: 1, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 1, fontFamily: fonts.body },
  cardBody: { padding: 0 },
  duelLink: { fontFamily: fonts.body },
  // web seal-chit button: marginTop 8, minHeight 36 — raised to the 44 pt floor
  chitBtn: { marginTop: 8, minHeight: layout.touch, borderWidth: 1, borderRadius: layout.radiusLg, paddingHorizontal: 10, paddingVertical: 4, alignItems: 'flex-start', justifyContent: 'center' },
  // web import/back buttons: .panel.card, maxWidth 560, width 100%, centered
  wideBtn: { width: '100%', maxWidth: 560, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', minHeight: layout.touch, paddingVertical: 12, paddingHorizontal: 16 },
  // web .btn.btn-primary: marginTop 10, width 100%, minHeight 44
  primary: {
    marginTop: 10,
    width: '100%',
    minHeight: layout.touch,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderColor: palette.brass,
    borderRadius: layout.radius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: { fontFamily: fonts.display },
});
