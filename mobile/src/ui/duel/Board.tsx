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

import { useCallback, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { SvgUri } from 'react-native-svg';
import { ROW_OF, COL_OF } from '@shared/config';
import type { DuelRuntime } from '@/game/duelRuntime';
import { cellsOfFlood, centroidOfUnit, ownerOfCell } from '@/game/fx';
import Cell from './Cell';
import { duelSvgs } from './duelAssets';
import { palette, type Theme } from '@/theme/tokens';

export interface BoardProps {
  duel: DuelRuntime;
  flood: { unit: string; player: 0 | 1; seq: number } | null;
  hitStop: { unit: string; player: 0 | 1 } | null;
  /** J3 — placement surfaces are gated during hit-stop / the verdict beat */
  frozen: boolean;
  /** J4 — the viewer is behind by >= COLD_GAP Seals: their ink desaturates */
  cold: boolean;
  theme: Theme;
  size?: number;
}

const GUTTER = 20;
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX'];

export default function Board({ duel, flood, hitStop, frozen, cold, theme, size }: BoardProps) {
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
    <View style={[styles.wrap, size ? { width: size, height: size } : null]}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <SvgUri width="100%" height="100%" uri={duelSvgs.parchmentVellum} />
      </View>

      {/* J1 — one matte ink splash per resolved claim, at the unit's centroid */}
      {flood && splash ? (
        <View
          key={flood.seq}
          pointerEvents="none"
          style={[
            styles.splash,
            {
              left: `${splash.cx * 100}%`,
              top: `${splash.cy * 100}%`,
              borderColor: flood.player === 0 ? theme.accent : theme.fgDim,
              transform: [{ rotate: `${(flood.seq * 37) % 360}deg` }],
            },
          ]}
        />
      ) : null}

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

      {/* ---- box stamps at the nine box corners */}
      <View style={[StyleSheet.absoluteFill, { right: GUTTER, bottom: GUTTER }]} pointerEvents="none">
        {Array.from({ length: 9 }, (_, b) => {
          const owner = stampFor(`b${b}`);
          const bc = b % 3;
          const br = Math.floor(b / 3);
          return (
            <View
              key={`box${b}`}
              style={[
                styles.boxStamp,
                { left: `${bc * 33.333}%`, top: `${br * 33.333}%` },
                quarantined.has(`b${b}`) && styles.quarantined,
              ]}
            >
              {owner !== null ? (
                <SvgUri
                  width="72%"
                  height="72%"
                  uri={owner === 0 ? duelSvgs.stampFleur : duelSvgs.stampTau}
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
            <View
              key={`row${r}`}
              style={[styles.gutterCell, quarantined.has(`r${r}`) && styles.quarantined]}
            >
              {owner !== null ? (
                <SvgUri
                  width="80%"
                  height="80%"
                  uri={owner === 0 ? duelSvgs.stampFleur : duelSvgs.stampTau}
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
            <View
              key={`col${c}`}
              style={[styles.gutterCell, quarantined.has(`c${c}`) && styles.quarantined]}
            >
              {owner !== null ? (
                <SvgUri
                  width="80%"
                  height="80%"
                  uri={owner === 0 ? duelSvgs.stampFleur : duelSvgs.stampTau}
                  accessibilityLabel={`Column ${ROMAN[c]} claimed`}
                />
              ) : null}
            </View>
          );
        })}
      </View>
    </View>
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
    borderColor: palette.ink,
    backgroundColor: palette.parchment,
    borderRadius: 3,
  },
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
    width: 26,
    height: 26,
    marginLeft: -13,
    marginTop: -13,
    borderRadius: 13,
    borderWidth: 5,
    opacity: 0.34,
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
  quarantined: { opacity: 0.45 },
});