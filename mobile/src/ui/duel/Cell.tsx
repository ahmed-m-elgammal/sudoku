// Cell.tsx — one square of the sealed Tablet.
//
// Split out of Board for one reason only: there are 81 of these and the duel re-renders
// on every engine push (~15 fps). Each cell is `React.memo`'d on the exact set of values
// it draws, so a placement re-renders ONE cell and its nine cascade siblings, not the
// whole grid (risk R4). If this component's props ever grow to "the whole duel", that
// memoisation is dead and the board will jank — that is the thing to watch.
//
// PORT of the `<button role="gridcell">` block in ../src/app/game/Board.tsx.
// Presentation law (territory ownership, cascade membership, the hit-stop push origin)
// still comes from `@/game/fx` — Board calls it and passes plain values in. This file
// only APPLIES what it is handed.

import { memo, useEffect, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import Art from '@/ui/Art';
import { ROW_OF, COL_OF, BOX_OF } from '@shared/config';
import { duelArt } from './duelAssets';
import { floodDelayMs } from './motionLaw';
import { FLOOD_ANIM_MS } from '@/game/fx';
import { useMotionReduced } from '@/platform/display';
import { fonts, palette, type Theme } from '@/theme/tokens';

// The push and the wash animate the cell itself, so the pressable is the animated host.
// Created at module level: a fresh component type per render would remount every cell.
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface CellProps {
  /** the cell index, 0..80 */
  c: number;
  /** 0 = empty, 1..9 = ink */
  v: number;
  isGiven: boolean;
  isSel: boolean;
  sameDigit: boolean;
  chained: boolean;
  smudged: boolean;
  /** Miasma: notes are erased and the pencil is barred */
  miasma: boolean;
  wrongNow: boolean;
  /** 0,1,2 — which of the three strike assets to show */
  wrongVariant: number;
  /** the pencil's marks on this cell, 1..9 */
  notes: readonly number[];
  /** J1 — this cell's index in the current flood cascade, or -1 */
  floodIndex: number;
  /** J1 — the flood's event seq; the retrigger identity (the web's A/B nonce parity) */
  floodSeq: number;
  /** J3 — the verdict beat: the cascade delay stretches by FLOOD_SLOW */
  floodSlow: boolean;
  /** J1 — who owns the flooding unit (the tint source) */
  floodPlayer: 0 | 1 | null;
  /** J4 — the viewer is behind: their ink desaturates */
  cold: boolean;
  /** J1 — the settled territory tint for this cell, or null when unclaimed */
  ownedSettle: string | null;
  /** J3 — this cell's index in the hit-stop push, or -1 */
  pushIndex: number;
  /** J3 — the push's transform-origin in percent; may exceed 100 by design */
  pushOrigin: { x: number; y: number } | null;
  /** J3 — hit-stop / verdict: placement surfaces are gated */
  frozen: boolean;
  theme: Theme;
  onPress: (c: number) => void;
}

/**
 * The accessibility string the web build produced (`cellAria` in Board.tsx). Ported
 * verbatim — same words, same order. This is the contract every board cell carries.
 */
export function cellAria(c: number, v: number, isGiven: boolean, chained: boolean, smudged: boolean) {
  const r = ROW_OF(c) + 1;
  const col = COL_OF(c) + 1;
  let s = `Row ${r}, column ${col}, `;
  if (isGiven) s += `given ${v}`;
  else if (v) s += smudged ? 'placed digit smudged' : `placed ${v}`;
  else s += chained ? 'empty, chained' : 'empty';
  return s;
}

function CellImpl({
  c, v, isGiven, isSel, sameDigit, chained, smudged, miasma,
  wrongNow, wrongVariant, notes, floodIndex, floodPlayer, floodSeq, floodSlow,
  cold, ownedSettle, pushIndex, pushOrigin, frozen, theme, onPress,
}: CellProps) {
  const motionReduced = useMotionReduced();
  const canSelect = !isGiven && !chained;
  const r = ROW_OF(c);
  const col = COL_OF(c);
  const flooding = floodIndex >= 0 && floodPlayer !== null;

  // J3 — the hit-stop push rides on the CELL ITSELF. The web build put `unitPush`
  // (100 ms ease-out: scale 1 -> 1.04 at 35% -> back to 1, around the unit's centroid)
  // on the <button>; the first port scaled an empty overlay instead, which is why the
  // push never showed on real content. JS-driven on purpose: 100 ms on nine cells is
  // nothing, and the JS pipeline is what composes `transformOrigin` reliably.
  const [pushAnim] = useState(() => new Animated.Value(0));
  // The origin NUMBERS are the retrigger identity — pushOrigin's object identity
  // churns on every Board push, the values only move when the pushed unit moves.
  const pushKey = pushOrigin ? `${pushIndex}:${pushOrigin.x}:${pushOrigin.y}` : 'rest';
  useEffect(() => {
    if (motionReduced || pushKey === 'rest') return; // kill-list: no push, settled at scale 1
    pushAnim.setValue(0);
    const timing = Animated.timing(pushAnim, {
      toValue: 1,
      duration: 100,
      easing: Easing.out(Easing.ease),
      useNativeDriver: false,
    });
    timing.start();
    return () => timing.stop();
  }, [pushAnim, pushKey, motionReduced]);
  const pushScale = pushAnim.interpolate({ inputRange: [0, 0.35, 1], outputRange: [1, 1.04, 1] });
  const pushStyle =
    !motionReduced && pushOrigin
      ? { transformOrigin: `${pushOrigin.x}% ${pushOrigin.y}%`, transform: [{ scale: pushScale }] }
      : null;

  return (
    <AnimatedPressable
      // PLATFORM TRANSLATION: the web cell was `<button role="gridcell">`. RN's
      // AccessibilityRole has no `gridcell`, so the button role is kept — which is what
      // it actually was — and the `cellAria` label carries the gridcell's position and
      // contents. VoiceOver announces: "Row 3, column 7, empty, button".
      accessibilityRole="button"
      accessibilityLabel={cellAria(c, v, isGiven, chained, smudged)}
      accessibilityState={{ disabled: !canSelect, selected: isSel }}
      disabled={!canSelect}
      // J3 — the freeze swallows taps for ~100 ms; the engine never waits.
      onPress={() => { if (!frozen) onPress(c); }}
      style={[
        styles.cell,
        {
          backgroundColor:
            ownedSettle ??
            (isSel
              ? theme.cellSelected
              : sameDigit
                ? theme.cellSameDigit
                : undefined),
          // web `.cell` draws an OPAQUE 1px var(--ink) grid line — the hairline was 2× too faint
          borderColor: isSel ? palette.brass : palette.ink,
          borderWidth: isSel ? 2 : StyleSheet.hairlineWidth,
        },
        BOX_OF(c) % 2 === 0 && !ownedSettle && !isSel && !sameDigit && styles.boxEven,
        r % 3 === 2 && r < 8 && styles.thickBottom,
        col % 3 === 2 && col < 8 && styles.thickRight,
        pushStyle,
      ]}
    >
      {flooding && floodPlayer !== null ? (
        <FloodWash index={floodIndex} seq={floodSeq} slow={floodSlow} player={floodPlayer} cold={cold} theme={theme} />
      ) : null}

      {v !== 0 && !smudged ? (
        <Text
          style={[
            styles.digit,
            isGiven && { fontFamily: fonts.digitBold },
            { color: palette.ink, fontWeight: isGiven ? '700' : '400' },
          ]}
          allowFontScaling={false}
        >
          {v}
        </Text>
      ) : null}

      {v !== 0 && smudged ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <Art width="100%" height="100%" uri={duelArt.overlaySmudge} accessibilityLabel="smudged digit" />
        </View>
      ) : null}

      {chained ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <Art width="100%" height="100%" uri={duelArt.overlayChain} />
        </View>
      ) : null}

      {wrongNow ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <Art
            width="100%"
            height="100%"
            uri={duelArt[(`strike${((wrongVariant % 3) + 1)}` as 'strike1' | 'strike2' | 'strike3')]}
          />
        </View>
      ) : null}

      {v === 0 && notes.length > 0 ? (
        <View style={styles.notes} pointerEvents="none">
          {Array.from({ length: 9 }, (_, i) => {
            const on = notes.includes(i + 1);
            return (
              <Text
                key={i}
                allowFontScaling={false}
                // web law: `.notes i:not(.noteOn) { opacity: 0 }` — an unset pencil
                // mark is INVISIBLE, not dimmed.
                style={[styles.note, { color: theme.fg, opacity: on ? 1 : 0 }, on && styles.noteOn]}
              >
                {i + 1}
              </Text>
            );
          })}
        </View>
      ) : null}

      {miasma && v === 0 ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <Art width="100%" height="100%" uri={duelArt.overlayMiasma} />
        </View>
      ) : null}
    </AnimatedPressable>
  );
}

/**
 * J1 — the ink flood. Animates `backgroundColor` strong -> settle over 460 ms, delayed
 * by `floodDelayMs(index, slow)` — the port of the CSS `inkFlood` keyframes plus the
 * `--flood-i * 30ms * --flood-slow` cascade delay (`slow` = the J3 verdict beat).
 *
 * `seq` is the retrigger identity, the port of the web's floodCellA/floodCellB nonce
 * parity: two overlapping floods (the cue replaces its value, no null gap) must BOTH
 * play on a cell they share, and only the seq proves a second flood arrived.
 *
 * RN's built-in Animated is deliberate here, not Reanimated: this is a backgroundColor
 * interpolation, which Animated does without a worklet, and nine 460 ms views are not a
 * graph. Reanimated is reserved for the transform layers.
 */
const FloodWash = memo(function FloodWash({
  index, seq, slow, player, cold, theme,
}: { index: number; seq: number; slow: boolean; player: 0 | 1; cold: boolean; theme: Theme }) {
  const motionReduced = useMotionReduced();
  const [anim] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (motionReduced) return; // kill-list: no cascade
    anim.setValue(0);
    const timing = Animated.timing(anim, {
      toValue: 1,
      duration: FLOOD_ANIM_MS,
      delay: floodDelayMs(index, slow),
      easing: Easing.out(Easing.ease),
      useNativeDriver: false,
    });
    timing.start();
    return () => timing.stop();
  }, [anim, index, seq, slow, motionReduced]);

  // The web kill-list law: reduced motion lands the cascade on its settled state —
  // which here is the cell's own `ownedSettle` tint (the port of the .owned* classes),
  // applied instantly. The wash overlay simply never mounts.
  if (motionReduced) return null;

  const strong = player === 0
    ? (cold ? theme.floodYouCold : theme.floodYou)
    : theme.floodFoe;
  const settle = player === 0
    ? (cold ? theme.floodYouColdSettle : theme.floodYouSettle)
    : theme.floodFoeSettle;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        { backgroundColor: anim.interpolate({ inputRange: [0, 0.55, 1], outputRange: [strong, strong, settle] }) },
      ]}
    />
  );
});

export default memo(CellImpl);

const styles = StyleSheet.create({
  cell: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  boxEven: { opacity: 0.97 },
  thickBottom: { borderBottomWidth: 2, borderBottomColor: palette.ink },
  thickRight: { borderRightWidth: 2, borderRightColor: palette.ink },
  digit: { fontSize: 22, fontFamily: fonts.digit, color: palette.ink },
  notes: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignContent: 'center',
    justifyContent: 'center',
  },
  note: { fontSize: 9, width: '33.33%', textAlign: 'center' },
  noteOn: { fontWeight: '700' },
});