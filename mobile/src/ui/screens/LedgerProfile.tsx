// LedgerProfile — S17 "The Great Ledger": name edit, rank emblem, Standing graph,
// win rate by Order, Marginalia (the dictionary's achievements), the last 20 pleas
// with the Shade tag, the Recovery Code, and save export/import (spec §7, §17;
// specs/17 phase 5.6).
//
// PORT of ../src/app/game/LedgerProfile.tsx (221 lines). The pinned math — the
// spark line, the win-rate percentiles, the recent cap, the T13 server-Ink audit
// guard, the recovery max law and the v:2 import contract — lives in ledgerLaw.ts
// so the gate can hold it; the art requires live in ledgerArt.ts (the cabinetArt
// seam, Metro-only); the recovery flows live in ledgerRecovery.tsx (the
// friendPanels split — this screen composes, it does not own the state).
//
// Translation notes (the AGENTS.md platform table, nothing more):
//  - the spark <svg><polyline> rides react-native-svg at the web's exact geometry
//    (0..280 × 0..70 points, 76 tall, brass 1.5) — width 100% preserved;
//  - `<input>`/`<code className="digits">` → fonts.digit; `<b>` → the body face at
//    fontWeight '700' (the DailyScreen translation; RN cannot synthesize weights
//    for the registered serif, the tokens file's digitBold is the digital face);
//  - the serverInk line's trailing lowercase 'ink' is the web screen's own literal
//    (LedgerProfile.tsx:73 — the dictionary's common.ink is capitalised), carried
//    verbatim;
//  - the win-rate Order names are the web's raw row keys with the CSS
//    textTransform: 'capitalize' — the same literals, capitalised the same way;
//  - 'endless-ten' has no achievement art (the web <img> renders a broken image);
//    the port degrades identically — no art, the title still tells;
//  - the web's `if (!save) return null;` sits ABOVE its hooks — a rules-of-hooks
//    hazard should the ledger ever mount pre-load (React throws on the hook-count
//    change). Reported quirk, NOT carried: the guard moves below the hooks, the
//    standard order this codebase's screens already use. No behaviour change.
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Art from '@/ui/Art';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSave } from '@/state/save';
import { loadIdentity, saveIdentity } from '@/state/identity';
import { net } from '@/game/net/client';
import { audio } from '@/platform/audio';
import { useDisplaySettings } from '@/platform/display';
import { fonts, layout, palette, themeFor, type as typeScale } from '@/theme/tokens';
import { i18n } from '@/i18n';
import Ribbon from '@/ui/Ribbon';
import { rankOfStanding } from './rank';
import { achievementArt, rankArt } from './ledgerArt';
import RecoverySection from './ledgerRecovery';
import StandingGraph from './ledgerGraph';
import { NAME_MAX, RECENT_CAP, WIN_RATE_ORDERS, serverInkFrom, winRatePct } from './ledgerLaw';

export default function LedgerProfile() {
  const save = useSave((s) => s.save);
  const display = useDisplaySettings();
  const theme = useMemo(
    () => themeFor({ contrast: display.contrast, text: display.text }),
    [display.contrast, display.text],
  );
  const insets = useSafeAreaInsets();
  const fs = typeScale(theme.textScale);
  const [name, setName] = useState('');
  const [serverInk, setServerInk] = useState<number | null>(null);
  // the input mirrors save.name until the player edits it — the web's
  // useEffect(() => setName(save.name), [save.name]) expressed as the render-phase
  // derivation this repo's react-hooks/set-state-in-effect rule demands
  const [syncedName, setSyncedName] = useState<string | null>(null);
  if (save && save.name !== syncedName) {
    setSyncedName(save.name);
    setName(save.name);
  }

  // T13 — the server-known Ink balance: a quiet auth on mount, shown for auditability
  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const id = await loadIdentity();
        const res = await net.auth({ id: id.id, secret: id.secret, name: id.name });
        if (live) setServerInk(serverInkFrom(res));
      } catch { /* offline: the line simply stays hidden */ }
    })();
    return () => { live = false; };
  }, []);

  if (!save) return null;
  const rank = rankOfStanding(save.standing);
  const achievements = Object.entries(i18n.achievements) as [string, { title: string; desc: string }][];
  // web ul: 2-col grid → rows of two flex:1 cells (the hub's pair translation)
  const achRows: (typeof achievements)[] = [];
  for (let i = 0; i < achievements.length; i += 2) achRows.push(achievements.slice(i, i + 2) as (typeof achievements));

  const rename = async () => {
    audio.uiTap();
    useSave.getState().update((s) => ({ ...s, name }));
    const id = await loadIdentity();
    id.name = name;
    await saveIdentity(id);
    void net.auth({ id: id.id, secret: id.secret, name });
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.bg }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* web header: padding 'calc(var(--safe-top) + 14px) 16px 6px' */}
        <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
          <Text accessibilityRole="header" style={[styles.h1, { color: theme.fg, fontSize: fs.lg }]}>
            {i18n.ledger.title}
          </Text>
          <View style={[styles.nameRow, { marginTop: 8 }]}>
            <TextInput
              value={name}
              onChangeText={setName}
              maxLength={NAME_MAX}
              accessibilityLabel={i18n.ledger.nameEdit}
              style={[styles.nameInput, { backgroundColor: palette.charcoal, borderColor: theme.lineStrong, color: theme.fg, fontSize: fs.md }]}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={i18n.ledger.rename}
              onPress={() => { void rename(); }}
              style={[styles.renameBtn, { borderColor: palette.brassDim, backgroundColor: palette.charcoal }]}
            >
              <Text style={[styles.renameText, { color: theme.fg, fontSize: fs.md, letterSpacing: 0.06 * fs.md }]}>
                {i18n.ledger.rename}
              </Text>
            </Pressable>
          </View>
          <View style={[styles.rankRow, { marginTop: 10 }]}>
            {rankArt(rank.id) ? <Art uri={rankArt(rank.id)} width={28} height={28} /> : null}
            <Text style={[styles.body, { color: theme.fgDim, fontSize: fs.md }]}>
              {rank.label}{rank.division ? ` · ${rank.division}` : ''} · {i18n.ledger.standing} {save.standing}
            </Text>
          </View>
          {serverInk !== null && (
            // the trailing lowercase 'ink' is the web screen's own literal (see header)
            <Text style={[styles.body, { color: theme.fgDim, fontSize: fs.sm, marginTop: 4 }]}>
              {i18n.ledger.serverInk} <Text style={styles.digits}>{serverInk}</Text> ink
            </Text>
          )}
        </View>

        {/* web section.panel: margin '8px 16px', padding 12 — the graph + counters live in ledgerGraph */}
        <View style={styles.sectionFirst}>
          <StandingGraph
            history={save.stats.standingHistory}
            stats={{
              duels: save.stats.duels,
              wins: save.stats.wins,
              losses: save.stats.losses,
              longestStreak: save.stats.longestStreak,
            }}
            theme={theme}
            fs={fs}
          />
        </View>

        {/* web section.panel: margin '10px 16px', padding 12 */}
        <View style={[styles.section, { backgroundColor: theme.bgRaised, borderColor: theme.lineStrong }]}>
          <View style={[styles.ring, { borderColor: theme.line }]} pointerEvents="none" />
          <Text accessibilityRole="header" style={[styles.h2, { color: theme.fg, fontSize: fs.md, letterSpacing: 0.02 * fs.md }]}>
            {i18n.ledger.winRate}
          </Text>
          <View style={[styles.orderList, { marginTop: 6 }]}>
            {WIN_RATE_ORDERS.map((o) => {
              const pct = winRatePct(save.stats.byOrder, o);
              return (
                // web li: grid '90px 1fr 40px', gap 8, padding '3px 0'
                <View key={o} style={styles.orderRow}>
                  <Text style={[styles.orderName, { color: theme.fg, fontSize: fs.sm, width: 90 }]}>{o}</Text>
                  <View style={[styles.orderBar, { backgroundColor: theme.bgSunken }]}>
                    <View style={[styles.orderFill, { width: `${pct}%`, backgroundColor: palette.brass }]} />
                  </View>
                  <Text style={[styles.orderPct, { color: theme.fg, fontSize: fs.sm, width: 40 }]}>{pct}%</Text>
                </View>
              );
            })}
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: theme.bgRaised, borderColor: theme.lineStrong }]}>
          <View style={[styles.ring, { borderColor: theme.line }]} pointerEvents="none" />
          <Text accessibilityRole="header" style={[styles.h2, { color: theme.fg, fontSize: fs.md, letterSpacing: 0.02 * fs.md }]}>
            {i18n.ledger.achievements}
          </Text>
          {/* web ul: 2-col grid, gap 8, marginTop 8 */}
          <View style={[styles.achGrid, { marginTop: 8 }]}>
            {achRows.map((row, ri) => (
              <View key={ri} style={styles.achRow}>
                {row.map(([id, a]) => {
                  const got = !!save.achievements[id];
                  return (
                    // web li: flex, gap 8, center; opacity got ? 1 : 0.45
                    <View key={id} style={[styles.achCell, { opacity: got ? 1 : 0.45 }]}>
                      {achievementArt(id) ? <Art uri={achievementArt(id)} width={30} height={30} /> : null}
                      <View style={styles.achText}>
                        <Text style={[styles.achTitle, { color: theme.fg, fontSize: fs.sm }]}>{a.title}</Text>
                        <Text style={[styles.achDesc, { color: theme.fgDim, fontSize: fs.xs }]}>{a.desc}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            ))}
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: theme.bgRaised, borderColor: theme.lineStrong }]}>
          <View style={[styles.ring, { borderColor: theme.line }]} pointerEvents="none" />
          <Text accessibilityRole="header" style={[styles.h2, { color: theme.fg, fontSize: fs.md, letterSpacing: 0.02 * fs.md }]}>
            {i18n.ledger.recent}
          </Text>
          <View style={[styles.recentList, { marginTop: 6 }]}>
            {save.stats.recent.slice(0, RECENT_CAP).map((d, i) => (
              // web li: flex, gap 8, padding '4px 0', 1px var(--line) bottom border
              <View key={i} style={[styles.recentRow, { borderBottomColor: theme.line }]}>
                <Text
                  style={[
                    styles.recentResult,
                    {
                      color: d.result === 'w' ? palette.brass : d.result === 'l' ? palette.oxblood : theme.fgDim,
                      fontSize: fs.sm,
                    },
                  ]}
                >
                  {d.result.toUpperCase()}
                </Text>
                <Text
                  numberOfLines={1}
                  ellipsizeMode="tail"
                  style={[styles.recentFoe, { color: theme.fg, fontSize: fs.sm }]}
                >
                  vs {d.foe}
                </Text>
                <Text style={[styles.recentTag, { color: d.shade ? palette.ash : theme.fgDim, fontSize: fs.xs }]}>
                  {d.shade ? i18n.ledger.shadeTag : i18n.ledger.humanTag}
                </Text>
              </View>
            ))}
            {save.stats.recent.length === 0 && (
              <Text style={[styles.recentEmpty, { color: theme.fgDim, fontSize: fs.sm }]}>{i18n.common.empty}</Text>
            )}
          </View>
        </View>

        <RecoverySection save={save} theme={theme} fs={fs} />
      </ScrollView>
      <Ribbon />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingBottom: 16 },
  // web header: '... 14px) 16px 6px'
  header: { paddingHorizontal: 16, paddingBottom: 6 },
  // web h1: font-display, 0.02em tracking (the screen-title size is the port's fs.lg)
  h1: { fontFamily: fonts.display, letterSpacing: 0.02 },
  // web div flex gap 8
  nameRow: { flexDirection: 'row', gap: 8 },
  // web input: flex 1, 1px line-strong, padding '8px 10px', font-body
  nameInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: layout.radius,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontFamily: fonts.body,
  },
  // web .btn: 1.5px brass-dim, radius, padding '10px 18px' → the 44 pt floor
  renameBtn: {
    minHeight: layout.touch,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderRadius: layout.radius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  renameText: { fontFamily: fonts.display },
  // web p flex center gap 8
  rankRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  body: { fontFamily: fonts.body },
  // web h2: font-display, fs-md (0.02em tracking rides the inline style)
  h2: { fontFamily: fonts.display },
  digits: { fontFamily: fonts.digit },
  // web section.panel: margin '10px 16px', padding 12, radius, 1px line-strong
  section: {
    marginHorizontal: 16,
    marginTop: 10,
    padding: 12,
    borderWidth: 1,
    borderRadius: layout.radius,
  },
  // the graph panel sits at 8px per the web's inline margin (the others at 10)
  sectionFirst: { marginTop: 8 },
  // web .panel::before: absolute inset 4, 1px var(--line), radius 2
  ring: { position: 'absolute', top: 4, left: 4, right: 4, bottom: 4, borderWidth: 1, borderRadius: 2 },
  // web ul marginTop 6
  orderList: { gap: 0 },
  // web li: grid '90px 1fr 40px', gap 8, padding '3px 0'
  orderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 3 },
  // the web span's textTransform: 'capitalize'
  orderName: { fontFamily: fonts.body, textTransform: 'capitalize' },
  // web div: height 6, charcoal-2 ground
  orderBar: { flex: 1, height: 6 },
  orderFill: { height: '100%' },
  orderPct: { fontFamily: fonts.digit, textAlign: 'right' },
  // web ul: grid 2 cols, gap 8
  achGrid: { gap: 8 },
  achRow: { flexDirection: 'row', gap: 8 },
  achCell: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  achText: { flex: 1, minWidth: 0 },
  // web <b>: the body face at 700 (the DailyScreen translation)
  achTitle: { fontFamily: fonts.body, fontWeight: '700' },
  achDesc: { fontFamily: fonts.body },
  recentList: { gap: 0 },
  // web li: flex gap 8 padding '4px 0', 1px line bottom
  recentRow: { flexDirection: 'row', gap: 8, paddingVertical: 4, borderBottomWidth: 1 },
  // web <b style={{ width: 16 }}>: brass / oxblood / fg-dim (colors ride inline)
  recentResult: { fontFamily: fonts.body, fontWeight: '700', width: 16 },
  // web span: flex 1, ellipsis, nowrap
  recentFoe: { fontFamily: fonts.body, flex: 1 },
  // web <small>: fs-xs, ash when a Shade, fg-dim otherwise
  recentTag: { fontFamily: fonts.body },
  // web li: fg-dim italic
  recentEmpty: { fontFamily: fonts.bodyItalic },
});
