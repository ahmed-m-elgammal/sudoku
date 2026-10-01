// ASSIZE sudoku: seeded generator, unique-solution backtracker, technique-based grader.
// Grades: 1 = naked/hidden singles · 2 = pairs + pointing/claiming · 3 = X-wing · 4 = chains (backtrack).
// Tier bands per spec §2. Deterministic under the shared Rng.
import { Rng } from './rng';
import { CONFIG, type Digit, type Tier } from './config';

type Grid = Uint8Array; // 81 cells, 0 = empty
const copyGrid = (g: Grid): Grid => Uint8Array.from(g);

const ROW = (c: number) => (c / 9) | 0;
const COL = (c: number) => c % 9;
const BOX = (c: number) => (((c / 9) | 0) / 3 | 0) * 3 + ((c % 9) / 3 | 0);

const BIT = (d: number) => 1 << d; // digits 1..9 -> bits 1..9
const ALL = 0b1111111110;

export function solvedGridFrom(rng: Rng): Grid {
  const g: Grid = new Uint8Array(81);
  const rows = new Uint16Array(9), cols = new Uint16Array(9), boxes = new Uint16Array(9);
  const place = (cell: number, d: number) => {
    g[cell] = d; rows[ROW(cell)] |= BIT(d); cols[COL(cell)] |= BIT(d); boxes[BOX(cell)] |= BIT(d);
  };
  const unplace = (cell: number, d: number) => {
    g[cell] = 0; rows[ROW(cell)] ^= BIT(d); cols[COL(cell)] ^= BIT(d); boxes[BOX(cell)] ^= BIT(d);
  };
  const fill = (cell: number): boolean => {
    if (cell === 81) return true;
    const cands: number[] = [];
    for (let d = 1; d <= 9; d++)
      if (!(rows[ROW(cell)] & BIT(d)) && !(cols[COL(cell)] & BIT(d)) && !(boxes[BOX(cell)] & BIT(d))) cands.push(d);
    rng.shuffle(cands);
    for (const d of cands) { place(cell, d); if (fill(cell + 1)) return true; unplace(cell, d); }
    return false;
  };
  if (!fill(0)) throw new Error('unsolvable');
  return g;
}

// count solutions up to `limit` (default 2 → uniqueness test). Empty grid -> counts from scratch.
export function countSolutions(grid: Grid, limit = 2): number {
  const rows = new Uint16Array(9), cols = new Uint16Array(9), boxes = new Uint16Array(9);
  const empties: number[] = [];
  for (let c = 0; c < 81; c++) {
    const d = grid[c];
    if (d) { rows[ROW(c)] |= BIT(d); cols[COL(c)] |= BIT(d); boxes[BOX(c)] |= BIT(d); }
    else empties.push(c);
  }
  let count = 0;
  const rec = (i: number): boolean => { // returns true = abort
    if (count >= limit) return true;
    if (i === empties.length) { count++; return count >= limit; }
    // MRV: pick the remaining empty with fewest candidates
    let best = i, bestN = 10;
    for (let j = i; j < empties.length; j++) {
      const c = empties[j];
      const used = rows[ROW(c)] | cols[COL(c)] | boxes[BOX(c)];
      let n = 0; for (let d = 1; d <= 9; d++) if (!(used & BIT(d))) n++;
      if (n < bestN) { bestN = n; best = j; if (n <= 1) break; }
    }
    if (bestN === 0) return false;
    [empties[i], empties[best]] = [empties[best], empties[i]];
    const c = empties[i];
    const used = rows[ROW(c)] | cols[COL(c)] | boxes[BOX(c)];
    for (let d = 1; d <= 9; d++) {
      if (used & BIT(d)) continue;
      grid[c] = d; rows[ROW(c)] |= BIT(d); cols[COL(c)] |= BIT(d); boxes[BOX(c)] |= BIT(d);
      const abort = rec(i + 1);
      grid[c] = 0; rows[ROW(c)] ^= BIT(d); cols[COL(c)] ^= BIT(d); boxes[BOX(c)] ^= BIT(d);
      if (abort) { [empties[i], empties[best]] = [empties[best], empties[i]]; return true; }
    }
    [empties[i], empties[best]] = [empties[best], empties[i]];
    return false;
  };
  rec(0);
  return count;
}

export const solveOne = (grid: Grid): Grid => {
  const g = copyGrid(grid);
  const rows = new Uint16Array(9), cols = new Uint16Array(9), boxes = new Uint16Array(9);
  const empties: number[] = [];
  for (let c = 0; c < 81; c++) {
    const d = g[c];
    if (d) { rows[ROW(c)] |= BIT(d); cols[COL(c)] |= BIT(d); boxes[BOX(c)] |= BIT(d); } else empties.push(c);
  }
  const rec = (i: number): boolean => {
    if (i === empties.length) return true;
    const c = empties[i];
    const used = rows[ROW(c)] | cols[COL(c)] | boxes[BOX(c)];
    for (let d = 1; d <= 9; d++) {
      if (used & BIT(d)) continue;
      g[c] = d; rows[ROW(c)] |= BIT(d); cols[COL(c)] |= BIT(d); boxes[BOX(c)] |= BIT(d);
      if (rec(i + 1)) return true;
      g[c] = 0; rows[ROW(c)] ^= BIT(d); cols[COL(c)] ^= BIT(d); boxes[BOX(c)] ^= BIT(d);
    }
    return false;
  };
  rec(0);
  return g;
};

// ------------------------------------------------------------------ logic grader
export interface GradeResult { grade: 1 | 2 | 3 | 4; solved: boolean }

export function grade(grid: Grid): GradeResult {
  const cands: Uint16Array = new Uint16Array(81);
  let maxLevel = 1;
  const peers = (c: number, out: number[]) => {
    out.length = 0;
    const r = ROW(c), co = COL(c), b = BOX(c);
    for (let i = 0; i < 81; i++) if (i !== c && (ROW(i) === r || COL(i) === co || BOX(i) === b)) out.push(i);
  };
  const setCell = (c: number, d: number) => {
    cands[c] = BIT(d);
    const ps: number[] = [];
    peers(c, ps);
    for (const p of ps) cands[p] &= ~BIT(d);
  };
  for (let c = 0; c < 81; c++) {
    if (grid[c]) { setCell(c, grid[c]); continue; }
    let m = ALL;
    const ps: number[] = []; peers(c, ps);
    for (const p of ps) if (grid[p]) m &= ~BIT(grid[p]);
    cands[c] = m;
  }
  const units: number[][] = [];
  for (let r = 0; r < 9; r++) units.push(Array.from({ length: 9 }, (_, i) => r * 9 + i));
  for (let c = 0; c < 9; c++) units.push(Array.from({ length: 9 }, (_, i) => i * 9 + c));
  for (let b = 0; b < 9; b++) {
    const br = ((b / 3) | 0) * 3, bc = (b % 3) * 3;
    units.push(Array.from({ length: 9 }, (_, i) => (br + ((i / 3) | 0)) * 9 + bc + (i % 3)));
  }
  const unsolved = () => { let n = 0; for (let c = 0; c < 81; c++) if (!grid[c]) n++; return n; };

  const nakedSubset = (k: 2 | 3): boolean => {
    for (const u of units) {
      const cells = u.filter((c) => !grid[c]);
      if (cells.length <= k) continue;
      // combinations of size k
      const idx: number[] = [];
      const comb = (start: number, depth: number): boolean => {
        if (depth === k) {
          let mask = 0; for (const i of idx) mask |= cands[cells[i]];
          if (popcount(mask) === k) {
            let hit = false;
            for (const c of cells) if (!idx.includes(cells.indexOf(c)) && (cands[c] & mask)) { cands[c] &= ~mask; hit = true; }
            if (hit) return true;
          }
          return false;
        }
        for (let i = start; i < cells.length; i++) { idx[depth] = i; if (comb(i + 1, depth + 1)) return true; }
        return false;
      };
      if (comb(0, 0)) return true;
    }
    return false;
  };
  const popcount = (x: number) => { let n = 0; while (x) { x &= x - 1; n++; } return n; };

  const hiddenSubset = (k: 2): boolean => {
    for (const u of units) {
      const pos: Record<number, number[]> = {};
      for (let d = 1; d <= 9; d++) {
        pos[d] = [];
        for (const c of u) if (!grid[c] && (cands[c] & BIT(d))) pos[d].push(c);
      }
      const ds = [1, 2, 3, 4, 5, 6, 7, 8, 9];
      for (let a = 0; a < 9; a++) for (let b2 = a + 1; b2 < 9; b2++) {
        const d1 = ds[a], d2 = ds[b2];
        if (!pos[d1].length || !pos[d2].length) continue;
        const s1 = new Set(pos[d1]), s2 = new Set(pos[d2]);
        if (s1.size !== k || s2.size !== k) continue;
        let same = true;
        for (const c of s1) if (!s2.has(c)) same = false;
        if (!same) continue;
        const mask = BIT(d1) | BIT(d2);
        let hit = false;
        for (const c of s1) if (cands[c] & ~mask) { cands[c] &= mask; hit = true; }
        if (hit) return true;
      }
    }
    return false;
  };
  const pointing = (): boolean => {
    for (let b = 0; b < 9; b++) {
      const cells = units[18 + b].filter((c) => !grid[c]);
      for (let d = 1; d <= 9; d++) {
        const inBox = cells.filter((c) => cands[c] & BIT(d));
        if (inBox.length < 2) continue;
        const rowsSet = new Set(inBox.map(ROW)), colsSet = new Set(inBox.map(COL));
        if (rowsSet.size === 1) {
          const r = [...rowsSet][0]; let hit = false;
          for (let i = 0; i < 9; i++) { const c = r * 9 + i; if (BOX(c) !== b && !grid[c] && (cands[c] & BIT(d))) { cands[c] &= ~BIT(d); hit = true; } }
          if (hit) return true;
        }
        if (colsSet.size === 1) {
          const co = [...colsSet][0]; let hit = false;
          for (let i = 0; i < 9; i++) { const c = i * 9 + co; if (BOX(c) !== b && !grid[c] && (cands[c] & BIT(d))) { cands[c] &= ~BIT(d); hit = true; } }
          if (hit) return true;
        }
      }
    }
    return false;
  };
  const xwing = (): boolean => {
    for (let d = 1; d <= 9; d++) {
      for (const orient of ['row', 'col'] as const) {
        const lines: number[][] = [];
        for (let l = 0; l < 9; l++) {
          const cells: number[] = [];
          for (let i = 0; i < 9; i++) {
            const c = orient === 'row' ? l * 9 + i : i * 9 + l;
            if (!grid[c] && (cands[c] & BIT(d))) cells.push(c);
          }
          if (cells.length === 2) lines.push(cells);
        }
        for (let a = 0; a < lines.length; a++) for (let b2 = a + 1; b2 < lines.length; b2++) {
          const crossKey = (c: number) => (orient === 'row' ? COL(c) : ROW(c));
          if (lines[a].map(crossKey).join() !== lines[b2].map(crossKey).join()) continue;
          let hit = false;
          for (let l = 0; l < 9; l++) {
            if (l === (orient === 'row' ? ROW(lines[a][0]) : COL(lines[a][0]))) continue;
            if (l === (orient === 'row' ? ROW(lines[b2][0]) : COL(lines[b2][0]))) continue;
            for (let i = 0; i < 9; i++) {
              const c = orient === 'row' ? l * 9 + i : i * 9 + l;
              if (!grid[c] && (cands[c] & BIT(d)) && lines[a].includes(c) === false && lines[b2].includes(c) === false) {
                cands[c] &= ~BIT(d); hit = true;
              }
            }
          }
          if (hit) return true;
        }
      }
    }
    return false;
  };

  let guard = 0;
  while (unsolved() > 0 && guard++ < 2000) {
    // L1: singles
    let progress = false;
    for (let c = 0; c < 81; c++) {
      if (grid[c]) continue;
      if (popcount(cands[c]) === 1) { setCell(c, 31 - Math.clz32(cands[c])); grid[c] = 31 - Math.clz32(cands[c]); progress = true; }
    }
    if (progress) continue;
    for (const u of units) {
      for (let d = 1; d <= 9; d++) {
        const spots = u.filter((c) => !grid[c] && (cands[c] & BIT(d)));
        if (spots.length === 1) { const c = spots[0]; setCell(c, d); grid[c] = d; progress = true; }
      }
    }
    if (progress) continue;
    // L2
    if (nakedSubset(2) || hiddenSubset(2) || pointing()) { maxLevel = Math.max(maxLevel, 2); continue; }
    // L3
    if (xwing()) { maxLevel = Math.max(maxLevel, 3); continue; }
    // L4: stuck → chains required (grade 4); do not backtrack here
    return { grade: Math.max(maxLevel, 4) as 4, solved: false };
  }
  return { grade: maxLevel as 1 | 2 | 3 | 4, solved: unsolved() === 0 };
}

// ------------------------------------------------------------------ generator
export interface Puzzle { givens: Digit[]; solution: Digit[]; grade: 1 | 2 | 3 | 4; givensCount: number; tier: Tier }

const tierBand = (tier: Tier) => CONFIG.puzzle.tiers[tier];

export function generatePuzzle(seed: string | number, tier: Tier): Puzzle {
  const rng = new Rng(typeof seed === 'string' ? seed : `n${seed}`);
  const band = tierBand(tier);
  const [minG, maxG] = band.givens as [number, number];
  let best: Puzzle | null = null;
  for (let attempt = 0; attempt < CONFIG.puzzle.maxGenerationAttempts; attempt++) {
    const solution = solvedGridFrom(rng);
    const puzzle: Grid = copyGrid(solution);
    const order = Array.from({ length: 81 }, (_, i) => i);
    rng.shuffle(order);
    const targetGivens = rng.range(minG, maxG);
    let givens = 81;
    for (const c of order) {
      if (givens <= targetGivens) break;
      const backup = puzzle[c];
      puzzle[c] = 0;
      if (countSolutions(copyGrid(puzzle), 2) !== 1) puzzle[c] = backup;
      else givens--;
    }
    if (givens < minG || givens > maxG) continue;
    const { grade: gr } = grade(copyGrid(puzzle));
    const okBand =
      ('maxGrade' in band && gr <= (band as { maxGrade: number }).maxGrade) ||
      ('minGrade' in band && gr >= (band as { minGrade: number }).minGrade) ||
      (!('maxGrade' in band) && !('minGrade' in band));
    const cand: Puzzle = {
      givens: Array.from(puzzle) as Digit[],
      solution: Array.from(solution) as Digit[],
      grade: gr, givensCount: givens, tier,
    };
    if (okBand) return cand;
    if (!best || Math.abs(givens - (minG + maxG) / 2) < Math.abs(best.givensCount - (minG + maxG) / 2)) best = cand;
  }
  if (best) return best; // band-tolerant fallback; actual grade/givens recorded on the puzzle
  throw new Error(`generation failed for ${tier}`);
}

// Daily Assize: one puzzle per UTC day (spec M3). Tier rotates Mon..Sun.
const DAILY_TIERS: Tier[] = ['Medium', 'Easy', 'Medium', 'Hard', 'Medium', 'Expert', 'Hard'];
export const tierForDailyDate = (dateKey: string): Tier => {
  const d = new Date(`${dateKey}T00:00:00Z`);
  return DAILY_TIERS[(d.getUTCDay() + 6) % 7];
};
export const dailySeed = (dateKey: string) => `assize-daily-${dateKey}`;
export function generateDaily(dateKey: string): Puzzle {
  return generatePuzzle(dailySeed(dateKey), tierForDailyDate(dateKey));
}

export const countRemaining = (board: Array<Digit | 0>, d: Digit): number => {
  let n = 0;
  for (let c = 0; c < 81; c++) if (board[c] === d) n++;
  return 9 - n;
};
