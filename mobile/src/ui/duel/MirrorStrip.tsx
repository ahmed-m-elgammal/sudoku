// MirrorStrip.tsx — the opponent's 9x9 dot matrix, with the claim stamps.
//
// PORT of the MirrorStrip half of ../src/app/game/HudBits.tsx. The seating law lives here
// and nowhere else: **you = oxblood, foe = ash**, taken from the strip — both wax stamps
// are oxblood, so seat colour cannot come from the stamp.
//
// T12 — the unit->position mapping is exact and unchanged: rows stamp the right-edge cell
// of their row, columns the bottom cell of their column, boxes the centre cell. A glance
// reads where a claim sits.

import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { DuelRuntime } from '@/game/duelRuntime';
import { i18n } from '@/i18n';
import { seat, type Theme } from '@/theme/tokens';

export interface MirrorStripProps {
  duel: DuelRuntime;
  theme: Theme;
}

/** Position of a claim stamp inside the 81-dot matrix, in percent. */
export function stampPos(unit: string): { left: number; top: number } {
  const step = 100 / 9;
  const mid = (i: number) => (i + 0.5) * step;
  const n = parseInt(unit.slice(1), 10) || 0;
  const kind = unit[0];
  if (kind === 'r') return { left: mid(8), top: mid(n) };
  if (kind === 'c') return { left: mid(n), top: mid(8) };
  const br = Math.floor(n / 3) * 3;
  const bc = (n % 3) * 3;
  return { left: mid(bc + 1), top: mid(br + 1) };
}

export default function MirrorStrip({ duel, theme }: MirrorStripProps) {
  const [big, setBig] = useState(false);
  const foe = duel.state.players[1];
  const claimed = duel.state.unitOwner;
  const size = big ? 132 : 54;

  return (
    <Pressable
      onPress={() => setBig((b) => !b)}
      accessibilityRole="image"
      accessibilityLabel={`${i18n.duel.mirror.label}${big ? `, ${i18n.duel.mirror.shrink}` : `, ${i18n.duel.mirror.expand}`}`}
      style={[
        styles.mirror,
        {
          width: size,
          height: size,
          backgroundColor: theme.bgRaised,
          borderColor: theme.lineStrong,
        },
      ]}
    >
      <View style={styles.grid}>
        {Array.from({ length: 9 }, (_, r) => (
          <View key={r} style={styles.row}>
            {Array.from({ length: 9 }, (_, col) => {
              const c = r * 9 + col;
              const hasInk = !!foe.board[c];
              return (
                <View
                  key={c}
                  style={[
                    styles.dot,
                    {
                      backgroundColor: hasInk ? seat.foe : theme.bgSunken,
                    },
                  ]}
                />
              );
            })}
          </View>
        ))}
      </View>

      {Object.entries(claimed).map(([unit, owner]) => {
        const pos = stampPos(unit);
        return (
          <View
            key={unit}
            style={[
              styles.stamp,
              { left: `${pos.left}%`, top: `${pos.top}%` },
              { backgroundColor: owner === 1 ? seat.foe : seat.you },
            ]}
          />
        );
      })}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  mirror: {
    padding: 3,
    borderWidth: 1,
    borderRadius: 3,
    alignSelf: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  grid: {
    flex: 1,
    flexDirection: 'column',
    gap: 1,
  },
  row: {
    flex: 1,
    flexDirection: 'row',
    gap: 1,
  },
  dot: {
    flex: 1,
    borderRadius: 1,
  },
  stamp: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    marginLeft: -3,
    marginTop: -3,
    borderWidth: 1,
    borderColor: 'rgba(14, 14, 15, 0.7)',
  },
});