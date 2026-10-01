// T4 — Orsolo's adaptive swap (shared/orders.ts ADAPTIVE_COUNTER + engine swapOrder).
// The swap must be one per duel by policy at the runtime layer, but the primitives
// it is built from must each hold on their own: runtimes rebuilt fresh, passives
// unworn, outgoing windows lapsed, everything earned or suffered preserved, and the
// counter map total, deterministic, and never a no-op against Orsolo's Scholar start.
import { describe, it, expect } from 'vitest';
import { generatePuzzle } from '../sudoku';
import { createDuel, swapOrder, applyStatus, useAbility, type DuelState } from '../engine';
import { ADAPTIVE_COUNTER, adaptiveSwapTarget, FOLIOS, ORDERS } from '../orders';
import { CONFIG, type OrderId } from '../config';

const newDuel = (seed = 't4-adaptive'): DuelState => {
  const puz = generatePuzzle(seed, 'Easy');
  return createDuel({
    seed,
    givens: Uint8Array.from(puz.givens),
    solution: Uint8Array.from(puz.solution),
    names: ['You', 'Magistrate Orsolo'],
    orders: ['warden', 'scholar'],
    magistrateSeals: [7, 8],
  });
};

describe('T4 · ADAPTIVE_COUNTER', () => {
  it('is total over every Order and never maps an Order to itself', () => {
    const ids = ORDERS.map((o) => o.id) as OrderId[];
    expect([...ids].sort()).toEqual(Object.keys(ADAPTIVE_COUNTER).sort());
    for (const id of ids) expect(ADAPTIVE_COUNTER[id]).not.toBe(id);
  });

  it('answers the four player Orders with the intended counters', () => {
    // Scholar buries information under Smudge/Miasma; Warden eats and reflects
    // Executioner pressure; Executioner races past the Vial; Scholar out-tempo walls.
    expect(ADAPTIVE_COUNTER.scholar).toBe('apothecary');
    expect(ADAPTIVE_COUNTER.executioner).toBe('warden');
    expect(ADAPTIVE_COUNTER.apothecary).toBe('executioner');
    expect(ADAPTIVE_COUNTER.warden).toBe('scholar');
  });

  it('Orsolo never re-wears the Order he opened with (player Warden vs Scholar start rotates one step)', () => {
    const foeStart = FOLIOS[8].duels[2].order; // 'scholar'
    const target = adaptiveSwapTarget('warden', foeStart);
    expect(target).not.toBe(foeStart);
    expect(target).toBe('apothecary'); // scholar → apothecary when Scholar is already worn
  });

  it('is deterministic for every (player, foe) pair the campaign can produce', () => {
    for (const me of ORDERS) {
      for (const foe of ORDERS) {
        expect(adaptiveSwapTarget(me.id, foe.id)).toBe(adaptiveSwapTarget(me.id, foe.id));
        expect(adaptiveSwapTarget(me.id, foe.id)).not.toBe(foe.id);
      }
    }
  });
});

describe('T4 · engine swapOrder', () => {
  it('swaps the Order, rebuilds ability runtimes fresh, and emits one orderSwap event', () => {
    const st = newDuel();
    const foe = st.players[1];
    foe.abilities.augur.cdLeftMs = 12_345; // worn cooldown must not survive the swap
    foe.abilities.augur.usedOnce = true;
    const beforeEvents = st.events.length;

    const ok = swapOrder(st, 1, 'apothecary');
    expect(ok).toBe(true);
    expect(foe.order).toBe('apothecary');
    expect(Object.keys(foe.abilities).sort()).toEqual(['miasma', 'smudge', 'tincture']);
    expect(foe.abilities.smudge).toEqual({ cdLeftMs: 0, usedOnce: false, usesLeft: null });
    expect(foe.abilities.tincture.usesLeft).toBe(CONFIG.abilityCdMs.tinctureUsesPerDuel);

    const swapEvents = st.events.filter((e) => e.kind === 'orderSwap');
    expect(swapEvents).toHaveLength(1);
    expect(st.events.length).toBe(beforeEvents + 1);
    const last = swapEvents[0];
    expect(last.player).toBe(1);
    expect(last.from).toBe('scholar');
    expect(last.to).toBe('apothecary');
  });

  it('preserves everything earned or suffered: Seals, mistakes, claims, board, statuses', () => {
    const st = newDuel();
    const foe = st.players[1];
    foe.seals = 4;
    foe.mistakes = 2;
    foe.claimed.push('r0');
    applyStatus(st, 0, 'chain', 1, { cell: 3 });

    swapOrder(st, 1, 'executioner');
    expect(foe.seals).toBe(4);
    expect(foe.mistakes).toBe(2);
    expect(foe.claimed).toEqual(['r0']);
    expect(foe.statuses.some((s) => s.type === 'chain')).toBe(true);
    // the solution-carrying board is untouched
    expect(foe.board).toEqual(st.players[0].board);
  });

  it('the new Order arrives with its passive unworn (Bulwark negates again after a Warden swap)', () => {
    const st = newDuel();
    const foe = st.players[1];
    swapOrder(st, 1, 'warden');
    expect(foe.bulwarkUsed).toBe(false);

    // the swapped-in Bulwark must actually work: the first incoming status is negated
    const res = applyStatus(st, 0, 'hush', 1, {});
    expect(res.applied).toBe(false);
    expect(res.reason).toBe('bulwark');
    expect(foe.bulwarkUsed).toBe(true);
  });

  it('lapses outgoing ability windows (Reckoning does not survive setting the Axe aside)', () => {
    const st = newDuel();
    const foe = st.players[1];
    swapOrder(st, 1, 'executioner');
    useAbility(st, 1, 'reckoning', {});
    expect(foe.reckoningUntilMs).toBeGreaterThan(0);

    swapOrder(st, 1, 'scholar');
    expect(foe.reckoningUntilMs).toBe(0);
    expect(Object.keys(foe.abilities).sort()).toEqual(['augur', 'fairCopy', 'unseal']);
  });

  it('refuses no-op swaps, swaps after phase end, and stays silent about it', () => {
    const st = newDuel();
    expect(swapOrder(st, 1, 'scholar')).toBe(false); // already a Scholar
    st.phase = 'ended';
    const n = st.events.length;
    expect(swapOrder(st, 1, 'executioner')).toBe(false);
    expect(st.events.length).toBe(n);
  });
});
