// spotlight.ts — the M2 spotlight's pure geometry law (docs/TUTORIAL_OPTIMIZATION_PLAN.md
// §5.3, §6.4). Pure numbers in, plain rects out: no React, no RN, no colour — pinned by
// __tests__/spotlight.test.ts.
//
// The scrim is FOUR dim rects around a punched-out hole (never a blurred or glowing
// veil — the art direction forbids glow). The hole is computed from the CONTAINER's
// measured window rect plus the same constants the target components lay out with, so
// the coach never re-renders a single cell (Board/NumPad/AbilityBar stay untouched).

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Size {
  w: number;
  h: number;
}

/** Board.tsx's claim-gutter constant — the cell area is the wrap minus these. */
export const BOARD_GUTTER = 20;
/** NumPad.tsx's tile law: two rows of five, height 48, gap 5. */
export const PAD_TILE_H = 48;
export const PAD_GAP = 5;
/** DuelScreen's toolbar law: four buttons, min height 44, gap 6, paddingVertical 4. */
export const TOOLBAR_BTN_H = 44;
export const TOOLBAR_GAP = 6;
export const TOOLBAR_PAD_Y = 4;
/** AbilityBar.tsx's tile law: three tiles, height 60, gap 6. */
export const ABILITY_H = 60;
export const ABILITY_GAP = 6;
/** The hole breathes by this much around the target (visual, layout-safe). */
export const SPOT_PAD = 4;

/** The hole for one board cell, in the board wrap's own coordinates. */
export function cellHole(boardSize: number, cell: number, pad = SPOT_PAD): Rect {
  const inner = Math.max(0, boardSize - BOARD_GUTTER);
  const cs = inner / 9;
  const col = cell % 9;
  const row = Math.floor(cell / 9);
  const x = Math.max(0, col * cs - pad);
  const y = Math.max(0, row * cs - pad);
  const right = Math.min(inner, (col + 1) * cs + pad);
  const bottom = Math.min(inner, (row + 1) * cs + pad);
  return { x, y, w: right - x, h: bottom - y };
}

/** The hole for one pad digit (1–9) or the erase tile, in the pad's own coordinates. */
export function digitHole(padW: number, digit: number | 'erase', pad = SPOT_PAD): Rect {
  const tileW = (padW - (PAD_GAP * (5 - 1))) / 5;
  const index = digit === 'erase' ? 4 : digit <= 5 ? digit - 1 : digit - 6;
  const row = digit !== 'erase' && digit <= 5 ? 0 : 1;
  const x = Math.max(0, index * (tileW + PAD_GAP) - pad);
  const y = Math.max(0, row * (PAD_TILE_H + PAD_GAP) - pad);
  const right = Math.min(padW, x + tileW + pad * 2);
  const bottom = Math.min(2 * PAD_TILE_H + PAD_GAP, y + PAD_TILE_H + pad * 2);
  return { x, y, w: right - x, h: bottom - y };
}

/** The hole for one of the four tool buttons (0 = the quill), in the toolbar's own coordinates. */
export function toolbarHole(toolbarW: number, index: number, pad = SPOT_PAD): Rect {
  const btnW = (toolbarW - (TOOLBAR_GAP * 3)) / 4;
  const x = Math.max(0, index * (btnW + TOOLBAR_GAP) - pad);
  const right = Math.min(toolbarW, x + btnW + pad * 2);
  const bottom = Math.min(toolbarW, TOOLBAR_PAD_Y + TOOLBAR_BTN_H + pad);
  return { x, y: TOOLBAR_PAD_Y, w: right - x, h: bottom - TOOLBAR_PAD_Y };
}

/** The hole for one of the three rite tiles, in the ability bar's own coordinates. */
export function abilityHole(barW: number, index: number, pad = SPOT_PAD): Rect {
  const tileW = (barW - (ABILITY_GAP * 2)) / 3;
  const x = Math.max(0, index * (tileW + ABILITY_GAP) - pad);
  const right = Math.min(barW, x + tileW + pad * 2);
  return { x, y: 0, w: right - x, h: ABILITY_H };
}

/**
 * The four dim rects that leave exactly `hole` visible inside `container` (container's
 * own coordinates). Fail-closed: a hostile hole (empty or outside the container) dims
 * the WHOLE container — never a partial, never a crash.
 */
export function dimRectsAround(hole: Rect | null, container: Size): [Rect, Rect, Rect, Rect] {
  const full: Rect = { x: 0, y: 0, w: container.w, h: container.h };
  if (
    !hole || hole.w <= 0 || hole.h <= 0
    || hole.x < 0 || hole.y < 0
    || hole.x + hole.w > container.w + 0.5 || hole.y + hole.h > container.h + 0.5
  ) {
    return [full, { x: 0, y: 0, w: 0, h: 0 }, { x: 0, y: 0, w: 0, h: 0 }, { x: 0, y: 0, w: 0, h: 0 }];
  }
  const top: Rect = { x: 0, y: 0, w: container.w, h: hole.y };
  const bottom: Rect = { x: 0, y: hole.y + hole.h, w: container.w, h: container.h - (hole.y + hole.h) };
  const left: Rect = { x: 0, y: hole.y, w: hole.x, h: hole.h };
  const right: Rect = { x: hole.x + hole.w, y: hole.y, w: container.w - (hole.x + hole.w), h: hole.h };
  return [top, bottom, left, right];
}

/** The dimmed four-rect area equals the container minus the hole (a tiling law, test-pinned). */
export function dimArea(rects: readonly Rect[]): number {
  return rects.reduce((a, r) => a + Math.max(0, r.w) * Math.max(0, r.h), 0);
}
