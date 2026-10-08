// Pins the M1 unlosable-tutorial guarantees (docs/TUTORIAL_OPTIMIZATION_PLAN.md G9/G10).
//
// The plan's literal prescription — `wrongSealCost: 0` mods — is impossible through the
// sanitized mods surface: shared/engine's T21 sanitizer clamps wrongSealCost to [1, 3],
// and shared/ is not ours to edit. The mobile runtime implements the same LAW through
// the engine's own forgiveness path instead: the scholar's Marginalia passive is
// re-armed before every tutorial placement, so EVERY tutorial mistake is `forgiven` —
// no Seal loss, no seal death — while the strike, the flinch and the haptic still
// teach. On top of that, the tutorial Shade holds its hand entirely once the Clerk
// sits at 1 Seal (the floor), so no claim can ever land the killing wound.
//
// The Shade is driven with a no-op requestAnimationFrame stub + fake timers: start()
// schedules the first shadeWake at 600 ms of real time, and the engine clock is moved
// by hand so the scripted race is due on the first wake.
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { LocalDuel } from '@/game/localDuel';
import { CELL_UNITS, UNIT_CELLS, type Digit } from '@shared/config';

function tutorialDuel() {
  return new LocalDuel({
    mode: 'tutorial', seed: 'unlosable-seed', tier: 'Easy',
    orders: ['scholar', 'executioner'], names: ['You', 'Shade of Orsolo'],
  });
}

/** An empty cell that cannot complete ANY of its units on this placement. */
function safeEmptyCell(duel: LocalDuel): number {
  const board = duel.state.players[0].board;
  for (let cell = 0; cell < 81; cell++) {
    if (board[cell] !== 0) continue;
    if (CELL_UNITS(cell).every((u) => UNIT_CELLS[u].filter((c) => board[c] === 0).length >= 3)) {
      return cell;
    }
  }
  throw new Error('no safe empty cell');
}

const solution = (duel: LocalDuel, cell: number): Digit => duel.state.solution![cell] as Digit;
const wrongDigit = (duel: LocalDuel, cell: number): Digit => ((solution(duel, cell) % 9) + 1) as Digit;

beforeEach(() => {
  vi.useFakeTimers();
  // no frame loop — the engine clock is driven by hand in these tests
  vi.stubGlobal('requestAnimationFrame', () => 0);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('LocalDuel · the tutorial cannot be lost (M1 G9)', () => {
  it('SEAL-1 a tutorial mistake costs NO Seals — the engine\u2019s own forgiven path fires', () => {
    const duel = tutorialDuel();
    const a = safeEmptyCell(duel);
    duel.place(a, solution(duel, a));
    const b = safeEmptyCell(duel);
    duel.place(b, solution(duel, b));
    const seals = duel.state.players[0].seals;
    expect(seals).toBeGreaterThan(1);
    const c = safeEmptyCell(duel);
    expect(duel.place(c, wrongDigit(duel, c)).correct).toBe(false);
    // the Seal count is untouched and the duel is unharmed
    expect(duel.state.players[0].seals).toBe(seals);
    expect(duel.state.phase).toBe('live');
    // the mistake went through the FORGIVEN branch, not the seal branch
    const mistake = [...duel.state.events].reverse().find((e) => e.kind === 'mistake');
    expect((mistake as { forgiven?: boolean } | undefined)?.forgiven).toBe(true);
    duel.destroy();
  });

  it('SEAL-2 even at ONE Seal a mistake cannot end the tutorial duel', () => {
    const duel = tutorialDuel();
    const a = safeEmptyCell(duel);
    duel.place(a, solution(duel, a));
    duel.state.players[0].seals = 1; // the floor
    const c = safeEmptyCell(duel);
    expect(duel.place(c, wrongDigit(duel, c)).correct).toBe(false);
    // checkSealDeath saw an unchanged Seal count — the duel lives on
    expect(duel.state.players[0].seals).toBe(1);
    expect(duel.state.phase).toBe('live');
    expect(duel.ended).toBe(false);
    duel.destroy();
  });

  it('SEAL-3 the floor: at ONE Seal the Shade holds its hand entirely', () => {
    const duel = tutorialDuel();
    const a = safeEmptyCell(duel);
    duel.place(a, solution(duel, a));
    const b = safeEmptyCell(duel);
    duel.place(b, solution(duel, b));
    duel.state.players[0].seals = 1; // the floor
    duel.state.clockMs = 6_000; // the scripted race is due
    const shadeBoardBefore = Buffer.from(duel.state.players[1].board).toString('hex');
    duel.start(); // schedules the first shadeWake at 600 ms (fake time)
    vi.advanceTimersByTime(600);
    vi.advanceTimersByTime(700); // the floor's own re-check cadence, twice over
    vi.advanceTimersByTime(700);
    // the Shade has done NOTHING — no placement, no claim, no wound
    expect(Buffer.from(duel.state.players[1].board).toString('hex')).toBe(shadeBoardBefore);
    expect(duel.state.players[0].seals).toBe(1);
    expect(duel.state.phase).toBe('live');
    duel.destroy();
  });

  it('SEAL-4 control: at full Seals the SAME setup lets the Shade race', () => {
    const duel = tutorialDuel();
    const a = safeEmptyCell(duel);
    duel.place(a, solution(duel, a));
    const b = safeEmptyCell(duel);
    duel.place(b, solution(duel, b));
    duel.state.clockMs = 6_000;
    const shadeBoardBefore = Buffer.from(duel.state.players[1].board).toString('hex');
    duel.start();
    vi.advanceTimersByTime(600);
    // the scripted race is live: the Shade has set at least one NEW digit
    expect(Buffer.from(duel.state.players[1].board).toString('hex')).not.toBe(shadeBoardBefore);
    duel.destroy();
  });
});

describe('LocalDuel · the 12-mistake soak (M1 item 7 acceptance)', () => {
  it('SOAK-1 twelve wrong placements in a row cannot lose the tutorial duel', () => {
    const duel = tutorialDuel();
    const sealsBefore = duel.state.players[0].seals;
    for (let i = 0; i < 12; i++) {
      const c = safeEmptyCell(duel);
      expect(duel.place(c, wrongDigit(duel, c)).correct).toBe(false);
      // every single mistake is forgiven: the Seal count NEVER moves, the duel NEVER ends
      expect(duel.state.players[0].seals).toBe(sealsBefore);
      expect(duel.state.phase).toBe('live');
      expect(duel.ended).toBe(false);
    }
    const mistakes = [...duel.state.events].filter((e) => e.kind === 'mistake');
    expect(mistakes.length).toBeGreaterThanOrEqual(12);
    // ...and every one of them went through the FORGIVEN branch, not the Seal branch
    expect(mistakes.every((e) => (e as { forgiven?: boolean }).forgiven === true)).toBe(true);
    duel.destroy();
  });

  it('SOAK-2 the same 12-mistake soak at the one-Seal floor under a live Shade cannot lose', () => {
    const duel = tutorialDuel();
    const a = safeEmptyCell(duel);
    duel.place(a, solution(duel, a));
    const b = safeEmptyCell(duel);
    duel.place(b, solution(duel, b));
    duel.state.players[0].seals = 1; // the floor
    duel.state.clockMs = 6_000; // the scripted race is due
    const shadeBoardBefore = Buffer.from(duel.state.players[1].board).toString('hex');
    duel.start();
    vi.advanceTimersByTime(600);
    for (let i = 0; i < 12; i++) {
      const c = safeEmptyCell(duel);
      expect(duel.place(c, wrongDigit(duel, c)).correct).toBe(false);
      // forgiveness + the floor compose: one Seal is both never spent and never taken
      expect(duel.state.players[0].seals).toBe(1);
      expect(duel.state.phase).toBe('live');
      expect(duel.ended).toBe(false);
      vi.advanceTimersByTime(700); // the race wakes between mistakes — and holds its hand
    }
    // the Shade did NOTHING while the child flailed: no placement, no claim, no wound
    expect(Buffer.from(duel.state.players[1].board).toString('hex')).toBe(shadeBoardBefore);
    duel.destroy();
  });
});
