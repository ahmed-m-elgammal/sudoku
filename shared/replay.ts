// ASSIZE T7 — Replay Shades (spec §7 TODO(T7) in shade.ts). "A Shade is an ink-echo
// that duels on someone's behalf": duels are recorded as (seed, tier, orders, action log)
// and can be re-dueled against — the echo replays the recorded human's ink on its own
// tablet through the same deterministic engine.
//
// This module is pure: no DOM, no audio, no IndexedDB. The client (src/game/echoes.ts,
// LocalDuel) owns storage and the runtime loop; everything testable lives here.
//
// Hardening contract (adversarial): validateReplay is fail-closed — it NEVER throws,
// NEVER returns the input by reference (fresh objects only, so a hostile payload can
// neither pollute prototypes nor smuggle extra keys), and returns null on any violation.
import { CONFIG, ORDER_ABILITIES, UNIT_CELLS, type AbilityId, type Digit, type OrderId, type PlayerId, type Tier, type UnitId } from './config';
import type { DuelState } from './engine';

export const REPLAY_VERSION = 1;
export const REPLAY_MAX_ACTIONS = 4000;
export const REPLAY_T_GRACE_MS = 60_000; // a final resign may land just past the buzzer

export interface ReplayActionPlace { t: number; kind: 'place'; cell: number; digit: number }
export interface ReplayActionAbility { t: number; kind: 'ability'; id: AbilityId; cell?: number; unit?: UnitId }
export interface ReplayActionResign { t: number; kind: 'resign' }
export type ReplayAction = ReplayActionPlace | ReplayActionAbility | ReplayActionResign;

export interface DuelReplay {
  v: 1;
  seed: string;
  tier: Tier;
  orders: [OrderId, OrderId];
  names: [string, string];
  seals?: [number, number];
  durationMs: number;
  actions: ReplayAction[];   // the recorded human's actions; t = engine clock ms
  outcome?: { winner: 0 | 1 | 'draw'; reason: string };
}

const TIERS: readonly string[] = ['Easy', 'Medium', 'Hard', 'Expert'];
const ORDER_IDS: readonly string[] = ['scholar', 'executioner', 'apothecary', 'warden'];
const ABILITY_IDS: readonly string[] = Object.values(ORDER_ABILITIES).flat();

const isPlainObject = (x: unknown): x is Record<string, unknown> =>
  typeof x === 'object' && x !== null && !Array.isArray(x);

const isInt = (n: unknown, lo: number, hi: number): n is number =>
  typeof n === 'number' && Number.isInteger(n) && n >= lo && n <= hi;

// ---------------------------------------------------------------- validation
export function validateReplay(raw: unknown): DuelReplay | null {
  if (!isPlainObject(raw)) return null;
  if (raw.v !== REPLAY_VERSION) return null;
  const seed = raw.seed;
  if (typeof seed !== 'string' || seed.length < 1 || seed.length > 128) return null;
  const tier = raw.tier;
  if (typeof tier !== 'string' || !TIERS.includes(tier)) return null;
  const orders = raw.orders;
  if (!Array.isArray(orders) || orders.length !== 2 || !orders.every((o) => typeof o === 'string' && ORDER_IDS.includes(o))) return null;
  const names = raw.names;
  if (!Array.isArray(names) || names.length !== 2 || !names.every((n) => typeof n === 'string' && n.length <= 24)) return null;
  let seals: [number, number] | undefined;
  if (raw.seals !== undefined && raw.seals !== null) {
    const s = raw.seals;
    if (!Array.isArray(s) || s.length !== 2 || !s.every((x) => isInt(x, 1, CONFIG.seals.magistrate))) return null;
    seals = [s[0] as number, s[1] as number];
  }
  const durationMs = raw.durationMs;
  if (!isInt(durationMs, 60_000, 3_600_000)) return null;
  const actionsRaw = raw.actions;
  if (!Array.isArray(actionsRaw) || actionsRaw.length > REPLAY_MAX_ACTIONS) return null;

  let prevT = -1;
  const actions: ReplayAction[] = [];
  for (const a of actionsRaw) {
    if (!isPlainObject(a)) return null;
    const t = a.t;
    if (!isInt(t, 0, durationMs + REPLAY_T_GRACE_MS)) return null;
    if (t < prevT) return null; // the log must be time-ordered
    prevT = t;
    const keys = Object.keys(a).sort().join(',');
    if (a.kind === 'place') {
      if (keys !== 'cell,digit,kind,t') return null;
      if (!isInt(a.cell, 0, 80) || !isInt(a.digit, 1, 9)) return null;
      actions.push({ t, kind: 'place', cell: a.cell, digit: a.digit });
    } else if (a.kind === 'ability') {
      if (keys !== 'id,kind,t' && keys !== 'cell,id,kind,t' && keys !== 'id,kind,t,unit') return null;
      if (typeof a.id !== 'string' || !ABILITY_IDS.includes(a.id)) return null;
      const act: ReplayActionAbility = { t, kind: 'ability', id: a.id as AbilityId };
      if (a.cell !== undefined) {
        if (!isInt(a.cell, 0, 80)) return null;
        act.cell = a.cell;
      }
      if (a.unit !== undefined) {
        if (typeof a.unit !== 'string' || !UNIT_CELLS[a.unit]) return null;
        act.unit = a.unit;
      }
      actions.push(act);
    } else if (a.kind === 'resign') {
      if (keys !== 'kind,t') return null;
      actions.push({ t, kind: 'resign' });
    } else {
      return null;
    }
  }

  let outcome: DuelReplay['outcome'];
  if (raw.outcome !== undefined && raw.outcome !== null) {
    if (!isPlainObject(raw.outcome)) return null;
    const w = raw.outcome.winner;
    const reason = raw.outcome.reason;
    if (w !== 0 && w !== 1 && w !== 'draw') return null;
    if (typeof reason !== 'string' || reason.length > 32) return null;
    outcome = { winner: w, reason };
  }

  // rebuilt fresh — nothing from the payload escapes by reference
  return {
    v: REPLAY_VERSION,
    seed,
    tier: tier as Tier,
    orders: [orders[0] as OrderId, orders[1] as OrderId],
    names: [names[0] as string, names[1] as string],
    seals,
    durationMs,
    actions,
    outcome,
  };
}

// ---------------------------------------------------------------- recording
export interface ReplayRecorder {
  actions: ReplayAction[];
  sealed: boolean; // set once the duel has ended — no posthumous ink
}

export const newReplayRecorder = (): ReplayRecorder => ({ actions: [], sealed: false });

export const recordAction = (rec: ReplayRecorder, a: ReplayAction): void => {
  if (rec.sealed || rec.actions.length >= REPLAY_MAX_ACTIONS) return;
  rec.actions.push(a);
};

export interface ReplayMeta {
  seed: string;
  tier: Tier;
  orders: [OrderId, OrderId];
  names: [string, string];
  seals?: [number, number];
  durationMs: number;
  outcome?: { winner: 0 | 1 | 'draw'; reason: string };
}

// assembles + self-validates; a recorder that somehow produced an illegal log
// yields null instead of a poisoned echo
export const buildReplay = (rec: ReplayRecorder, meta: ReplayMeta): DuelReplay | null => {
  const candidate: unknown = { v: REPLAY_VERSION, ...meta, actions: rec.actions.slice() };
  return validateReplay(candidate);
};

// ---------------------------------------------------------------- playback
// Clock-driven, not wall-clock driven: due() releases actions when the ENGINE clock
// reaches them, so pausing the duel pauses the echo with it.
export class ReplayDriver {
  private idx = 0;
  constructor(readonly replay: DuelReplay, public readonly seat: PlayerId = 1) {}

  // all actions due at or before the current engine clock, in recorded order
  due(st: DuelState): ReplayAction[] {
    if (st.phase !== 'live') return [];
    const out: ReplayAction[] = [];
    while (this.idx < this.replay.actions.length) {
      const a = this.replay.actions[this.idx];
      if (a.t > st.clockMs) break;
      out.push(a);
      this.idx++;
    }
    return out;
  }

  nextT(): number | null {
    return this.idx < this.replay.actions.length ? this.replay.actions[this.idx].t : null;
  }

  get remaining(): number {
    return this.replay.actions.length - this.idx;
  }
}

// ---------------------------------------------------------------- echo storage helpers (pure)
export const ECHO_CAP = 12;

export const nextEchoKey = (nowMs: number, salt: number): string =>
  `echo-${nowMs.toString(36)}-${salt.toString(36)}`;

/** keys of the OLDEST echoes to evict so at most `cap` remain (ascending, ties keep the later key) */
export const echoesToEvict = (entries: Array<{ key: string; t: number }>, cap: number = ECHO_CAP): string[] => {
  const sorted = [...entries].sort((a, b) => b.t - a.t || (a.key < b.key ? 1 : -1));
  return sorted.slice(cap).map((e) => e.key).reverse();
};

/** one-line human label for the echo list */
export const describeEcho = (r: DuelReplay): string => {
  const places = r.actions.filter((a) => a.kind === 'place').length;
  const verdict = r.outcome
    ? r.outcome.winner === 0 ? 'won' : r.outcome.winner === 1 ? 'lost' : 'drawn'
    : 'unfinished';
  return `${r.tier} · ${places} ink · ${verdict}`;
};
