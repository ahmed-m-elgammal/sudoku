// Board.tsx — the sealed Tablet.
//
// PORT of ../src/app/game/Board.tsx. The grid, the box stamps, the row/column gutters and
// the aria contract are unchanged. Everything that was a CSS custom property
// (`--flood-i`, `--flood-strong`, `--flood-settle`, `--shake-amp`, `--flood-slow`) becomes
// an explicit prop or a computed style, with the SAME values.
//
// The presentation law is NOT re-derived here. Board only CALLS the pure functions in
// `@/game/fx` (which are the web build's, verbatim and test-pinned) and hands the results
// to its children.
//
// Geometry: the web board is a 10x10 CSS grid — 9x9 cells plus a 20px right gutter and
// a 20px bottom gutter for the claim stamps. That is reproduced with a 9/9 grid plus two
// absolute gutter strips, so the cells stay a clean 9x9 for the cascade arithmetic.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Art from '@/ui/Art';
import { Circle, Ellipse, Svg } from 'react-native-svg';
import type { DuelRuntime } from '@/game/duelRuntime';
import { cellsOfFlood, centroidOfUnit, ownerOfCell } from '@/game/fx';
import Cell from './Cell';
import { boardWarmthMix } from './motionLaw';
import { useMotionReduced } from '@/platform/display';
import { duelArt } from './duelAssets';
import { palette, type Theme } from '@/theme/tokens';

export interface BoardProps {
  duel: DuelRuntime;
  flood: { unit: string; player: 0 | 1; seq: number } | null;
  hitStop: { unit: string; player: 0 | 1 } | null;
  /** J3 — placement surfaces are gated during hit-stop / the verdict beat */
  frozen: boolean;
  /** J4 — the viewer is behind by >= COLD_GAP Seals: their ink desaturates */
  cold: boolean;
  /** J3 — the verdict beat: the final cascade stretches by FLOOD_SLOW */
  slowInk: boolean;
  /** J4 — 0..1 from `heatFromState`; warms the board's ink border */
  heat: number;
  theme: Theme;
  size?: number;
}

const GUTTER = 20;
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX'];

export default function Board({ duel, flood, hitStop, frozen, cold, slowInk, heat, theme, size }: BoardProps) {
  const motionReduced = useMotionReduced();
  const st = duel.state;
  const me = st.players[0];
  const flags = duel.flags();
  const sel = duel.selected;

  // The same-digit highlight: every cell already carrying the selected digit.
  const sameDigit = useMemo(() => {
    void duel.version;
    const set = new Set<number>();
    if (sel !== null) {
      const v = me.board[sel];
      if (v) for (let c = 0; c < 81; c++) if (me.board[c] === v) set.add(c);
    }
    return set;
  }, [sel, me.board, duel.version]);

  // J1 — the current flood's cells and its splash anchor (fail-closed helpers: a null
  // flood floods nothing, and an unknown unit resolves to nothing).
  const floodCells = useMemo(() => (flood ? cellsOfFlood(flood.unit) : null), [flood]);
  const splash = useMemo(() => (flood ? centroidOfUnit(flood.unit) : null), [flood]);

  // J3 — the push targets the SAME nine cells as the flood (one acceptance law), scaled
  // around the unit's centroid via a per-cell transform-origin.
  const pushCells = useMemo(() => (hitStop ? cellsOfFlood(hitStop.unit) : null), [hitStop]);
  const pushCentroid = useMemo(() => (hitStop ? centroidOfUnit(hitStop.unit) : null), [hitStop]);

  const wrongClear = duel.lastWrongClearAt > st.clockMs;
  const quarantined = flags.quarantinedUnits;

  // J4 — the web `.boardWrap` border law: `color-mix(in srgb, var(--ink), warmBrass
  // heat*55%)` over a 240 ms ease. The mix RATIO is the pure law in motionLaw.ts; this
  // only interpolates between the two palette endpoints. Reduced motion lands it
  // instantly — the warmth is a state, never a swell (the web kill-list kills the
  // transition, not the warmth).
  const [warmth] = useState(() => new Animated.Value(boardWarmthMix(heat)));
  useEffect(() => {
    const target = boardWarmthMix(heat);
    if (motionReduced) {
      warmth.setValue(target);
      return;
    }
    const timing = Animated.timing(warmth, {
      toValue: target,
      duration: 240,
      easing: Easing.out(Easing.ease),
      useNativeDriver: false, // colour interpolation is JS-side by design
    });
    timing.start();
    return () => timing.stop();
  }, [warmth, heat, motionReduced]);
  const borderColor = warmth.interpolate({ inputRange: [0, 1], outputRange: [palette.ink, palette.warmBrass] });

  // ONE stable callback for all 81 cells. Without this the map below would mint 81 fresh
  // closures every push and defeat Cell's memoisation entirely (risk R4).
  const onSelect = useCallback((cell: number) => {
    duel.select(cell);
  }, [duel]);

  // The settled territory tint per cell. `ownerOfCell` owns the box > row > col
  // precedence; this only maps the owner onto the theme's colour.
  const settleFor = (c: number): string | null => {
    const owner = ownerOfCell(c, st.unitOwner);
    if (owner === undefined) return null;
    if (owner === 0) return cold ? theme.floodYouColdSettle : theme.floodYouSettle;
    return theme.floodFoeSettle;
  };

  const stampFor = (unit: string) => (st.unitOwner[unit] === undefined ? null : st.unitOwner[unit]);

  return (
    // PLATFORM TRANSLATION (not a redesign): the web board is `role="grid"` on a div.
    // React Native's AccessibilityRole has no `grid`, so the container is left
    // unlabelled-as-a-role and every CELL carries the real information via its
    // `cellAria` label. Nothing is lost — the grid semantics on web existed to make the
    // cell labels navigable, which the labels still do here.
    <Animated.View style={[styles.wrap, size ? { width: size, height: size } : null, { borderColor }]}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Art width="100%" height="100%" uri={duelArt.parchmentVellum} />
      </View>

      {/* ---- the 81 cells: 9 rows of 9 cells */}
      <View style={styles.grid} pointerEvents="box-none">
        {Array.from({ length: 9 }, (_, r) => (
          <View key={r} style={styles.row}>
            {Array.from({ length: 9 }, (_, col) => {
              const c = r * 9 + col;
              const v = me.board[c];
              const isGiven = st.givens[c] !== 0;
              const fi = floodCells ? floodCells.indexOf(c) : -1;
              const pi = pushCells ? pushCells.indexOf(c) : -1;
              return (
                <Cell
                  key={c}
                  c={c}
                  v={v}
                  isGiven={isGiven}
                  isSel={sel === c}
                  sameDigit={sameDigit.has(c)}
                  chained={flags.chained.has(c)}
                  smudged={flags.smudged.has(c)}
                  miasma={flags.miasma}
                  wrongNow={duel.lastWrong === c && wrongClear}
                  wrongVariant={duel.wrongVariant}
                  notes={duel.notes.get(c) ? [...duel.notes.get(c)!] : EMPTY}
                  floodIndex={fi}
                  floodPlayer={fi >= 0 && flood ? flood.player : null}
                  floodSeq={fi >= 0 && flood ? flood.seq : -1}
                  floodSlow={slowInk}
                  cold={cold}
                  ownedSettle={settleFor(c)}
                  pushIndex={pi}
                  pushOrigin={
                    pi >= 0 && pushCentroid
                      ? {
                          x: (pushCentroid.cx * 9 - col) * 100,
                          y: (pushCentroid.cy * 9 - r) * 100,
                        }
                      : null
                  }
                  frozen={frozen}
                  theme={theme}
                  onPress={onSelect}
                />
              );
            })}
          </View>
        ))}
      </View>

      {/* J1 — one matte ink splash per resolved claim, at the unit's centroid. Anchored
          to the CELL area (wrap minus the two 20px claim gutters), which is the web's
          `calc((100% - 20px) * cx)`; it paints ABOVE the grid like the web's z-index 4. */}
      <View style={[StyleSheet.absoluteFill, styles.cellArea]} pointerEvents="none">
        {flood && splash ? (
          <InkBurst
            key={flood.seq}
            cx={splash.cx}
            cy={splash.cy}
            rotate={(flood.seq * 37) % 360}
            color={flood.player === 0 ? palette.oxblood : palette.ash}
          />
        ) : null}
      </View>

      {/* ---- box stamps at the nine box corners */}
      <View style={[StyleSheet.absoluteFill, { right: GUTTER, bottom: GUTTER }]} pointerEvents="none">
        {Array.from({ length: 9 }, (_, b) => {
          const owner = stampFor(`b${b}`);
          const bc = b % 3;
          const br = Math.floor(b / 3);
          return (
            <View
              key={`box${b}`}
              style={[styles.boxStamp, { left: `${bc * 33.333}%`, top: `${br * 33.333}%` }]}
            >
              {/* web `.quarantined`: the SVG as a cover background — the layer sits
                  UNDER the claim stamp exactly as a CSS background-image does */}
              {quarantined.has(`b${b}`) ? (
                <View style={StyleSheet.absoluteFill} pointerEvents="none">
                  <Art width="100%" height="100%" uri={duelArt.overlayQuarantine} />
                </View>
              ) : null}
              {owner !== null ? (
                <Art
                  width="72%"
                  height="72%"
                  uri={owner === 0 ? duelArt.stampFleur : duelArt.stampTau}
                  accessibilityLabel={`Box ${ROMAN[b]} claimed`}
                />
              ) : null}
            </View>
          );
        })}
      </View>

      {/* ---- the claim gutters: rows on the right, columns along the bottom */}
      <View style={styles.rowGutter} pointerEvents="none">
        {Array.from({ length: 9 }, (_, r) => {
          const owner = stampFor(`r${r}`);
          return (
            <View key={`row${r}`} style={styles.gutterCell}>
              {quarantined.has(`r${r}`) ? (
                <View style={StyleSheet.absoluteFill} pointerEvents="none">
                  <Art width="100%" height="100%" uri={duelArt.overlayQuarantine} />
                </View>
              ) : null}
              {owner !== null ? (
                <Art
                  width="80%"
                  height="80%"
                  uri={owner === 0 ? duelArt.stampFleur : duelArt.stampTau}
                  accessibilityLabel={`Row ${ROMAN[r]} claimed`}
                />
              ) : null}
            </View>
          );
        })}
      </View>
      <View style={styles.colGutter} pointerEvents="none">
        {Array.from({ length: 9 }, (_, c) => {
          const owner = stampFor(`c${c}`);
          return (
            <View key={`col${c}`} style={styles.gutterCell}>
              {quarantined.has(`c${c}`) ? (
                <View style={StyleSheet.absoluteFill} pointerEvents="none">
                  <Art width="100%" height="100%" uri={duelArt.overlayQuarantine} />
                </View>
              ) : null}
              {owner !== null ? (
                <Art
                  width="80%"
                  height="80%"
                  uri={owner === 0 ? duelArt.stampFleur : duelArt.stampTau}
                  accessibilityLabel={`Column ${ROMAN[c]} claimed`}
                />
              ) : null}
            </View>
          );
        })}
      </View>
    </Animated.View>
  );
}

/**
 * J1 — the splash. The web build's `InkSplash` droplet SVG plus its `inkBurst`
 * keyframes, ported whole: 700 ms ease-out — scale 0.35 -> 1.05 (60%) -> 1.2, opacity
 * 0 -> 0.8 (16%) -> 0.45 (60%) -> 0. A matte burst that ENDS GONE, never a persistent
 * mark. The kill-list hides it entirely (`[data-motion='reduced'] .inkSplash { display:
 * none }`); `key={flood.seq}` retriggers consecutive claims exactly like the web remount.
 */
function InkBurst({ cx, cy, rotate, color }: { cx: number; cy: number; rotate: number; color: string }) {
  const motionReduced = useMotionReduced();
  const [anim] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (motionReduced) return;
    const timing = Animated.timing(anim, {
      toValue: 1,
      duration: 700,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true, // transform + opacity only — zero layout
    });
    timing.start();
    return () => timing.stop();
  }, [anim, motionReduced]);

  if (motionReduced) return null;

  const scale = anim.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0.35, 1.05, 1.2] });
  const opacity = anim.interpolate({ inputRange: [0, 0.16, 0.6, 1], outputRange: [0, 0.8, 0.45, 0] });

  return (
    <Animated.View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.splash,
        {
          left: `${cx * 100}%`,
          top: `${cy * 100}%`,
          opacity,
          transform: [{ rotate: `${rotate}deg` }, { scale }],
        },
      ]}
    >
      <Svg viewBox="0 0 68 68" width={68} height={68}>
        <Ellipse cx="34" cy="34" rx="13" ry="11" fill={color} />
        <Ellipse cx="12" cy="26" rx="4.5" ry="3.6" fill={color} transform="rotate(-24 12 26)" />
        <Ellipse cx="56" cy="20" rx="3.8" ry="3.1" fill={color} transform="rotate(18 56 20)" />
        <Ellipse cx="55" cy="50" rx="4.6" ry="3.7" fill={color} transform="rotate(-40 55 50)" />
        <Ellipse cx="20" cy="54" rx="3.4" ry="2.8" fill={color} transform="rotate(30 20 54)" />
        <Ellipse cx="34" cy="8" rx="3" ry="2.5" fill={color} />
        <Circle cx="63" cy="35" r="2.2" fill={color} />
        <Circle cx="6" cy="42" r="2" fill={color} />
      </Svg>
    </Animated.View>
  );
}

const EMPTY: readonly number[] = [];

const FILL = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as const;

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    aspectRatio: 1,
    overflow: 'hidden',
    borderWidth: 2,
    backgroundColor: palette.parchment,
    borderRadius: 3,
  },
  cellArea: { right: GUTTER, bottom: GUTTER },
  grid: {
    ...FILL,
    right: GUTTER,
    bottom: GUTTER,
    flexDirection: 'column',
  },
  row: {
    flex: 1,
    flexDirection: 'row',
  },
  splash: {
    position: 'absolute',
    width: 68,
    height: 68,
    marginLeft: -34,
    marginTop: -34,
  },
  boxStamp: { position: 'absolute', width: '12%', height: '12%', alignItems: 'center', justifyContent: 'center' },
  rowGutter: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: GUTTER,
    width: GUTTER,
  },
  colGutter: {
    position: 'absolute',
    left: 0,
    right: GUTTER,
    bottom: 0,
    height: GUTTER,
    flexDirection: 'row',
  },
  gutterCell: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});