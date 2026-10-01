// ASSIZE Shade AI — computer-controlled duelist (spec R7, §7).
// TODO(T7): add replay-Shades built from stored anonymized human duel logs (spec §7).
// Honest in-fiction: a Shade is an ink-echo that duels on someone's behalf.
// The Shade solves only as well as its profile allows; mistakes are plausible wrong digits.
import { CELL_UNITS, UNIT_CELLS, type AbilityId, type Digit, type OrderId, type PlayerId } from './config';
import { cellFlags, type DuelState } from './engine';

export interface ShadeProfile {
  name: string;
  order: OrderId;
  placeDelayMs: [number, number];
  mistakeRate: number;         // 0..1 — calibrated to the player's Standing (spec §7)
  abilityCadenceMs: [number, number];
  aggression: number;          // 0..1 willingness to cast
  singlesSkill: number;        // 0..1 probability of finding a logical single
}

export const profileForStanding = (standing: number): ShadeProfile => {
  const t = Math.max(0, Math.min(1, (standing - 600) / 1200));
  return {
    name: 'Shade',
    order: 'executioner',
    placeDelayMs: [3200 - 1600 * t, 5600 - 2400 * t],
    mistakeRate: 0.16 - 0.11 * t,
    abilityCadenceMs: [14000 - 5000 * t, 26000 - 8000 * t],
    aggression: 0.45 + 0.35 * t,
    singlesSkill: 0.55 + 0.4 * t,
  };
};

export type ShadeAction =
  | { kind: 'wait'; untilMs: number }
  | { kind: 'place'; cell: number; digit: Digit }
  | { kind: 'ability'; id: AbilityId; cell?: number; unit?: string };

// deterministic per-call: pass a rng-like fn so the caller controls seeding
export function shadeAct(
  st: DuelState,
  me: PlayerId,
  profile: ShadeProfile,
  rand: () => number,
  nowRealMs: number,
): ShadeAction {
  const p = st.players[me];
  const foe = st.players[me === 0 ? 1 : 0];
  if (st.phase !== 'live') return { kind: 'wait', untilMs: nowRealMs + 500 };

  // ability cadence
  const abilityReady = (Object.keys(p.abilities) as AbilityId[]).filter((a) => p.abilities[a].cdLeftMs <= 0 && p.abilities[a].usesLeft !== 0);
  if (abilityReady.length && rand() < profile.aggression * 0.35) {
    const id = abilityReady[Math.floor(rand() * abilityReady.length)];
    if (id === 'augur') {
      const empties: number[] = [];
      for (let c = 0; c < 81; c++) if (p.board[c] === 0) empties.push(c);
      if (empties.length) return { kind: 'ability', id, cell: empties[Math.floor(rand() * empties.length)] };
    } else if (id === 'quarantine') {
      const unit = `r${Math.floor(rand() * 9)}`;
      return { kind: 'ability', id, unit };
    } else {
      return { kind: 'ability', id };
    }
  }

  // placement: prefer a cell the Shade can legitimately deduce (singles), else wait
  const flags = cellFlags(st, me);
  const empties: number[] = [];
  for (let c = 0; c < 81; c++) if (p.board[c] === 0 && !flags.chained.has(c)) empties.push(c);
  if (!empties.length) return { kind: 'wait', untilMs: nowRealMs + 800 };

  // naked singles only (a Shade of modest skill does not run deep technique)
  const nakedSingle: Array<{ cell: number; digit: Digit }> = [];
  for (const c of empties) {
    const used = new Set<number>();
    for (const u of CELL_UNITS(c)) for (const cc of UNIT_CELLS[u]) if (p.board[cc]) used.add(p.board[cc]);
    const cands = ([1, 2, 3, 4, 5, 6, 7, 8, 9] as Digit[]).filter((d) => !used.has(d));
    if (cands.length === 1) nakedSingle.push({ cell: c, digit: cands[0] });
  }
  if (nakedSingle.length && rand() < profile.singlesSkill) {
    const pick = nakedSingle[Math.floor(rand() * nakedSingle.length)];
    if (rand() < profile.mistakeRate) {
      // plausible error: another digit unused in its units
      const used = new Set<number>();
      for (const u of CELL_UNITS(pick.cell)) for (const cc of UNIT_CELLS[u]) if (p.board[cc]) used.add(p.board[cc]);
      const wrongs = ([1, 2, 3, 4, 5, 6, 7, 8, 9] as Digit[]).filter((d) => !used.has(d) && d !== pick.digit);
      if (wrongs.length) return { kind: 'place', cell: pick.cell, digit: wrongs[Math.floor(rand() * wrongs.length)] };
    }
    return { kind: 'place', cell: pick.cell, digit: pick.digit };
  }

  // occasionally "rush" a plausible wrong digit when behind on tempo
  if (rand() < profile.mistakeRate * 0.5 && foe.seals <= 3) {
    const c = empties[Math.floor(rand() * empties.length)];
    const used = new Set<number>();
    for (const u of CELL_UNITS(c)) for (const cc of UNIT_CELLS[u]) if (p.board[cc]) used.add(p.board[cc]);
    const wrongs = ([1, 2, 3, 4, 5, 6, 7, 8, 9] as Digit[]).filter((d) => !used.has(d));
    if (wrongs.length) return { kind: 'place', cell: c, digit: wrongs[Math.floor(rand() * wrongs.length)] };
  }

  const [lo, hi] = profile.placeDelayMs;
  return { kind: 'wait', untilMs: nowRealMs + lo + rand() * (hi - lo) };
}
