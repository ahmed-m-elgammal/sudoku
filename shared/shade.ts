// ASSIZE Shade AI — computer-controlled duelist (spec R7, §7).
// T7: replay-Shades are built from stored human duel logs (shared/replay.ts) —
//     this module is the *calibrated* bot that faces you everywhere else:
//     campaign foes, the 4 s PvP fallback, daily, practice, echo-shelf duels.
// T16: technique ladder + tempo adaptation.
//     A Shade of modest skill finds only naked singles. Sharper tiers deduce
//     hidden singles, pair eliminations and pointing — so higher Magistrates
//     genuinely *solve*, instead of waiting for luck. Tempo adaptation shifts
//     pace/skill within a hard envelope when the Seal gap reaches 3: the Shade
//     leans in when losing and coasts when crushing, so duels stay contested
//     without ever becoming unwinnable or unloseable.
// Honest in-fiction: a Shade is an ink-echo that duels on someone's behalf;
// mistakes are plausible wrong digits, never noise.
//
// Pure module: no DOM, no timers. The caller (LocalDuel / assize-server) owns
// the clock and scheduling. All randomness flows through the caller's `rand`.
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
  techniques?: 0 | 1 | 2 | 3;  // T16 — deduction tier; absent/0 ≡ shipped naked-singles bot
  placeCadenceMs?: number;     // T17 — ink cadence after a placement/cast; absent ≡ shipped 900 ms
}

// The hard envelope every Shade profile — calibrated, adapted or mined — must
// land inside. Floors are ZERO for aggression/singlesSkill/mistakeRate: a profile
// built deliberately inert (the practice/daily “Tablet does not play”, delays
// 99999 + all-zeros) must stay inert — the envelope caps monsters, it never
// resurrects statues. Active-Shade guarantees live in profileForStanding's curve
// and in the T17 miner's own fair floors, not here.
export const PROFILE_ENVELOPE = {
  placeDelayMinMs: 700,
  placeDelayMaxMs: 9000,
  mistakeRateMin: 0,
  mistakeRateMax: 0.35,
  cadenceMinMs: 8000,
  cadenceMaxMs: 32000,
  aggressionMin: 0,
  aggressionMax: 0.95,
  singlesSkillMin: 0,
  singlesSkillMax: 0.99,
  techniquesMin: 0,
  techniquesMax: 3,
} as const;

const clamp = (v: number, lo: number, hi: number) =>
  Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : lo;

const clampDelay = (v: number) => clamp(v, PROFILE_ENVELOPE.placeDelayMinMs, PROFILE_ENVELOPE.placeDelayMaxMs);
// a delay band is an interval — an inverted [hi, lo] input is normalized, not preserved
const clampBand = (lo: number, hi: number): [number, number] => {
  const a = clampDelay(lo);
  const b = clampDelay(hi);
  return a <= b ? [a, b] : [b, a];
};

export const clampProfile = (p: ShadeProfile): ShadeProfile => ({
  name: String(p?.name ?? 'Shade').slice(0, 24) || 'Shade',
  order: p?.order ?? 'executioner',
  placeDelayMs: clampBand(Number(p?.placeDelayMs?.[0]), Number(p?.placeDelayMs?.[1])),
  mistakeRate: clamp(Number(p?.mistakeRate), PROFILE_ENVELOPE.mistakeRateMin, PROFILE_ENVELOPE.mistakeRateMax),
  abilityCadenceMs: (() => {
    const a = clamp(Number(p?.abilityCadenceMs?.[0]), PROFILE_ENVELOPE.cadenceMinMs, PROFILE_ENVELOPE.cadenceMaxMs);
    const b = clamp(Number(p?.abilityCadenceMs?.[1]), PROFILE_ENVELOPE.cadenceMinMs, PROFILE_ENVELOPE.cadenceMaxMs);
    return a <= b ? [a, b] : [b, a];
  })(),
  aggression: clamp(Number(p?.aggression), PROFILE_ENVELOPE.aggressionMin, PROFILE_ENVELOPE.aggressionMax),
  singlesSkill: clamp(Number(p?.singlesSkill), PROFILE_ENVELOPE.singlesSkillMin, PROFILE_ENVELOPE.singlesSkillMax),
  techniques: (clamp(
    Math.round(Number(p?.techniques ?? 0)),
    PROFILE_ENVELOPE.techniquesMin,
    PROFILE_ENVELOPE.techniquesMax,
  ) as 0 | 1 | 2 | 3),
  // T17 ink cadence: opt-in — undefined stays undefined (shipped 900 ms paths untouched);
  // a present-but-garbage value normalizes into [400, 20000]
  ...(p?.placeCadenceMs === undefined
    ? {}
    : { placeCadenceMs: clamp(Number(p.placeCadenceMs), 400, 20_000) }),
});

export const profileForStanding = (standing: number): ShadeProfile => {
  const t = Math.max(0, Math.min(1, (standing - 600) / 1200));
  return clampProfile({
    name: 'Shade',
    order: 'executioner',
    placeDelayMs: [3200 - 1600 * t, 5600 - 2400 * t],
    mistakeRate: 0.16 - 0.11 * t,
    abilityCadenceMs: [14000 - 5000 * t, 26000 - 8000 * t],
    aggression: 0.45 + 0.35 * t,
    singlesSkill: 0.55 + 0.4 * t,
    // T16 — deeper Clerks meet Shades that actually deduce: standing 600→tier 0,
    // 1000→tier 1, 1400+→tier 2, 1800→tier 3. Campaign shadeKind re-tiers this
    // (tieredTechniques): minor Shades one step down, bosses one step up.
    techniques: t < 0.25 ? 0 : t < 0.55 ? 1 : t < 0.85 ? 2 : 3,
  });
};

// T16 — campaign re-tiering: within a folio, minor Shades play one rung below the
// standing curve, lieutenants on it, the Magistrate (boss) one rung above.
export const tieredTechniques = (
  base: number,
  shadeKind?: 'minor' | 'lieutenant' | 'boss' | string,
): 0 | 1 | 2 | 3 => {
  const shift = shadeKind === 'minor' ? -1 : shadeKind === 'boss' ? 1 : 0;
  const raw = Math.round(Number(base) + shift);
  const tier = (Number.isFinite(raw) ? Math.max(0, Math.min(3, raw)) : 0) as 0 | 1 | 2 | 3;
  return clampProfile({ ...profileForStanding(1000), techniques: tier }).techniques!;
};

export type ShadeAction =
  | { kind: 'wait'; untilMs: number }
  | { kind: 'place'; cell: number; digit: Digit }
  | { kind: 'ability'; id: AbilityId; cell?: number; unit?: string }
  // T20 — cross-Order boss phases: the arc changes the boss's Order mid-duel.
  // Only bossAct ever returns this (shadeAct never swaps); the runtime applies it
  // through the engine's atomic swapOrder, which rebuilds ability runtimes and
  // lapses windows while preserving everything earned or suffered.
  | { kind: 'swap'; to: OrderId };

// ---------------------------------------------------------------- T16 tempo adaptation
// One sealed gap between the pleaders and the Shade changes tempo — bounded so the
// envelope can never be escaped by any state. Pure: reads state, returns a fresh
// profile; consumes no randomness (determinism is preserved by construction).
export const ADAPT_GAP = 3;

export const adaptProfile = (profile: ShadeProfile, st: DuelState, me: PlayerId): ShadeProfile => {
  const base = clampProfile(profile);
  const other = me === 0 ? 1 : 0;
  const mine = st?.players?.[me]?.seals ?? 0;
  const theirs = st?.players?.[other]?.seals ?? 0;
  const gap = mine - theirs; // <0 losing, >0 crushing
  if (!Number.isFinite(gap) || Math.abs(gap) < ADAPT_GAP) return base;
  const lean = gap < 0;
  return clampProfile({
    ...base,
    placeDelayMs: [
      base.placeDelayMs[0] * (lean ? 0.78 : 1.22),
      base.placeDelayMs[1] * (lean ? 0.78 : 1.22),
    ],
    mistakeRate: base.mistakeRate * (lean ? 0.85 : 1.12),
    singlesSkill: base.singlesSkill + (lean ? 0.12 : -0.08),
    aggression: base.aggression + (lean ? 0.1 : -0.08),
  });
};

// ---------------------------------------------------------------- T16 deduction ladder
// Candidate masks: bit (d-1) set = digit d still possible in the empty cell under
// this player's current board. A board poisoned by the Shade's own earlier mistake
// may deduce wrongly — that is honest ink, and the engine (private solution) still
// referees every placement.
const ALL_MASK = 0x1ff;

const popcount9 = (m: number): number => {
  let n = 0;
  for (let b = 0; b < 9; b++) if (m & (1 << b)) n++;
  return n;
};

export const candidateMasks = (board: Uint8Array): Uint16Array => {
  const masks = new Uint16Array(81);
  for (let c = 0; c < 81; c++) {
    if (board[c] !== 0) continue;
    let used = 0;
    for (const u of CELL_UNITS(c)) for (const cc of UNIT_CELLS[u]) if (board[cc]) used |= 1 << (board[cc] - 1);
    masks[c] = ALL_MASK & ~used;
  }
  return masks;
};

// flat 27-unit table (0..8 rows, 9..17 cols, 18..26 boxes) — built once, read hot
const UNITS: number[][] = (() => {
  const ids: string[] = [];
  for (let i = 0; i < 9; i++) { ids.push(`r${i}`, `c${i}`, `b${i}`); }
  return ids.map((id) => UNIT_CELLS[id]);
})();
const BOX_UNITS = UNITS.slice(18);

// T16 tier 2 — naked pairs: two cells of a unit holding exactly the same two
// candidates consume those digits between them; no other cell of the unit may
// still claim either. Hidden pairs: two digits confined to the same two cells
// strip every other candidate from those cells.
const applyPairEliminations = (masks: Uint16Array): void => {
  for (const unit of UNITS) {
    for (let i = 0; i < unit.length; i++) {
      const a = unit[i];
      const ma = masks[a];
      if (!ma || popcount9(ma) !== 2) continue;
      for (let j = i + 1; j < unit.length; j++) {
        const b = unit[j];
        if (masks[b] !== ma) continue;
        // naked pair {a,b} — purge both digits from the unit's other cells
        for (const c of unit) {
          if (c === a || c === b) continue;
          masks[c] = (masks[c] & ~ma) & ALL_MASK;
        }
      }
    }
    // hidden pairs: for each digit, the cells of this unit that admit it
    const cellsOfDigit: number[][] = Array.from({ length: 9 }, () => []);
    for (const c of unit) for (let d = 0; d < 9; d++) if (masks[c] & (1 << d)) cellsOfDigit[d].push(c);
    for (let d1 = 0; d1 < 9; d1++) {
      if (cellsOfDigit[d1].length !== 2) continue;
      for (let d2 = d1 + 1; d2 < 9; d2++) {
        if (cellsOfDigit[d2].length !== 2) continue;
        const [p, q] = cellsOfDigit[d1];
        if (cellsOfDigit[d2][0] !== p || cellsOfDigit[d2][1] !== q) continue;
        const keep = (1 << d1) | (1 << d2);
        masks[p] &= keep;
        masks[q] &= keep;
      }
    }
  }
};

// T16 tier 3 — pointing: a digit whose candidates inside a box all share one row
// (or column) is locked to that line — the rest of the line outside the box loses it.
const applyPointing = (masks: Uint16Array): void => {
  for (const box of BOX_UNITS) {
    for (let d = 0; d < 9; d++) {
      const bit = 1 << d;
      const cells = box.filter((c) => masks[c] & bit);
      if (cells.length < 2) continue;
      const rows = new Set(cells.map((c) => Math.floor(c / 9)));
      if (rows.size === 1) {
        const r = cells[0] - (cells[0] % 9);
        for (let i = 0; i < 9; i++) {
          const c = r + i;
          if (box.includes(c)) continue;
          masks[c] &= ~bit;
        }
      }
      const cols = new Set(cells.map((c) => c % 9));
      if (cols.size === 1) {
        const col = cells[0] % 9;
        for (let i = 0; i < 9; i++) {
          const c = i * 9 + col;
          if (box.includes(c)) continue;
          masks[c] &= ~bit;
        }
      }
    }
  }
};

// tier 0 — the shipped bot's whole repertoire: a cell whose candidate mask has
// collapsed to exactly one digit. Exported for the adversarial suite (purity pin).
export const nakedSingles = (board: Uint8Array): Array<{ cell: number; digit: Digit }> => {
  const out: Array<{ cell: number; digit: Digit }> = [];
  const masks = candidateMasks(board);
  for (let c = 0; c < 81; c++) {
    const m = masks[c];
    if (m && popcount9(m) === 1) out.push({ cell: c, digit: (Math.log2(m & -m) + 1) as Digit });
  }
  return out;
};

// tier 1 — hidden singles: within a unit, a digit admitted by exactly one cell.
// (Naked singles are subsumed: their digit is trivially "admitted by one cell".)
// Implemented inline in deducedPlacements() below, sharing one candidate sweep.

// full deduction sweep for a tier — eliminations first, then both single scans.
// Every returned placement is candidate-consistent with `board` by construction.
export const deducedPlacements = (
  board: Uint8Array,
  tier: number,
): Array<{ cell: number; digit: Digit }> => {
  const t = Math.max(0, Math.min(3, Math.floor(Number.isFinite(tier) ? tier : 0)));
  const masks = candidateMasks(board);
  if (t >= 2) applyPairEliminations(masks);
  if (t >= 3) applyPointing(masks);
  const out: Array<{ cell: number; digit: Digit }> = [];
  const seen = new Set<number>();
  for (let c = 0; c < 81; c++) {
    const m = masks[c];
    if (m && popcount9(m) === 1) {
      const d = Math.log2(m & -m);
      out.push({ cell: c, digit: (d + 1) as Digit });
      seen.add(c);
    }
  }
  if (t >= 1) {
    for (const unit of UNITS) {
      for (let d = 0; d < 9; d++) {
        const bit = 1 << d;
        let host = -1;
        let count = 0;
        for (const c of unit) {
          if (board[c] !== 0) continue;
          if (masks[c] & bit) { host = c; count++; if (count > 1) break; }
        }
        if (count === 1 && !seen.has(host)) {
          out.push({ cell: host, digit: (d + 1) as Digit });
          seen.add(host);
        }
      }
    }
  }
  return out;
};

// ---------------------------------------------------------------- the acting loop
// deterministic per-call: pass a rng-like fn so the caller controls seeding.
// T16: the profile is tempo-adapted against the live Seal gap before every decision.
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
  const prof = adaptProfile(profile, st, me);
  const tier = prof.techniques ?? 0;

  // a hushed Shade cannot place — wait out the wax instead of churning rolls
  const flags = cellFlags(st, me);
  if (flags.hushed) {
    const hush = p.statuses.find((s) => s.type === 'hush');
    const at = hush ? Math.max(400, hush.endsAtMs - st.clockMs) : 800;
    return { kind: 'wait', untilMs: nowRealMs + at };
  }

  // ability cadence
  const abilityReady = (Object.keys(p.abilities) as AbilityId[]).filter((a) => p.abilities[a].cdLeftMs <= 0 && p.abilities[a].usesLeft !== 0);
  if (abilityReady.length && rand() < prof.aggression * 0.35) {
    const id = abilityReady[Math.floor(rand() * abilityReady.length)];
    if (id === 'augur') {
      // tier >= 2: augur inside the Shade's most nearly complete unit (tempo);
      // otherwise a plain random empty cell (shipped behaviour)
      const empties: number[] = [];
      for (let c = 0; c < 81; c++) if (p.board[c] === 0) empties.push(c);
      if (empties.length) {
        if (tier >= 2) {
          const best = bestUnitFor(p.board, st.unitOwner);
          if (best) {
            const inUnit = UNIT_CELLS[best].filter((c) => p.board[c] === 0);
            if (inUnit.length) return { kind: 'ability', id, cell: inUnit[Math.floor(rand() * inUnit.length)] };
          }
        }
        return { kind: 'ability', id, cell: empties[Math.floor(rand() * empties.length)] };
      }
    } else if (id === 'quarantine') {
      // tier >= 2: quarantine the foe's most nearly complete unclaimed unit —
      // that is the claim they were about to make. Below tier 2: a random row.
      if (tier >= 2) {
        const best = bestUnitFor(foe.board, st.unitOwner);
        if (best) return { kind: 'ability', id, unit: best };
      }
      const unit = `r${Math.floor(rand() * 9)}`;
      return { kind: 'ability', id, unit };
    } else {
      return { kind: 'ability', id };
    }
  }

  // placement: prefer a cell the Shade can legitimately deduce, else wait
  const empties: number[] = [];
  for (let c = 0; c < 81; c++) if (p.board[c] === 0 && !flags.chained.has(c)) empties.push(c);
  if (!empties.length) return { kind: 'wait', untilMs: nowRealMs + 800 };

  const deduced = deducedPlacements(p.board, tier).filter((s) => !flags.chained.has(s.cell));
  if (deduced.length && rand() < prof.singlesSkill) {
    const pick = deduced[Math.floor(rand() * deduced.length)];
    if (rand() < prof.mistakeRate) {
      // plausible error: another digit unused in its units
      const used = new Set<number>();
      for (const u of CELL_UNITS(pick.cell)) for (const cc of UNIT_CELLS[u]) if (p.board[cc]) used.add(p.board[cc]);
      const wrongs = ([1, 2, 3, 4, 5, 6, 7, 8, 9] as Digit[]).filter((d) => !used.has(d) && d !== pick.digit);
      if (wrongs.length) return { kind: 'place', cell: pick.cell, digit: wrongs[Math.floor(rand() * wrongs.length)] };
    }
    return { kind: 'place', cell: pick.cell, digit: pick.digit };
  }

  // occasionally "rush" a plausible wrong digit when behind on tempo
  if (rand() < prof.mistakeRate * 0.5 && foe.seals <= 3) {
    const c = empties[Math.floor(rand() * empties.length)];
    const used = new Set<number>();
    for (const u of CELL_UNITS(c)) for (const cc of UNIT_CELLS[u]) if (p.board[cc]) used.add(p.board[cc]);
    const wrongs = ([1, 2, 3, 4, 5, 6, 7, 8, 9] as Digit[]).filter((d) => !used.has(d));
    if (wrongs.length) return { kind: 'place', cell: c, digit: wrongs[Math.floor(rand() * wrongs.length)] };
  }

  const [lo, hi] = prof.placeDelayMs;
  return { kind: 'wait', untilMs: nowRealMs + lo + rand() * (hi - lo) };
}

// most nearly complete unclaimed unit on a board (mirror of the engine's sever
// heuristic, kept local so the AI module stays engine-import-light).
// T18: exported as mostCompleteUnit — the PhaseScript signature casts (an Augur
// into the boss's best unit, a Quarantine onto the Clerk's) aim with the same eye.
const bestUnitFor = (board: Uint8Array, owner: Record<string, PlayerId>): string | null => {
  let best: string | null = null;
  let bestN = -1;
  for (let i = 0; i < 9; i++) {
    for (const pre of ['r', 'c', 'b'] as const) {
      const u = `${pre}${i}`;
      if (owner[u] !== undefined) continue;
      let n = 0;
      for (const c of UNIT_CELLS[u]) if (board[c]) n++;
      if (n === 9) continue;
      if (n > bestN) { bestN = n; best = u; }
    }
  }
  return best;
};
export const mostCompleteUnit = bestUnitFor;
