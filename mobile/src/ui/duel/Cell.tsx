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
import { SvgUri } from 'react-native-svg';
import { ROW_OF, COL_OF, BOX_OF } from '@shared/config';
import { duelSvgs } from './duelAssets';
import { FLOOD_CELL_MS, FLOOD_ANIM_MS } from '@/game/fx';
import { fonts, palette, type Theme } from '@/theme/tokens';

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
  wrongNow, wrongVariant, notes, floodIndex, floodPlayer, cold, ownedSettle,
  pushIndex, pushOrigin, frozen, theme, onPress,
}: CellProps) {
  const canSelect = !isGiven && !chained;
  const r = ROW_OF(c);
  const col = COL_OF(c);
  const flooding = floodIndex >= 0 && floodPlayer !== null;

  return (
    <Pressable
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
      ]}
    >
      {flooding && floodPlayer !== null ? (
        <FloodWash index={floodIndex} player={floodPlayer} cold={cold} theme={theme} />
      ) : null}

      {pushIndex >= 0 && pushOrigin ? <PushWash index={pushIndex} origin={pushOrigin} /> : null}

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
          <SvgUri width="100%" height="100%" uri={duelSvgs.overlaySmudge} accessibilityLabel="smudged digit" />
        </View>
      ) : null}

      {chained ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <SvgUri width="100%" height="100%" uri={duelSvgs.overlayChain} />
        </View>
      ) : null}

      {wrongNow ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <SvgUri
            width="100%"
            height="100%"
            uri={duelSvgs[(`strike${((wrongVariant % 3) + 1)}` as 'strike1' | 'strike2' | 'strike3')]}
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
                style={[styles.note, { color: on ? theme.fg : theme.fgDim }, on && styles.noteOn]}
              >
                {i + 1}
              </Text>
            );
          })}
        </View>
      ) : null}

      {miasma && v === 0 ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <SvgUri width="100%" height="100%" uri={duelSvgs.overlayMiasma} />
        </View>
      ) : null}
    </Pressable>
  );
}

/**
 * J1 — the ink flood. Animates `backgroundColor` strong -> settle over 460 ms, delayed
 * by `index * 30 ms`, which is exactly the CSS `inkFlood` keyframes plus the
 * `--flood-i * 30ms * --flood-slow` cascade delay.
 *
 * RN's built-in Animated is deliberate here, not Reanimated: this is a backgroundColor
 * interpolation, which Animated does without a worklet, and nine 460 ms views are not a
 * graph. Reanimated is reserved for the transform layers.
 */
const FloodWash = memo(function FloodWash({
  index, player, cold, theme,
}: { index: number; player: 0 | 1; cold: boolean; theme: Theme }) {
  const [anim] = useState(() => new Animated.Value(0));
  useEffect(() => {
    anim.setValue(0);
    Animated.timing(anim, {
      toValue: 1,
      duration: FLOOD_ANIM_MS,
      delay: index * FLOOD_CELL_MS,
      easing: Easing.out(Easing.ease),
      useNativeDriver: false,
    }).start();
  }, [anim, index]);

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

/** J3 — the ~4 % push toward the viewer, around the unit's centroid. Transform only. */
const PushWash = memo(function PushWash({
  index, origin,
}: { index: number; origin: { x: number; y: number } }) {
  const [anim] = useState(() => new Animated.Value(0));
  useEffect(() => {
    anim.setValue(0);
    Animated.timing(anim, {
      toValue: 1,
      duration: 100,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, [anim, index]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        {
          transformOrigin: `${origin.x}% ${origin.y}%`,
          transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.04] }) }],
        },
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