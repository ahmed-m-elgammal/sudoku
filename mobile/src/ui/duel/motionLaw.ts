// motionLaw.ts — the two acceptance laws the web build expressed as CSS custom-property
// arithmetic and this port must express as plain functions. Pure, React-free, RN-free,
// pinned by __tests__/motionLaw.test.ts.
//
// Why this file exists while `@/game/fx` does: fx.ts is a VERBATIM copy of the web
// build's src/game/fx.ts (see its header — editing it ends the port). These two
// formulas were never IN fx.ts; on the web they were the calc()/color-mix() expressions
// shipped in Duel.module.css next to fx.ts's constants. They are ported here, once,
// so the components stay arithmetic-free and the values stay test-pinned.

import { FLOOD_CELL_MS, FLOOD_SLOW } from '@/game/fx';

/**
 * J1 — the flood cascade delay, ported from
 *   `animation-delay: calc(var(--flood-i, 0) * 30ms * var(--flood-slow, 1))`
 * `slowInk` (J3, the verdict beat) is the port of boardWrap's
 * `--flood-slow: FLOOD_SLOW` (DuelScreen sets it while the verdict waits 300 ms).
 * Fail-closed: a hostile index delays nothing.
 */
export function floodDelayMs(index: number, slowInk: boolean): number {
  if (!Number.isInteger(index) || index <= 0) return 0;
  return index * FLOOD_CELL_MS * (slowInk ? FLOOD_SLOW : 1);
}

/** J4 — the web's cap: the border warms by at most 55% toward the warm brass. */
export const BOARD_HEAT_MIX = 0.55;

/**
 * J4 — the board-border warmth, ported from
 *   `border-color: color-mix(in srgb, var(--ink), #c49742 calc(var(--heat, 0) * 55%))`
 * Returns the mix RATIO (0..1) between palette.ink and palette.warmBrass; the
 * renderer interpolates the two endpoints over it. Fail-closed: hostile heat
 * warms nothing.
 */
export function boardWarmthMix(heat: number): number {
  if (typeof heat !== 'number' || !Number.isFinite(heat) || heat <= 0) return 0;
  return Math.min(1, heat) * BOARD_HEAT_MIX;
}
