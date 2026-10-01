// ASSIZE duel engine — pure, deterministic, seeded (spec R6, §2).
// Time is the duel clock (ms since start). All randomness flows through state.rngState.
// The server runs this with the private solution; solo/Shade modes run it locally with solution attached.
import {
  CONFIG, ORDER_ABILITIES, STATUS_OF_ABILITY, CELL_UNITS, UNIT_CELLS,
  type AbilityId, type Digit, type OrderId, type PlayerId, type StatusType, type UnitId,
} from './config';
import { Rng } from './rng';

export interface StatusInst {
  uid: number;
  type: StatusType;
  target: PlayerId;
  endsAtMs: number;      // duel clock
  cell?: number;         // chain: locked empty cell on the target's board
  cells?: number[];      // smudge: blurred placed cells on the target's board
  unit?: UnitId;         // quarantine: unit the target cannot claim
}

export interface AbilityRuntime {
  cdLeftMs: number;
  usedOnce: boolean;
  usesLeft: number | null; // null = unlimited per duel
}

export interface PlayerState {
  id: PlayerId;
  name: string;
  order: OrderId;
  seals: number;
  mistakes: number;
  mistakesByUnit: Record<string, number>;
  augurRevealed: Record<string, boolean>; // unitId -> true (Clean claim voids)
  claimed: UnitId[];
  progress: number;
  abilities: Record<string, AbilityRuntime>;
  marginaliaUsed: boolean;  // scholar passive
  bulwarkUsed: boolean;     // warden passive
  reckoningUntilMs: number;
  wardUntilMs: number;
  mirrorUntilMs: number;
  flinchUntilMs: number;
  cdSyncedAtMs: number;     // last time cooldowns were reduced
  board: Uint8Array;        // givens + own correct placements
  statuses: StatusInst[];
  immuneUntil: Record<string, number>; // statusType -> duel-clock ms
}

export type WinReason = 'seals' | 'reckoning' | 'suddenJudgment' | 'forfeit';
export type EventKind =
  | 'placed' | 'mistake' | 'claim' | 'ink' | 'ability' | 'status' | 'statusEnded'
  | 'negated' | 'mirrored' | 'forfeit' | 'end' | 'orderSwap';

export interface DuelEvent {
  seq: number;
  atMs: number;
  kind: EventKind;
  player?: PlayerId;
  [k: string]: unknown;
}

export interface DuelState {
  seed: string;
  givens: Uint8Array;
  solution: Uint8Array | null; // server-private in PvP; present in solo/Shade
  clockMs: number;
  players: [PlayerState, PlayerState];
  unitOwner: Record<string, PlayerId>;
  phase: 'live' | 'ended';
  winner: PlayerId | 'draw' | null;
  winReason: WinReason | null;
  rngState: number;
  lastStatusAtMs: number;
  statusUid: number;
  events: DuelEvent[];
  eventSeq: number;
  durationMs: number;
  rules?: RuleMods; // T21 — the Weekly Assize overlay; absent ≡ shipped rules exactly
}

// ---------------------------------------------------------------- T21 rule modifiers
// The Weekly Assize rotates REAL rule changes, not profile tweaks. A RuleMods
// overlay is baked into the duel state at createDuel and read at the few sites
// that matter; everywhere it is absent (or fails sanitization) the shipped CONFIG
// numbers apply byte-identically — PvP, tutorial and campaign never feel it.
//   wrongSealCost  — Oxblood Ink: a wrong digit burns this many Seals
//   claimDamage    — Iron Claims: every claim deals this many Seals
//   cleanBonus     — Gilded Claims: added on top of claimDamage for a clean claim
//   statusScale    — Thick Wax: multiplies every status duration
//   cdScale        — Long Shadows: multiplies every ability cooldown
//   statusGapScale — Vengeful Wax: scales the anti-frustration gap BETWEEN statuses
//   durationMs     — Hasty Court: the duel's own length
export interface RuleMods {
  wrongSealCost?: number;
  claimDamage?: number;
  cleanBonus?: number;
  statusScale?: number;
  cdScale?: number;
  statusGapScale?: number;
  durationMs?: number;
}

// fail-closed normalization: unknown keys never survive, non-finite numbers never
// survive, every survivor is clamped into a range that cannot produce an
// unwinnable or instant duel. Runs on createDuel input AND on snapshots coming
// off the wire (deserializeDuel) — a hostile payload cannot corrupt an engine read.
export const sanitizeRuleMods = (v: unknown): RuleMods | undefined => {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return undefined;
  const o = v as Record<string, unknown>;
  const num = (x: unknown, lo: number, hi: number): number | undefined => {
    if (typeof x !== 'number' || !Number.isFinite(x)) return undefined;
    return Math.min(hi, Math.max(lo, x));
  };
  const out: RuleMods = {};
  const w = num(o.wrongSealCost, 1, 3); if (w !== undefined) out.wrongSealCost = w;
  const dmg = num(o.claimDamage, 1, 3); if (dmg !== undefined) out.claimDamage = dmg;
  const cb = num(o.cleanBonus, 0, 3); if (cb !== undefined) out.cleanBonus = cb;
  const ss = num(o.statusScale, 0.5, 2); if (ss !== undefined) out.statusScale = ss;
  const cs = num(o.cdScale, 0.5, 2); if (cs !== undefined) out.cdScale = cs;
  const sg = num(o.statusGapScale, 0.25, 2); if (sg !== undefined) out.statusGapScale = sg;
  const du = num(o.durationMs, 60_000, 1_200_000); if (du !== undefined) out.durationMs = Math.round(du);
  return Object.keys(out).length ? out : undefined;
};

// the one read helper — engine code asks through this so an absent overlay and an
// empty overlay behave identically
export const rulesOf = (st: DuelState): RuleMods => st?.rules ?? {};

export interface PlaceResult {
  ok: boolean;
  reason?: 'ended' | 'filled' | 'given' | 'chained' | 'hushed' | 'noSolution' | 'invalidTarget';
  correct?: boolean;
  claim?: { unit: UnitId; clean: boolean; damage: number; deferred?: boolean };
  inkAward?: number;
}

export interface AbilityResult {
  ok: boolean;
  reason?: 'ended' | 'unknown' | 'wrongOrder' | 'cooldown' | 'noUses' | 'invalidTarget' | 'banned';
  applied?: boolean;
  statusReflected?: boolean;
  statusNegated?: boolean;
}

// ---------------------------------------------------------------- creation
// Known-status / known-ability sets — hostile-input hardening (adversarial suite H/H16).
const VALID_STATUS: readonly string[] = ['chain', 'smudge', 'hush', 'miasma', 'quarantine'];
const ALL_ABILITIES = new Set<AbilityId>(Object.values(ORDER_ABILITIES).flat());

const newPlayer = (id: PlayerId, name: string, order: OrderId): PlayerState => ({
  id, name, order,
  seals: CONFIG.seals.start,
  mistakes: 0,
  mistakesByUnit: {},
  augurRevealed: {},
  claimed: [],
  progress: 0,
  abilities: Object.fromEntries(
    ORDER_ABILITIES[order].map((a) => [a, { cdLeftMs: 0, usedOnce: false, usesLeft: a === 'tincture' ? CONFIG.abilityCdMs.tinctureUsesPerDuel : null }]),
  ),
  marginaliaUsed: false,
  bulwarkUsed: false,
  reckoningUntilMs: 0,
  wardUntilMs: 0,
  mirrorUntilMs: 0,
  flinchUntilMs: 0,
  cdSyncedAtMs: 0,
  board: new Uint8Array(81),
  statuses: [],
  immuneUntil: {},
});

export interface CreateDuelOpts {
  seed: string;
  givens: Uint8Array;
  solution?: Uint8Array | null;
  names?: [string, string];
  orders?: [OrderId, OrderId];
  magistrateSeals?: [number, number];
  mods?: RuleMods; // T21 — the Weekly Assize overlay (sanitized before it touches state)
}

export function createDuel(opts: CreateDuelOpts): DuelState {
  const rng = new Rng(opts.seed);
  const st: DuelState = {
    seed: opts.seed,
    givens: opts.givens,
    solution: opts.solution ?? null,
    clockMs: 0,
    players: [
      newPlayer(0, opts.names?.[0] ?? 'You', opts.orders?.[0] ?? 'scholar'),
      newPlayer(1, opts.names?.[1] ?? 'Foe', opts.orders?.[1] ?? 'executioner'),
    ],
    unitOwner: {},
    phase: 'live',
    winner: null,
    winReason: null,
    rngState: rng.state,
    lastStatusAtMs: -CONFIG.duel.statusGlobalGapMs,
    statusUid: 1,
    events: [],
    eventSeq: 1,
    durationMs: sanitizeRuleMods(opts.mods)?.durationMs ?? CONFIG.duel.durationMs,
    rules: sanitizeRuleMods(opts.mods),
  };
  if (opts.magistrateSeals) {
    for (let i = 0; i < 2; i++) {
      const s = opts.magistrateSeals[i];
      if (!Number.isInteger(s) || s < 1 || s > CONFIG.seals.magistrate)
        throw new RangeError(`magistrateSeals[${i}] must be an integer in [1, ${CONFIG.seals.magistrate}], got ${s}`);
    }
    st.players[0].seals = opts.magistrateSeals[0];
    st.players[1].seals = opts.magistrateSeals[1];
  }
  for (const p of st.players) p.board.set(opts.givens);
  return st;
}

const rngOf = (st: DuelState): Rng => {
  const r = new Rng(1);
  r.state = st.rngState;
  return r;
};
const commitRng = (st: DuelState, r: Rng) => { st.rngState = r.state; };

export const pushEvent = (st: DuelState, kind: EventKind, data: Omit<DuelEvent, 'seq' | 'atMs' | 'kind'> = {}) => {
  st.events.push({ seq: st.eventSeq++, atMs: Math.round(st.clockMs), kind, ...data });
  if (st.events.length > 120) st.events.splice(0, st.events.length - 120);
};

// ---------------------------------------------------------------- internal helpers
const findStatus = (p: PlayerState, type: StatusType) => p.statuses.find((s) => s.type === type);
const foeOf = (st: DuelState, p: PlayerId) => st.players[p === 0 ? 1 : 0];

function endDuel(st: DuelState, winner: PlayerId | 'draw', reason: WinReason) {
  if (st.phase === 'ended') return;
  st.phase = 'ended';
  st.winner = winner;
  st.winReason = reason;
  pushEvent(st, 'end', { winner, reason });
}

function checkSealDeath(st: DuelState, loser: PlayerId) {
  if (st.players[loser].seals <= 0) endDuel(st, loser === 0 ? 1 : 0, 'seals');
}

function unitComplete(st: DuelState, p: PlayerState, unit: UnitId): boolean {
  return UNIT_CELLS[unit].every((c) => p.board[c] !== 0);
}

// the most nearly complete unclaimed unit on p's board (ties broken by seeded rng)
function mostNearlyComplete(st: DuelState, p: PlayerState, r: Rng): UnitId | null {
  const all: UnitId[] = [];
  for (let i = 0; i < 9; i++) { all.push(`r${i}`, `c${i}`, `b${i}`); }
  let best: UnitId[] = [];
  let bestN = -1;
  for (const u of all) {
    if (st.unitOwner[u] !== undefined) continue;
    const cells = UNIT_CELLS[u];
    const n = cells.filter((c) => p.board[c] !== 0).length;
    if (n === 9) continue; // must still have an empty cell to target
    if (n > bestN) { bestN = n; best = [u]; }
    else if (n === bestN) best.push(u);
  }
  if (!best.length) return null;
  return best.length === 1 ? best[0] : r.pick(best);
}

// ---------------------------------------------------------------- statuses
export interface ApplyStatusOpts {
  cell?: number;
  unit?: UnitId;
  cells?: number[];
}

export function applyStatus(st: DuelState, source: PlayerId, type: StatusType, target: PlayerId, opts: ApplyStatusOpts = {}):
  { applied: boolean; reflected?: boolean; reason?: string } {
  if (st.phase !== 'live') return { applied: false, reason: 'ended' };
  // hostile-input hardening: unknown types used to push NaN-lived statuses, garbage
  // cells/units used to be stored verbatim (adversarial suite H16/H11)
  if (source !== 0 && source !== 1) return { applied: false, reason: 'invalid' };
  if (target !== 0 && target !== 1) return { applied: false, reason: 'invalid' };
  if (!VALID_STATUS.includes(type)) return { applied: false, reason: 'invalid' };
  if (opts.cell !== undefined && (!Number.isInteger(opts.cell) || opts.cell < 0 || opts.cell > 80)) return { applied: false, reason: 'invalid' };
  if (opts.cells && (!opts.cells.length || !opts.cells.every((c) => Number.isInteger(c) && c >= 0 && c <= 80))) return { applied: false, reason: 'invalid' };
  if (opts.unit !== undefined && !UNIT_CELLS[opts.unit]) return { applied: false, reason: 'invalid' };
  const dur = (CONFIG.statusDurationsMs as Record<string, number>)[type] * (rulesOf(st).statusScale ?? 1); // T21 Thick Wax
  // Apothecary Distiller: statuses you apply last +2s
  const bonus = st.players[source].order === 'apothecary' && (type === 'smudge' || type === 'miasma') ? 2000 : 0;
  const foe = foeOf(st, source);
  let tgt: PlayerId = target;

  // Reflection (Warden Mirror) — reflect back within the armed window
  if (foe.mirrorUntilMs > st.clockMs) {
    foe.mirrorUntilMs = 0;
    tgt = source;
    pushEvent(st, 'mirrored', { player: target, abilitySource: source, status: type });
  }

  const tp = st.players[tgt];
  // Warden Bulwark — the first incoming status each duel is negated
  if (tp.order === 'warden' && !tp.bulwarkUsed) {
    tp.bulwarkUsed = true;
    pushEvent(st, 'negated', { player: tgt, status: type, by: 'bulwark' });
    return { applied: false, reason: 'bulwark' };
  }
  // Ward — negate the next incoming status within 15s
  if (tp.wardUntilMs > st.clockMs) {
    tp.wardUntilMs = 0;
    pushEvent(st, 'negated', { player: tgt, status: type, by: 'ward' });
    return { applied: false, reason: 'ward' };
  }
  // Anti-frustration rules (spec §2)
  if (st.clockMs > st.durationMs - CONFIG.duel.finalStatusBanMs) return { applied: false, reason: 'finalBan' };
  if (st.clockMs - st.lastStatusAtMs < CONFIG.duel.statusGlobalGapMs * (rulesOf(st).statusGapScale ?? 1)) return { applied: false, reason: 'gap' }; // T21 Vengeful Wax
  if (findStatus(tp, type)) return { applied: false, reason: 'active' };
  if ((tp.immuneUntil[type] ?? 0) > st.clockMs) return { applied: false, reason: 'immune' };

  st.lastStatusAtMs = st.clockMs;
  const inst: StatusInst = { uid: st.statusUid++, type, target: tgt, endsAtMs: st.clockMs + dur + bonus };
  if (opts.cell !== undefined) inst.cell = opts.cell;
  if (opts.cells) inst.cells = opts.cells;
  if (opts.unit !== undefined) inst.unit = opts.unit;
  tp.statuses.push(inst);
  pushEvent(st, 'status', { player: tgt, from: source, status: type, ...opts });
  return { applied: true };
}

// ---------------------------------------------------------------- placement
export function place(st: DuelState, player: PlayerId, cell: number, digit: Digit): PlaceResult {
  if (st.phase !== 'live') return { ok: false, reason: 'ended' };
  // hostile-input hardening: invalid seats used to crash (TypeError on p.board), and
  // NaN/2.5 digits passed the old range check and burned Seals as fake mistakes
  if (player !== 0 && player !== 1) return { ok: false, reason: 'invalidTarget' };
  const p = st.players[player];
  if (!Number.isInteger(cell) || cell < 0 || cell > 80) return { ok: false, reason: 'invalidTarget' };
  if (!Number.isInteger(digit) || digit < 1 || digit > 9) return { ok: false, reason: 'invalidTarget' };
  if (p.board[cell] !== 0) return { ok: false, reason: p.board[cell] === st.givens[cell] ? 'given' : 'filled' };
  if (findStatus(p, 'hush')) return { ok: false, reason: 'hushed' };
  if (findStatus(p, 'chain')?.cell === cell) return { ok: false, reason: 'chained' };
  if (!st.solution) return { ok: false, reason: 'noSolution' };

  const correct = st.solution[cell] === digit;
  if (!correct) {
    p.mistakes++;
    for (const u of CELL_UNITS(cell)) p.mistakesByUnit[u] = (p.mistakesByUnit[u] ?? 0) + 1;
    const forgiven = p.order === 'scholar' && !p.marginaliaUsed;
    if (forgiven) p.marginaliaUsed = true;
    else p.seals = Math.max(0, p.seals - (rulesOf(st).wrongSealCost ?? CONFIG.placement.wrongSealCost)); // T21 Oxblood Ink
    p.flinchUntilMs = st.clockMs + CONFIG.placement.flinchMs; // "Flinch"
    pushEvent(st, 'mistake', { player, cell, digit, forgiven, sealsLeft: p.seals });
    checkSealDeath(st, player);
    return { ok: true, correct: false };
  }

  p.board[cell] = digit;
  p.progress++;
  // Momentum: each correct placement reduces all your cooldowns by 0.5s
  for (const a of Object.values(p.abilities)) a.cdLeftMs = Math.max(0, a.cdLeftMs - CONFIG.placement.momentumReductionMs);
  pushEvent(st, 'placed', { player, cell, digit });

  // Claims
  for (const u of CELL_UNITS(cell)) {
    if (st.unitOwner[u] !== undefined) continue;
    if (!unitComplete(st, p, u)) continue;
    const foe = foeOf(st, player);
    const quarantined = findStatus(p, 'quarantine')?.unit === u;
    if (quarantined) {
      // QUARANTINE: cannot be claimed by them while active — deferred until it ends
      const q = findStatus(p, 'quarantine')!;
      (q as StatusInst & { pendingClaim?: { player: PlayerId; unit: UnitId } }).pendingClaim = { player, unit: u };
      pushEvent(st, 'claim', { player, unit: u, deferred: true });
      continue;
    }
    resolveClaim(st, player, u);
  }

  if (p.board.every((v) => v !== 0)) endDuel(st, player, 'reckoning');
  return { ok: true, correct: true };
}

function resolveClaim(st: DuelState, player: PlayerId, unit: UnitId) {
  const p = st.players[player];
  const foe = foeOf(st, player);
  st.unitOwner[unit] = player;
  p.claimed.push(unit);
  let damage = rulesOf(st).claimDamage ?? CONFIG.claims.damage; // T21 Iron Claims
  const clean = (p.mistakesByUnit[unit] ?? 0) === 0 && !p.augurRevealed[unit];
  if (clean) damage += rulesOf(st).cleanBonus ?? CONFIG.claims.cleanBonus; // T21 Gilded Claims
  if (p.reckoningUntilMs > st.clockMs) { damage += 1; p.reckoningUntilMs = 0; }
  if (p.order === 'executioner' && foe.seals <= 3) damage += 1; // Last Rites
  foe.seals = Math.max(0, foe.seals - damage);
  pushEvent(st, 'claim', { player, unit, clean, damage });
  checkSealDeath(st, foe.id);
}

// ---------------------------------------------------------------- abilities
export function useAbility(st: DuelState, player: PlayerId, abilityId: AbilityId, arg: { cell?: number; unit?: UnitId } = {}): AbilityResult {
  if (st.phase !== 'live') return { ok: false, reason: 'ended' };
  if (player !== 0 && player !== 1) return { ok: false, reason: 'invalidTarget' };
  const p = st.players[player];
  if (!ALL_ABILITIES.has(abilityId)) return { ok: false, reason: 'unknown' };
  const rt = p.abilities[abilityId];
  if (!rt || !ORDER_ABILITIES[p.order].includes(abilityId)) return { ok: false, reason: 'wrongOrder' };
  if (rt.cdLeftMs > 0) return { ok: false, reason: 'cooldown' };
  if (rt.usesLeft !== null && rt.usesLeft <= 0) return { ok: false, reason: 'noUses' };
  const foe = foeOf(st, player);
  const r = rngOf(st);
  let result: AbilityResult = { ok: true, applied: true };

  const setCd = (id: AbilityId) => {
    const full = ((CONFIG.abilityCdMs as Record<string, number>)[id] ?? 0) * (rulesOf(st).cdScale ?? 1); // T21 Long Shadows
    rt.cdLeftMs = rt.usedOnce ? full : full * CONFIG.abilities.firstUseCooldownFactor;
    rt.usedOnce = true;
    if (rt.usesLeft !== null) rt.usesLeft--;
  };

  switch (abilityId) {
    case 'augur': {
      const cell = arg.cell;
      if (cell === undefined || !Number.isInteger(cell) || cell < 0 || cell > 80 || !st.solution || p.board[cell] !== 0) { commitRng(st, r); return { ok: false, reason: 'invalidTarget' }; }
      for (const u of CELL_UNITS(cell)) p.augurRevealed[u] = true;
      pushEvent(st, 'ability', { player, ability: 'augur', cell, digit: st.solution[cell] });
      setCd(abilityId);
      break;
    }
    case 'unseal': {
      const cleared = p.statuses.length;
      p.statuses = [];
      for (const t of ['chain', 'smudge', 'hush', 'miasma', 'quarantine'] as StatusType[])
        p.immuneUntil[t] = st.clockMs + CONFIG.abilityCdMs.unsealImmunityMs;
      pushEvent(st, 'ability', { player, ability: 'unseal', cleared });
      setCd(abilityId);
      break;
    }
    case 'fairCopy': {
      const cell = arg.cell;
      if (cell === undefined || !Number.isInteger(cell) || cell < 0 || cell > 80 || p.board[cell] !== 0) { commitRng(st, r); return { ok: false, reason: 'invalidTarget' }; }
      const box = CELL_UNITS(cell)[2];
      const cands: Record<number, number[]> = {};
      for (const c of UNIT_CELLS[box]) {
        if (p.board[c] !== 0) continue;
        const used = new Set<number>();
        for (const u of CELL_UNITS(c)) for (const cc of UNIT_CELLS[u]) if (p.board[cc]) used.add(p.board[cc]);
        cands[c] = ([1, 2, 3, 4, 5, 6, 7, 8, 9] as number[]).filter((d) => !used.has(d));
      }
      pushEvent(st, 'ability', { player, ability: 'fairCopy', box, candidates: cands });
      setCd(abilityId);
      break;
    }
    case 'sever': {
      const unit = mostNearlyComplete(st, foe, r);
      if (!unit) { commitRng(st, r); return { ok: false, reason: 'invalidTarget' }; }
      const empty = UNIT_CELLS[unit].filter((c) => foe.board[c] === 0);
      const cell = empty.length ? r.pick(empty) : undefined;
      const res = applyStatus(st, player, 'chain', foe.id, cell !== undefined ? { cell } : {});
      result = { ok: true, applied: res.applied, statusNegated: !res.applied };
      pushEvent(st, 'ability', { player, ability: 'sever', unit, cell });
      setCd(abilityId);
      break;
    }
    case 'hush': {
      const res = applyStatus(st, player, 'hush', foe.id);
      result = { ok: true, applied: res.applied, statusNegated: !res.applied };
      pushEvent(st, 'ability', { player, ability: 'hush' });
      setCd(abilityId);
      break;
    }
    case 'reckoning': {
      p.reckoningUntilMs = st.clockMs + CONFIG.abilityCdMs.reckoningWindowMs;
      pushEvent(st, 'ability', { player, ability: 'reckoning', untilMs: p.reckoningUntilMs });
      setCd(abilityId);
      break;
    }
    case 'smudge': {
      const placed: number[] = [];
      for (let c = 0; c < 81; c++) if (foe.board[c] !== 0 && st.givens[c] === 0) placed.push(c);
      const cells = r.shuffle(placed).slice(0, CONFIG.statusDurationsMs.smudgeDigits);
      if (!cells.length) { commitRng(st, r); return { ok: false, reason: 'invalidTarget' }; }
      const res = applyStatus(st, player, 'smudge', foe.id, { cells });
      result = { ok: true, applied: res.applied, statusNegated: !res.applied };
      pushEvent(st, 'ability', { player, ability: 'smudge', cells: res.applied ? cells : undefined });
      setCd(abilityId);
      break;
    }
    case 'tincture': {
      if (p.seals >= CONFIG.seals.tinctureCap) { commitRng(st, r); return { ok: false, reason: 'invalidTarget' }; }
      p.seals = Math.min(CONFIG.seals.tinctureCap, p.seals + 1);
      pushEvent(st, 'ability', { player, ability: 'tincture', seals: p.seals });
      setCd(abilityId);
      break;
    }
    case 'miasma': {
      const res = applyStatus(st, player, 'miasma', foe.id);
      result = { ok: true, applied: res.applied, statusNegated: !res.applied };
      pushEvent(st, 'ability', { player, ability: 'miasma' });
      setCd(abilityId);
      break;
    }
    case 'ward': {
      p.wardUntilMs = st.clockMs + CONFIG.abilityCdMs.wardNegateWindowMs;
      pushEvent(st, 'ability', { player, ability: 'ward', untilMs: p.wardUntilMs });
      setCd(abilityId);
      break;
    }
    case 'mirror': {
      p.mirrorUntilMs = st.clockMs + CONFIG.abilityCdMs.mirrorReflectWindowMs;
      pushEvent(st, 'ability', { player, ability: 'mirror', untilMs: p.mirrorUntilMs });
      setCd(abilityId);
      break;
    }
    case 'quarantine': {
      const unit = arg.unit ?? mostNearlyComplete(st, foe, r) ?? undefined;
      if (!unit || (arg.unit !== undefined && !UNIT_CELLS[arg.unit])) { commitRng(st, r); return { ok: false, reason: 'invalidTarget' }; }
      const res = applyStatus(st, player, 'quarantine', foe.id, { unit });
      result = { ok: true, applied: res.applied, statusNegated: !res.applied };
      pushEvent(st, 'ability', { player, ability: 'quarantine', unit: res.applied ? unit : undefined });
      setCd(abilityId);
      break;
    }
    default:
      commitRng(st, r);
      return { ok: false, reason: 'unknown' };
  }
  commitRng(st, r);
  return result;
}

// ---------------------------------------------------------------- clock
export function tick(st: DuelState, dtMs: number) {
  if (st.phase !== 'live') return;
  // hostile-input hardening: NaN used to brick the duel permanently (clock stuck at
  // NaN, nothing ever expires), Infinity insta-ended it, negatives rewound time
  if (!Number.isFinite(dtMs) || dtMs < 0) return;
  st.clockMs += dtMs;
  for (const p of st.players) {
    // status expiry + per-type immunity
    for (const s of [...p.statuses]) {
      if (s.endsAtMs <= st.clockMs) {
        p.statuses = p.statuses.filter((x) => x.uid !== s.uid);
        p.immuneUntil[s.type] = st.clockMs + CONFIG.duel.statusImmunityMs;
        // deferred claim under an expired quarantine resolves now
        const pend = (s as StatusInst & { pendingClaim?: { player: PlayerId; unit: UnitId } }).pendingClaim;
        if (pend && s.type === 'quarantine' && st.unitOwner[pend.unit] === undefined && unitComplete(st, st.players[pend.player], pend.unit)) {
          resolveClaim(st, pend.player, pend.unit);
        }
        pushEvent(st, 'statusEnded', { player: p.id, status: s.type });
      }
    }
    // cooldowns (Flinch pauses them)
    if (st.clockMs >= p.flinchUntilMs) {
      const dt = st.clockMs - p.cdSyncedAtMs;
      if (dt > 0) for (const a of Object.values(p.abilities)) a.cdLeftMs = Math.max(0, a.cdLeftMs - dt);
    }
    p.cdSyncedAtMs = st.clockMs;
  }
  // Sudden Judgment (win condition 3)
  if (st.clockMs >= st.durationMs) {
    const [a, b] = st.players;
    if (a.seals !== b.seals) endDuel(st, a.seals > b.seals ? 0 : 1, 'suddenJudgment');
    else if (a.claimed.length !== b.claimed.length) endDuel(st, a.claimed.length > b.claimed.length ? 0 : 1, 'suddenJudgment');
    else if (a.mistakes !== b.mistakes) endDuel(st, a.mistakes < b.mistakes ? 0 : 1, 'suddenJudgment');
    else endDuel(st, 'draw', 'suddenJudgment');
  }
}

export function resign(st: DuelState, player: PlayerId) {
  if (st.phase !== 'live') return;
  if (player !== 0 && player !== 1) return;
  pushEvent(st, 'forfeit', { player });
  endDuel(st, player === 0 ? 1 : 0, 'forfeit');
}

// ---------------------------------------------------------------- order swap (T4)
// Orsolo's adaptive phase: one mid-duel Order swap. The new Order arrives fresh —
// ability runtimes rebuilt (first casts start at the 50% first-use factor), the new
// Order's passive flags reset — while everything earned or suffered so far (Seals,
// claims, board, statuses, immunity) is kept exactly as it was. Outgoing ability
// windows (Reckoning / Ward / Mirror) lapse: the rites that armed them are gone.
export function swapOrder(st: DuelState, player: PlayerId, newOrder: OrderId): boolean {
  if (st.phase !== 'live') return false;
  if (player !== 0 && player !== 1) return false;
  if (!(newOrder in ORDER_ABILITIES)) return false; // unknown ids used to crash on ORDER_ABILITIES[bad].map
  const p = st.players[player];
  if (p.order === newOrder) return false;
  const from = p.order;
  p.order = newOrder;
  p.abilities = Object.fromEntries(
    ORDER_ABILITIES[newOrder].map((a) => [a, { cdLeftMs: 0, usedOnce: false, usesLeft: a === 'tincture' ? CONFIG.abilityCdMs.tinctureUsesPerDuel : null }]),
  );
  p.marginaliaUsed = false; // Scholar's Marginalia returns unworn
  p.bulwarkUsed = false;    // Warden's Bulwark returns unworn
  p.reckoningUntilMs = 0;
  p.wardUntilMs = 0;
  p.mirrorUntilMs = 0;
  pushEvent(st, 'orderSwap', { player, from, to: newOrder });
  return true;
}

// ---------------------------------------------------------------- serialization
export const serializeDuel = (st: DuelState): string => JSON.stringify({
  ...st,
  givens: Array.from(st.givens),
  solution: st.solution ? Array.from(st.solution) : null,
  players: st.players.map((p) => ({ ...p, board: Array.from(p.board) })),
} as unknown as Record<string, unknown>);

// shape validation for snapshots coming off the wire — a hostile payload used to
// crash with raw TypeErrors or (worse) silently modulo bytes into Uint8Array
const byteGrid = (v: unknown, what: string): number[] => {
  if (!Array.isArray(v) || v.length !== 81 || !v.every((n) => typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= 255))
    throw new Error(`malformed duel snapshot: ${what}`);
  return v as number[];
};

export const deserializeDuel = (json: string): DuelState => {
  let o: Record<string, unknown>;
  try { o = JSON.parse(json) as Record<string, unknown>; }
  catch { throw new Error('malformed duel snapshot: not JSON'); }
  if (!o || typeof o !== 'object' || Array.isArray(o)) throw new Error('malformed duel snapshot: root');
  if (!Array.isArray(o.players) || o.players.length !== 2) throw new Error('malformed duel snapshot: players');
  if (!Array.isArray(o.events)) throw new Error('malformed duel snapshot: events');
  const givens = byteGrid(o.givens, 'givens');
  const sol = o.solution === null || o.solution === undefined ? null : byteGrid(o.solution, 'solution');
  const players = (o.players as Array<Record<string, unknown>>).map((p) => {
    if (!p || typeof p !== 'object' || Array.isArray(p)) throw new Error('malformed duel snapshot: player');
    return { ...(p as unknown as PlayerState), board: Uint8Array.from(byteGrid(p.board, 'player board')) };
  }) as unknown as [PlayerState, PlayerState];
  return {
    ...(o as unknown as DuelState),
    givens: Uint8Array.from(givens),
    solution: sol ? Uint8Array.from(sol) : null,
    players,
    rules: sanitizeRuleMods(o.rules), // T21 — a hostile snapshot cannot corrupt a rule read
  };
};

// helper for UI: cells currently unreadable (smudged) / uneditable (chained) / unclaimable
export function cellFlags(st: DuelState, player: PlayerId) {
  const chained = new Set<number>();
  const smudged = new Set<number>();
  if (player !== 0 && player !== 1) return { chained, smudged, hushed: false, miasma: false, quarantinedUnits: new Set<UnitId>() };
  const p = st.players[player];
  for (const s of p.statuses) {
    if (s.type === 'chain' && s.cell !== undefined) chained.add(s.cell);
    if (s.type === 'smudge' && s.cells) for (const c of s.cells) smudged.add(c);
  }
  const hushed = !!findStatus(p, 'hush');
  const miasma = !!findStatus(p, 'miasma');
  const quarantinedUnits = new Set(p.statuses.filter((s) => s.type === 'quarantine').map((s) => s.unit!));
  return { chained, smudged, hushed, miasma, quarantinedUnits };
}
