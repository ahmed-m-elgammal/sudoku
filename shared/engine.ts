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
}

export interface PlaceResult {
  ok: boolean;
  reason?: 'ended' | 'filled' | 'given' | 'chained' | 'hushed' | 'noSolution';
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
    durationMs: CONFIG.duel.durationMs,
  };
  if (opts.magistrateSeals) {
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
  const dur = (CONFIG.statusDurationsMs as Record<string, number>)[type];
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
  if (st.clockMs - st.lastStatusAtMs < CONFIG.duel.statusGlobalGapMs) return { applied: false, reason: 'gap' };
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
  const p = st.players[player];
  if (!Number.isInteger(cell) || cell < 0 || cell > 80 || digit < 1 || digit > 9) return { ok: false, reason: 'invalidTarget' };
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
    else p.seals = Math.max(0, p.seals - CONFIG.placement.wrongSealCost);
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
  let damage = CONFIG.claims.damage;
  const clean = (p.mistakesByUnit[unit] ?? 0) === 0 && !p.augurRevealed[unit];
  if (clean) damage += CONFIG.claims.cleanBonus;
  if (p.reckoningUntilMs > st.clockMs) { damage += 1; p.reckoningUntilMs = 0; }
  if (p.order === 'executioner' && foe.seals <= 3) damage += 1; // Last Rites
  foe.seals = Math.max(0, foe.seals - damage);
  pushEvent(st, 'claim', { player, unit, clean, damage });
  checkSealDeath(st, foe.id);
}

// ---------------------------------------------------------------- abilities
export function useAbility(st: DuelState, player: PlayerId, abilityId: AbilityId, arg: { cell?: number; unit?: UnitId } = {}): AbilityResult {
  if (st.phase !== 'live') return { ok: false, reason: 'ended' };
  const p = st.players[player];
  const rt = p.abilities[abilityId];
  if (!rt || !ORDER_ABILITIES[p.order].includes(abilityId)) return { ok: false, reason: 'wrongOrder' };
  if (rt.cdLeftMs > 0) return { ok: false, reason: 'cooldown' };
  if (rt.usesLeft !== null && rt.usesLeft <= 0) return { ok: false, reason: 'noUses' };
  const foe = foeOf(st, player);
  const r = rngOf(st);
  let result: AbilityResult = { ok: true, applied: true };

  const setCd = (id: AbilityId) => {
    const full = (CONFIG.abilityCdMs as Record<string, number>)[id] ?? 0;
    rt.cdLeftMs = rt.usedOnce ? full : full * CONFIG.abilities.firstUseCooldownFactor;
    rt.usedOnce = true;
    if (rt.usesLeft !== null) rt.usesLeft--;
  };

  switch (abilityId) {
    case 'augur': {
      const cell = arg.cell;
      if (cell === undefined || !st.solution || p.board[cell] !== 0) { commitRng(st, r); return { ok: false, reason: 'invalidTarget' }; }
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
      if (cell === undefined) { commitRng(st, r); return { ok: false, reason: 'invalidTarget' }; }
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
      if (!unit) { commitRng(st, r); return { ok: false, reason: 'invalidTarget' }; }
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
  pushEvent(st, 'forfeit', { player });
  endDuel(st, player === 0 ? 1 : 0, 'forfeit');
}

// ---------------------------------------------------------------- serialization
export const serializeDuel = (st: DuelState): string => JSON.stringify({
  ...st,
  givens: Array.from(st.givens),
  solution: st.solution ? Array.from(st.solution) : null,
  players: st.players.map((p) => ({ ...p, board: Array.from(p.board) })),
} as unknown as Record<string, unknown>);

export const deserializeDuel = (json: string): DuelState => {
  const o = JSON.parse(json) as Record<string, unknown>;
  const rawPlayers = o.players as unknown as Array<Record<string, unknown> & { board: number[] }>;
  const players = rawPlayers.map((p) => ({ ...(p as unknown as PlayerState), board: Uint8Array.from(p.board) })) as unknown as [PlayerState, PlayerState];
  return {
    ...(o as unknown as DuelState),
    givens: Uint8Array.from(o.givens as number[]),
    solution: o.solution ? Uint8Array.from(o.solution as number[]) : null,
    players,
  };
};

// helper for UI: cells currently unreadable (smudged) / uneditable (chained) / unclaimable
export function cellFlags(st: DuelState, player: PlayerId) {
  const p = st.players[player];
  const chained = new Set<number>();
  const smudged = new Set<number>();
  for (const s of p.statuses) {
    if (s.type === 'chain' && s.cell !== undefined) chained.add(s.cell);
    if (s.type === 'smudge' && s.cells) for (const c of s.cells) smudged.add(c);
  }
  const hushed = !!findStatus(p, 'hush');
  const miasma = !!findStatus(p, 'miasma');
  const quarantinedUnits = new Set(p.statuses.filter((s) => s.type === 'quarantine').map((s) => s.unit!));
  return { chained, smudged, hushed, miasma, quarantinedUnits };
}
