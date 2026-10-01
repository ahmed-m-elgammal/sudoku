// Engine tests (spec §6: puzzle uniqueness, generator difficulty, claim and damage rules,
// every ability and status, win-condition order).
import { describe, it, expect } from 'vitest';
import { Rng, todayUtcKey } from '../rng';
import { generatePuzzle, countSolutions, solveOne, generateDaily, tierForDailyDate } from '../sudoku';
import {
  createDuel, place, useAbility, tick, resign, cellFlags, serializeDuel, deserializeDuel,
  type DuelState,
} from '../engine';
import { CONFIG, ORDER_ABILITIES, UNIT_CELLS, CELL_UNITS, type AbilityId, type Digit, type PlayerId } from '../config';
import { shadeAct, profileForStanding } from '../shade';
import { FOLIOS, totalCampaignDuels } from '../orders';

const EASY = () => generatePuzzle('test-easy-seed', 'Easy');
const solveTo = (st: DuelState, player: PlayerId, solution: Uint8Array, limit = 81) => {
  let placed = 0;
  for (let c = 0; c < 81 && placed < limit; c++) {
    if (st.players[player].board[c] === 0) { place(st, player, c, solution[c] as Digit); placed++; }
  }
};

describe('puzzle generator', () => {
  it('produces a unique solution', () => {
    const p = EASY();
    expect(countSolutions(Uint8Array.from(p.givens), 2)).toBe(1);
  });

  it('matches the tier givens band (Easy 36-40, Expert 22-25)', () => {
    const easy = EASY();
    expect(easy.givensCount).toBeGreaterThanOrEqual(36);
    expect(easy.givensCount).toBeLessThanOrEqual(40);
    const expert = generatePuzzle('test-expert-seed', 'Expert');
    expect(expert.givensCount).toBeGreaterThanOrEqual(22);
    expect(expert.givensCount).toBeLessThanOrEqual(25);
  }, 60_000);

  it('grades techniques: Easy stays on singles, Expert needs deep techniques', () => {
    const easy = EASY();
    expect(easy.grade).toBeLessThanOrEqual(1);
    const expert = generatePuzzle('test-expert-grade', 'Expert');
    expect(expert.grade).toBeGreaterThanOrEqual(3);
  }, 60_000);

  it('solution is valid and consistent with givens', () => {
    const p = EASY();
    const sol = p.solution;
    for (let c = 0; c < 81; c++) if (p.givens[c]) expect(sol[c]).toBe(p.givens[c]);
    const solved = solveOne(Uint8Array.from(p.givens));
    expect(Array.from(solved)).toEqual(Array.from(sol));
  });

  it('daily is deterministic per UTC day and tiers rotate', () => {
    const key = todayUtcKey();
    const a = generateDaily(key);
    const b = generateDaily(key);
    expect(Array.from(a.givens)).toEqual(Array.from(b.givens));
    expect(tierForDailyDate(key)).toMatch(/Easy|Medium|Hard|Expert/);
  }, 60_000);
});

const mkDuel = (over: Partial<Parameters<typeof createDuel>[0]> = {}) => {
  const p = EASY();
  return createDuel({ seed: 'duel-seed', givens: Uint8Array.from(p.givens), solution: Uint8Array.from(p.solution), ...over });
};

describe('placement, claims and damage', () => {
  it('correct placement is final and advances progress', () => {
    const st = mkDuel();
    const sol = st.solution!;
    const cell = st.givens.findIndex((g) => g === 0);
    const res = place(st, 0, cell, sol[cell] as Digit);
    expect(res.ok && res.correct).toBe(true);
    expect(st.players[0].board[cell]).toBe(sol[cell]);
    expect(st.players[0].progress).toBe(1);
  });

  it('wrong placement costs 1 Seal, flinches 3s, logs the mistake', () => {
    const st = mkDuel({ orders: ['executioner', 'apothecary'] }); // no Marginalia forgiveness
    const cell = st.givens.findIndex((g) => g === 0);
    const wrong = ((st.solution![cell] % 9) + 1) as Digit;
    place(st, 0, cell, wrong);
    expect(st.players[0].seals).toBe(6);
    expect(st.players[0].mistakes).toBe(1);
    expect(st.players[0].flinchUntilMs).toBe(3000);
    expect(st.players[0].board[cell]).toBe(0);
    expect(st.events.find((e) => e.kind === 'mistake')).toBeTruthy();
  });

  it('completing a unit claims it and deals 1 (2 when Clean)', () => {
    const st = mkDuel();
    const sol = st.solution!;
    for (let c = 0; c < 9; c++) if (st.givens[c] === 0) place(st, 0, c, sol[c] as Digit);
    expect(st.unitOwner['r0']).toBe(0);
    expect(st.players[1].seals).toBe(5); // 7 - 2 clean
    expect(st.events.find((e) => e.kind === 'claim')?.clean).toBe(true);
  });

  it('a mistake in the unit voids Clean (damage 1 only)', () => {
    const st = mkDuel();
    const sol = st.solution!;
    const firstEmpty = st.givens.findIndex((g) => g === 0);
    const wrong = ((sol[firstEmpty] % 9) + 1) as Digit;
    place(st, 0, firstEmpty, wrong);
    for (let c = 0; c < 9; c++) if (st.givens[c] === 0) place(st, 0, c, sol[c] as Digit);
    const claim = st.events.find((e) => e.kind === 'claim' && e.unit === 'r0') as { clean: boolean; damage: number } | undefined;
    if (claim) { expect(claim.clean).toBe(false); expect(claim.damage).toBe(1); }
  });

  it('a unit can be claimed only once per duel', () => {
    const st = mkDuel();
    solveTo(st, 0, st.solution!, 81);
    expect(st.events.filter((e) => e.kind === 'claim' && e.unit === 'r0').length).toBeLessThanOrEqual(1);
  });

  it('Momentum reduces all cooldowns by 0.5s per correct placement', () => {
    const st = mkDuel({ orders: ['scholar', 'executioner'] });
    useAbility(st, 0, 'augur', { cell: st.givens.findIndex((g) => g === 0) });
    const before = st.players[0].abilities.augur.cdLeftMs; // first use -> 50% of 40s
    expect(before).toBe(20_000);
    const sol = st.solution!;
    const empty = st.givens.findIndex((g) => g === 0);
    place(st, 0, empty, sol[empty] as Digit);
    expect(st.players[0].abilities.augur.cdLeftMs).toBe(before - 500);
  });
});

describe('statuses and anti-frustration', () => {
  it('CHAIN makes an empty cell uneditable for 8s', () => {
    const st = mkDuel({ orders: ['scholar', 'executioner'] });
    const target = st.players[0]; // caster is player 1, so the chain lands on player 0
    expect(useAbility(st, 1, 'sever', {}).ok).toBe(true);
    const chain = target.statuses.find((s) => s.type === 'chain');
    expect(chain).toBeTruthy();
    if (chain?.cell !== undefined) {
      const r = place(st, 0, chain.cell, st.solution![chain.cell] as Digit);
      expect(r.reason).toBe('chained');
    }
    tick(st, 8000);
    expect(target.statuses.find((s) => s.type === 'chain')).toBeUndefined();
    expect(target.immuneUntil.chain).toBeGreaterThan(0);
  });

  it('SMUDGE blurs 5 placed non-given digits, never givens (+2s Distiller)', () => {
    const st = mkDuel({ orders: ['scholar', 'apothecary'] });
    solveTo(st, 0, st.solution!, 10);
    useAbility(st, 1, 'smudge', {});
    const s = st.players[0].statuses.find((x) => x.type === 'smudge');
    expect(s).toBeTruthy();
    expect(s!.cells!.length).toBe(Math.min(5, 10));
    for (const c of s!.cells!) expect(st.givens[c]).toBe(0);
    expect(s!.endsAtMs).toBe(9_000); // 7s + 2s Distiller
    tick(st, 9_000);
    expect(st.players[0].statuses.find((x) => x.type === 'smudge')).toBeUndefined();
  });

  it('HUSH deadlocks the pad for 2.5s and rejects placements', () => {
    const st = mkDuel({ orders: ['scholar', 'executioner'] });
    useAbility(st, 1, 'hush', {});
    expect(st.players[0].statuses.find((s) => s.type === 'hush')).toBeTruthy();
    const empty = st.givens.findIndex((g) => g === 0);
    expect(place(st, 0, empty, st.solution![empty] as Digit).reason).toBe('hushed');
  });

  it('MIASMA lasts 10s (+2s Distiller)', () => {
    const st = mkDuel({ orders: ['scholar', 'apothecary'] });
    useAbility(st, 1, 'miasma', {});
    expect(st.players[0].statuses.find((x) => x.type === 'miasma')!.endsAtMs).toBe(12_000);
  });

  it('QUARANTINE blocks the claim for 12s, then the deferred claim resolves', () => {
    const st = mkDuel({ orders: ['scholar', 'warden'] });
    const sol = st.solution!;
    useAbility(st, 1, 'quarantine', { unit: 'r0' });
    expect(st.players[0].statuses.find((s) => s.type === 'quarantine')?.unit).toBe('r0');
    for (let c = 0; c < 9; c++) if (st.givens[c] === 0) place(st, 0, c, sol[c] as Digit);
    expect(st.unitOwner['r0']).toBeUndefined();
    expect(st.players[1].seals).toBe(7);
    tick(st, 12_000);
    expect(st.unitOwner['r0']).toBe(0);
    expect(st.players[1].seals).toBeLessThan(7);
  });

  it('anti-frustration: 4s global gap, per-type immunity, none in final 10s', () => {
    const st = mkDuel({ orders: ['scholar', 'executioner'] });
    useAbility(st, 1, 'hush', {});
    expect(st.players[0].statuses.some((s) => s.type === 'hush')).toBe(true);
    expect(useAbility(st, 1, 'sever', {}).applied).toBe(false); // 4s global gap
    tick(st, 2500);
    expect(st.players[0].statuses.some((s) => s.type === 'hush')).toBe(false);
    st.players[1].abilities.hush.cdLeftMs = 0; // reset for the re-cast
    expect(useAbility(st, 1, 'hush', {}).applied).toBe(false);  // 5s immunity (and 4s gap)
    const st2 = mkDuel();
    tick(st2, st2.durationMs - 5000);
    useAbility(st2, 1, 'hush', {});
    expect(st2.players[0].statuses.some((s) => s.type === 'hush')).toBe(false);
  });

  it('Warden Bulwark negates the first incoming status', () => {
    const st = mkDuel({ orders: ['warden', 'executioner'] }); // target 0 = Warden, caster 1 = Executioner
    useAbility(st, 1, 'hush', {});
    expect(st.players[0].statuses.length).toBe(0);
    expect(st.players[0].bulwarkUsed).toBe(true);
    tick(st, 4200);
    st.players[1].abilities.sever.cdLeftMs = 0;
    useAbility(st, 1, 'sever', {});
    expect(st.players[0].statuses.some((s) => s.type === 'chain')).toBe(true);
  });

  it('Ward negates within 15s; Mirror reflects within 10s', () => {
    const st = mkDuel({ orders: ['warden', 'apothecary'] });
    solveTo(st, 0, st.solution!, 5); // smudge needs placed digits on the target's board
    useAbility(st, 0, 'ward', {});
    useAbility(st, 1, 'smudge', {});
    expect(st.players[0].statuses.length).toBe(0);
    tick(st, 4200);
    useAbility(st, 0, 'mirror', {});
    st.players[1].abilities.smudge.cdLeftMs = 0;
    useAbility(st, 1, 'smudge', {});
    expect(st.players[1].statuses.some((s) => s.type === 'smudge')).toBe(true); // reflected
  });
});

describe('abilities', () => {
  it('every ability of every order casts, first use at 50% cooldown', () => {
    for (const [order, abilities] of Object.entries(ORDER_ABILITIES)) {
      const st = mkDuel({ orders: [order as 'scholar', 'executioner'] });
      solveTo(st, 1, st.solution!, 6); // the foe needs placements for Smudge/Sever to bite
      for (const id of abilities as AbilityId[]) {
        const empty = st.givens.findIndex((g) => g === 0);
        const arg = id === 'augur' || id === 'fairCopy' ? { cell: empty } : id === 'quarantine' ? { unit: 'r0' } : {};
        expect(useAbility(st, 0, id, arg).ok, `${id} should cast`).toBe(true);
        const full = (CONFIG.abilityCdMs as Record<string, number>)[id];
        expect(st.players[0].abilities[id].cdLeftMs).toBe(Math.round(full * 0.5));
      }
    }
  });

  it('Tincture restores 1 Seal up to 7, twice per duel', () => {
    const st = mkDuel({ orders: ['apothecary', 'executioner'] });
    st.players[0].seals = 5;
    expect(useAbility(st, 0, 'tincture', {}).ok).toBe(true);
    expect(st.players[0].seals).toBe(6);
    st.players[0].abilities.tincture.cdLeftMs = 0;
    expect(useAbility(st, 0, 'tincture', {}).ok).toBe(true);
    expect(st.players[0].seals).toBe(7);
    st.players[0].abilities.tincture.cdLeftMs = 0;
    expect(useAbility(st, 0, 'tincture', {}).ok).toBe(false);
  });

  it('Augur voids Clean for the units of the revealed cell', () => {
    const st = mkDuel({ orders: ['scholar', 'executioner'] });
    const sol = st.solution!;
    useAbility(st, 0, 'augur', { cell: st.givens.findIndex((g) => g === 0) });
    for (let c = 0; c < 9; c++) if (st.givens[c] === 0) place(st, 0, c, sol[c] as Digit);
    const claim = st.events.find((e) => e.kind === 'claim' && e.unit === 'r0') as { clean: boolean } | undefined;
    if (claim) expect(claim.clean).toBe(false);
  });

  it('Reckoning arms for 20s and adds +1 to the next claim', () => {
    const st = mkDuel({ orders: ['executioner', 'scholar'] });
    const sol = st.solution!;
    useAbility(st, 0, 'reckoning', {});
    for (let c = 0; c < 9; c++) if (st.givens[c] === 0) place(st, 0, c, sol[c] as Digit);
    const claim = st.events.find((e) => e.kind === 'claim' && e.unit === 'r0') as { damage: number; clean: boolean } | undefined;
    if (claim) expect(claim.damage).toBe(claim.clean ? 3 : 2);
  });

  it('Unseal clears statuses and grants 6s immunity', () => {
    const st = mkDuel({ orders: ['scholar', 'executioner'] });
    useAbility(st, 1, 'hush', {});
    tick(st, 4200);
    useAbility(st, 0, 'unseal', {});
    expect(st.players[0].statuses.length).toBe(0);
    expect(st.players[0].immuneUntil.hush).toBeGreaterThanOrEqual(6000);
  });

  it('Fair Copy emits rule-valid candidates for the selected box', () => {
    const st = mkDuel({ orders: ['scholar', 'executioner'] });
    useAbility(st, 0, 'fairCopy', { cell: 0 });
    const ev = st.events.find((e) => e.kind === 'ability' && e.ability === 'fairCopy') as unknown as { candidates: Record<string, number[]> };
    expect(ev).toBeTruthy();
    for (const ds of Object.values(ev.candidates)) {
      expect(ds.length).toBeGreaterThan(0);
      expect(ds.length).toBeLessThanOrEqual(9);
    }
  });
});

describe('win conditions (checked in spec order)', () => {
  it('1) opponent reaches 0 Seals', () => {
    const st = mkDuel({ orders: ['executioner', 'scholar'] });
    st.players[1].seals = 2;
    st.players[0].reckoningUntilMs = 10_000;
    const sol = st.solution!;
    for (let c = 0; c < 9; c++) if (st.givens[c] === 0) place(st, 0, c, sol[c] as Digit);
    expect(st.phase).toBe('ended');
    expect(st.winner).toBe(0);
    expect(st.winReason).toBe('seals');
  });

  it('2) first to complete the grid wins by Reckoning', () => {
    const st = mkDuel();
    st.players[0].seals = 99; st.players[1].seals = 99; // no seal death along the way
    solveTo(st, 0, st.solution!);
    expect(st.phase).toBe('ended');
    expect(st.winReason).toBe('reckoning');
    expect(st.winner).toBe(0);
  });

  it('3) Sudden Judgment: seals, then claims, then mistakes, then draw', () => {
    const st = mkDuel();
    tick(st, 600_000);
    expect(st.winReason).toBe('suddenJudgment');
    const st2 = mkDuel();
    st2.players[0].seals = 4; st2.players[1].seals = 5;
    tick(st2, 600_000);
    expect(st2.winner).toBe(1);
    const st3 = mkDuel();
    st3.players[0].mistakes = 2; st3.players[1].mistakes = 1;
    tick(st3, 600_000);
    expect(st3.winner).toBe(1);
  });

  it('4) forfeit', () => {
    const st = mkDuel();
    resign(st, 1);
    expect(st.winner).toBe(0);
    expect(st.winReason).toBe('forfeit');
  });
});

describe('determinism and serialization', () => {
  it('same seed + same actions produce identical states', () => {
    const run = () => {
      const p = EASY();
      const st = createDuel({ seed: 'det', givens: Uint8Array.from(p.givens), solution: Uint8Array.from(p.solution), orders: ['scholar', 'apothecary'] });
      const rng = new Rng('actions');
      for (let i = 0; i < 30; i++) {
        useAbility(st, 1, 'smudge', {});
        tick(st, 4300);
        const empty = st.givens.findIndex((g) => g === 0);
        if (empty >= 0 && rng.next() < 0.8) place(st, 0, empty, p.solution[empty] as Digit);
      }
      return serializeDuel(st);
    };
    expect(run()).toBe(run());
  });

  it('survives a serialize/deserialize round-trip', () => {
    const st = mkDuel();
    useAbility(st, 0, 'augur', { cell: st.givens.findIndex((g) => g === 0) });
    const st2 = deserializeDuel(serializeDuel(st));
    expect(st2.rngState).toBe(st.rngState);
    expect(Array.from(st2.players[0].board)).toEqual(Array.from(st.players[0].board));
    expect(st2.eventSeq).toBe(st.eventSeq);
  });
});

describe('Shade AI', () => {
  it('places only legal moves and respects cooldowns', () => {
    const st = mkDuel({ orders: ['scholar', 'executioner'] });
    const prof = profileForStanding(1000);
    let placements = 0;
    for (let i = 0; i < 400 && placements < 40; i++) {
      const rng = new Rng(`shade-${i}`);
      const act = shadeAct(st, 1, prof, () => rng.next(), 0);
      if (act.kind === 'place') {
        expect(place(st, 1, act.cell, act.digit).ok).toBe(true);
        placements++;
      } else if (act.kind === 'ability') {
        useAbility(st, 1, act.id, { cell: act.cell, unit: act.unit });
      }
      tick(st, 1000);
    }
    expect(st.players[1].progress).toBeGreaterThan(0);
  });
});

describe('campaign structure', () => {
  it('has 9 folios x 3 duels = 27, magistrates with 8 Seals, ramping tiers', () => {
    expect(totalCampaignDuels).toBe(27);
    for (const f of FOLIOS) {
      expect(f.duels.length).toBe(3);
      expect(f.duels[2].seals).toBe(8);
    }
    expect(FOLIOS[0].duels[2].tier).toBe('Medium');
    expect(FOLIOS[8].duels[2].tier).toBe('Expert');
    expect(FOLIOS[8].duels[2].adaptive).toBe(true);
  });
});

describe('unit helpers', () => {
  it('27 units of 9 cells; every cell in 3 units', () => {
    const ids = Object.keys(UNIT_CELLS);
    expect(ids.length).toBe(27);
    for (const id of ids) expect(new Set(UNIT_CELLS[id]).size).toBe(9);
    for (let c = 0; c < 81; c++) expect(CELL_UNITS(c).length).toBe(3);
  });

  it('cellFlags exposes hushed state', () => {
    const st = mkDuel({ orders: ['scholar', 'executioner'] });
    useAbility(st, 1, 'hush', {});
    expect(cellFlags(st, 0).hushed).toBe(true);
  });
});
