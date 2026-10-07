// The motionLaw pins — the acceptance criteria that the web build expressed as CSS
// custom-property arithmetic and the port must reproduce exactly:
//
//   J1/J3 — animation-delay: calc(var(--flood-i, 0) * 30ms * var(--flood-slow, 1))
//           (Duel.module.css .floodCellA/.floodCellB; boardWrap gets --flood-slow:
//           FLOOD_SLOW while the verdict waits SLOW_INK_MS)
//   J4    — border-color: color-mix(in srgb, var(--ink), #c49742 calc(var(--heat) * 55%))
//           (Duel.module.css .boardWrap @supports color-mix)
//
// The constants themselves live in @/game/fx (VERBATIM web copy); these tests pin that
// the port's DELAY and MIX arithmetic composes them the way the web's CSS did.
import { describe, it, expect } from 'vitest';
import { floodDelayMs, boardWarmthMix, BOARD_HEAT_MIX } from '../motionLaw';
import { FLOOD_CELL_MS, FLOOD_SLOW } from '@/game/fx';

describe('J1/J3 — the flood cascade delay (the CSS calc port)', () => {
  it('delays each cascade cell by 30ms', () => {
    expect(floodDelayMs(0, false)).toBe(0);
    expect(floodDelayMs(1, false)).toBe(FLOOD_CELL_MS);
    expect(floodDelayMs(8, false)).toBe(8 * FLOOD_CELL_MS);
  });

  it('stretches by FLOOD_SLOW while the verdict waits (slowInk)', () => {
    expect(floodDelayMs(1, true)).toBe(FLOOD_CELL_MS * FLOOD_SLOW);
    expect(floodDelayMs(8, true)).toBe(8 * FLOOD_CELL_MS * FLOOD_SLOW);
    // the last cell of a stretched cascade starts long after the unstretched one
    expect(floodDelayMs(8, true)).toBeGreaterThan(floodDelayMs(8, false));
  });

  it('is fail-closed on hostile indices', () => {
    expect(floodDelayMs(-1, false)).toBe(0);
    expect(floodDelayMs(Number.NaN, true)).toBe(0);
    expect(floodDelayMs(1.5, false)).toBe(0);
    expect(floodDelayMs(Number.POSITIVE_INFINITY, true)).toBe(0);
  });
});

describe('J4 — the board-border warmth (the color-mix port)', () => {
  it('mixes 55% toward the warm brass at full heat', () => {
    expect(boardWarmthMix(1)).toBeCloseTo(BOARD_HEAT_MIX);
  });

  it('scales linearly with heat', () => {
    expect(boardWarmthMix(0.5)).toBeCloseTo(0.5 * BOARD_HEAT_MIX);
    expect(boardWarmthMix(0)).toBe(0);
  });

  it('is fail-closed on hostile heat and clamps over 1', () => {
    expect(boardWarmthMix(-1)).toBe(0);
    expect(boardWarmthMix(Number.NaN)).toBe(0);
    expect(boardWarmthMix(Number.POSITIVE_INFINITY)).toBe(0);
    expect(boardWarmthMix(3)).toBe(BOARD_HEAT_MIX);
  });
});
