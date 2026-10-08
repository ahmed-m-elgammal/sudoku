// NumPad.tsx — the five-by-two numeral grid plus Erase.
//
// PORT of ../src/app/game/NumPad.tsx. Same law: tap a numeral to place (or, in pencil
// mode, to toggle a note), the remaining-count of each digit lives in the corner, a digit
// with all nine placed goes dead, and Hush kills the whole pad.
//
// J3 — the pad is one of the three GATED placement surfaces: during the ~100 ms hit-stop
// and the 300 ms verdict beat, taps are swallowed, never queued. The engine never waits.
// J4 — a warm wash rides the pad, opacity driven by the duel root's heat.
//
// Layout note: the web pad was a CSS grid `repeat(5, 1fr) x repeat(2, ...)`. RN has no
// grid, so the 10 tiles are laid out as two explicit rows of five — same geometry, same
// order, same 44 pt minimum targets.

import { Pressable, StyleSheet, Text, View } from 'react-native';
import Art from '@/ui/Art';
import type { DuelRuntime } from '@/game/duelRuntime';
import type { Digit } from '@shared/config';
import { duelArt } from './duelAssets';
import { i18n, tf } from '@/i18n';
import { fonts, layout, type Theme } from '@/theme/tokens';

export interface NumPadProps {
  duel: DuelRuntime;
  /** J3 — the freeze */
  frozen: boolean;
  /** J4 — 0..1, drives the warm wash */
  heat: number;
  theme: Theme;
  onTap: () => void;
}

export default function NumPad({ duel, frozen, heat, theme, onTap }: NumPadProps) {
  const me = duel.state.players[0];
  const flags = duel.flags();
  const pencil = duel.pencil;
  const hushed = flags.hushed;

  // How many of each digit are already on the board (givens + placed).
  const counts = new Array<number>(10).fill(0);
  for (let c = 0; c < 81; c++) {
    const v = me.board[c];
    if (v !== 0) counts[v]++;
  }

  const place = (d: Digit) => {
    // J3 — the freeze swallows taps.
    if (frozen) return;
    onTap();
    if (duel.selected === null) return;
    if (pencil && !flags.miasma) duel.toggleNote(duel.selected, d);
    else duel.place(duel.selected, d);
  };

  const erase = () => {
    if (frozen) return;
    onTap();
    if (duel.selected === null) return;
    duel.setNotes(duel.selected, []);
    duel.select(duel.selected);
  };

  const row = [1, 2, 3, 4, 5] as const;

  return (
    <View
      accessibilityRole="toolbar"
      accessibilityLabel={i18n.duel.pad.label}
      style={styles.pad}
    >
      {[row, [6, 7, 8, 9] as const].map((digits, rowIdx) => (
        <View key={rowIdx} style={styles.row}>
          {digits.map((n) => {
            const remaining = 9 - counts[n];
            const complete = remaining <= 0;
            const d = n as Digit;
            return (
              <Pressable
                key={d}
                disabled={complete}
                onPress={() => place(d)}
                accessibilityRole="button"
                accessibilityState={{ disabled: complete }}
                accessibilityLabel={`${d}, ${complete ? i18n.duel.pad.complete : tf('duel.pad.remaining', { n: remaining })}${pencil ? `, ${i18n.duel.pad.pencil}` : ''}`}
                style={[
                  styles.tile,
                  { borderColor: theme.lineStrong, backgroundColor: theme.bgRaised },
                  complete && styles.complete,
                ]}
              >
                <View style={StyleSheet.absoluteFill} pointerEvents="none">
                  <Art
                    width="100%"
                    height="100%"
                    uri={complete ? duelArt.numTileComplete : duelArt.numTileNormal}
                    opacity={theme.tileArtAlpha}
                  />
                </View>
                <Text style={[styles.digit, { color: theme.fg }]} allowFontScaling={false}>
                  {d}
                </Text>
                <Text style={[styles.count, { color: theme.fgDim }]} allowFontScaling={false}>
                  {complete ? i18n.duel.pad.spent : remaining}
                </Text>
              </Pressable>
            );
          })}
          {rowIdx === 1 ? (
            <Pressable
              onPress={erase}
              accessibilityRole="button"
              accessibilityLabel={i18n.duel.pad.erase}
              style={[styles.tile, { borderColor: theme.lineStrong, backgroundColor: theme.bgRaised }]}
            >
              <View style={StyleSheet.absoluteFill} pointerEvents="none">
                <Art width="100%" height="100%" uri={duelArt.numTileNormal} opacity={theme.tileArtAlpha} />
              </View>
              <Text style={[styles.digit, { color: theme.fg }]} allowFontScaling={false}>
                {i18n.duel.pad.eraseGlyph}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ))}

      {/* J4 — the pad warms with the room. */}
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, styles.warm, { backgroundColor: theme.heatWash, opacity: heat * theme.heatWashAlpha }]}
      />

      {hushed ? (
        <View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, styles.hush, { backgroundColor: theme.hushVeil }]}
        >
          <Art width={130} height={130} uri={duelArt.overlayHush} />
          <Text style={[styles.hushText, { color: theme.fg }]}>{i18n.duel.status.hush}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { position: 'relative' },
  row: { flexDirection: 'row', gap: 5, marginBottom: 5 },
  tile: {
    flex: 1,
    height: 48,
    borderWidth: 1.5,
    borderRadius: layout.radius,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  complete: { opacity: 0.38 },
  digit: { fontFamily: fonts.digit, fontSize: 22 },
  count: { position: 'absolute', bottom: 2, right: 4, fontSize: 9 },
  warm: { borderRadius: layout.radius },
  hush: { alignItems: 'center', justifyContent: 'center', gap: 4 },
  hushText: { fontFamily: fonts.display, letterSpacing: 1 },
});