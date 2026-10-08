// Pins the M2 spotlight's pure geometry (docs/TUTORIAL_OPTIMIZATION_PLAN.md §5.3, §6.4).
// The holes are derived from the SAME constants the target components lay out with, so
// the tests pin the coach's aim without rendering a single component. The tiling law is
// the load-bearing one: four dim rects cover the container minus the hole — the scrim
// can never leak dim ground into the hole or lose the container's corners.
import { describe, it, expect } from 'vitest';
import {
  abilityHole, BOARD_GUTTER, cellHole, dimArea, dimRectsAround, digitHole, toolbarHole,
  ABILITY_H, ABILITY_GAP, PAD_GAP, PAD_TILE_H, TOOLBAR_BTN_H, TOOLBAR_GAP, TOOLBAR_PAD_Y,
} from '../spotlight';

const CONTAINER = { w: 360, h: 240 };

describe('spotlight · cellHole (Board: (size−20)/9 cells)', () => {
  const boardSize = 320; // inner = 300, cs = 33.33

  it('SPOT-1 cell 0 sits at the wrap origin; cell 80 ends at the inner edge', () => {
    const first = cellHole(boardSize, 0);
    expect(first.x).toBe(0);
    expect(first.y).toBe(0);
    const last = cellHole(boardSize, 80);
    // the last cell's hole ends exactly at the inner edge (the claim gutter is not covered)
    expect(last.x + last.w).toBeCloseTo(boardSize - BOARD_GUTTER, 5);
    expect(last.y + last.h).toBeCloseTo(boardSize - BOARD_GUTTER, 5);
    // and the first hole grew by the pad on its open side only (the wrap edge clamps it)
    expect(first.w).toBeCloseTo((boardSize - BOARD_GUTTER) / 9 + 4, 5);
  });

  it('SPOT-2 the hole grows by the pad but never leaves the inner cell area', () => {
    const edge = cellHole(boardSize, 8); // top-right cell
    expect(edge.x + edge.w).toBeLessThanOrEqual(boardSize - BOARD_GUTTER + 0.01);
    expect(edge.y).toBe(0);
  });
});

describe('spotlight · digitHole (NumPad: 2 rows of 5, gap 5, h 48)', () => {
  const padW = 340;

  it('SPOT-3 digit 9 sits in row 2 one tile left of the erase tile, same row', () => {
    const d1 = digitHole(padW, 1);
    expect(d1.x).toBe(0);
    expect(d1.y).toBe(0);
    expect(d1.h).toBe(PAD_TILE_H + 8);
    const d9 = digitHole(padW, 9);
    const erase = digitHole(padW, 'erase');
    const tileW = (padW - PAD_GAP * 4) / 5;
    // same row, exactly one tile+gap apart, clamped to the pad's own edges
    expect(d9.y).toBe(PAD_TILE_H + PAD_GAP - 4);
    expect(erase.y).toBe(d9.y);
    expect(erase.x - d9.x).toBeCloseTo(tileW + PAD_GAP, 5);
    expect(erase.x + erase.w).toBeCloseTo(padW, 5);
  });

  it('SPOT-4 the digit holes tile the pad row consistently', () => {
    const w = (padW - PAD_GAP * 4) / 5;
    const d3 = digitHole(padW, 3);
    expect(d3.x).toBeCloseTo(2 * (w + PAD_GAP) - 4, 5);
  });
});

describe('spotlight · toolbarHole (4 buttons, gap 6, min-h 44, padY 4)', () => {
  it('SPOT-5 the quill (index 0) hole honors the toolbar\u2019s own constants', () => {
    const w = 340;
    const h = toolbarHole(w, 0);
    expect(h.y).toBe(TOOLBAR_PAD_Y);
    // the hole breathes down to the row's own edge (padY + btnH + pad = the 52pt row)
    expect(h.h).toBe(TOOLBAR_BTN_H + 4);
    expect(h.x).toBe(0);
    const btnW = (w - TOOLBAR_GAP * 3) / 4;
    const h2 = toolbarHole(w, 2);
    expect(h2.x).toBeCloseTo(2 * (btnW + TOOLBAR_GAP) - 4, 5);
  });
});

describe('spotlight · abilityHole (3 tiles, gap 6, h 60)', () => {
  it('SPOT-6 tile 0 (the Eye, scholar order) opens the bar; the holes tile the width', () => {
    const w = 340;
    const a = abilityHole(w, 0);
    expect(a.h).toBe(ABILITY_H);
    expect(a.x).toBe(0);
    const tileW = (w - ABILITY_GAP * 2) / 3;
    const c = abilityHole(w, 2);
    expect(c.x).toBeCloseTo(2 * (tileW + ABILITY_GAP) - 4, 5);
    expect(c.x + c.w).toBeLessThanOrEqual(w);
  });
});

describe('spotlight · dimRectsAround (the tiling law)', () => {
  it('SPOT-7 four dim rects cover the container minus the hole — never the hole itself', () => {
    const hole = { x: 40, y: 30, w: 50, h: 40 };
    const rects = dimRectsAround(hole, CONTAINER);
    expect(rects.length).toBe(4);
    expect(dimArea(rects)).toBeCloseTo(CONTAINER.w * CONTAINER.h - hole.w * hole.h, 3);
    // the hole's own rectangle is untouched by every dim rect
    for (const r of rects) {
      const overlapsX = r.x < hole.x + hole.w && r.x + r.w > hole.x;
      const overlapsY = r.y < hole.y + hole.h && r.y + r.h > hole.y;
      expect(overlapsX && overlapsY).toBe(false);
    }
  });

  it('SPOT-8 fail-closed: a hostile hole dims the WHOLE container', () => {
    for (const bad of [null, { x: -5, y: 0, w: 10, h: 10 }, { x: 0, y: 0, w: 0, h: 0 }, { x: 0, y: 0, w: 9999, h: 10 }]) {
      const rects = dimRectsAround(bad as never, CONTAINER);
      expect(rects[0]).toEqual({ x: 0, y: 0, w: CONTAINER.w, h: CONTAINER.h });
      expect(dimArea(rects.slice(1))).toBe(0);
    }
  });
});
