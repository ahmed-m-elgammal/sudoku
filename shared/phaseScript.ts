// ASSIZE T18 — PhaseScript bosses. The T3 tutorial proved the pattern: a pure
// scripted controller (script state + duel state + seeded rng → ShadeAction) that
// LocalDuel drives through the same engine a human plays on. This module
// generalizes that pattern from "one scripted loser" to a *ladder of phases*:
//
//   a BossScript is an ordered list of PhaseRules. The boss lives in exactly one
//   phase; the ladder only ever ADVANCES (never regresses — a Magistrate does not
//   un-lose their composure), and each rule carries:
//     · when      — engine-observable conditions (clock, Seals, claims, ink),
//                   all ANDed; a rule expressing NO finite condition never
//                   matches (a garbage script degrades to the base Shade, it
//                   never hands the boss an unconditional god-phase);
//     · patch     — tempo/skill deltas merged onto the duel's base profile
//                   (multiplicative pace, additive mistake/skill/aggression),
//                   then through clampProfile so the envelope still holds;
//     · signature — one-shot rites at phase entry: dispatched on the first wake
//                   where the rite is actually LEGAL (own Order, off cooldown,
//                   uses left), so an entry cast is "as soon as the rite
//                   recovers", never a fizzle and never a stall.
//
// Pure module: no DOM, no timers, no clock. Determinism by construction: the
// phase scan consumes no randomness (engine-observable facts only) and the
// signature resolver picks deterministic cells/units; all randomness stays in
// the delegated shadeAct call under the caller's seeded rng.
//
// Adversarial posture: hostile scripts (empty phases, NaN/Infinity conditions,
// unknown signature ids, foreign-Order casts after Orsolo's T4 swap) are
// fail-closed — they degrade to the calibrated Shade acting on the phase-merged
// profile, they never throw and never hand out illegal actions. The engine
// remains the referee either way.
import { UNIT_CELLS, type AbilityId, type PlayerId } from './config';
import { clampProfile, shadeAct, mostCompleteUnit, type ShadeProfile } from './shade';
import type { DuelState } from './engine';
import type { ShadeAction } from './shade';

// ---------------------------------------------------------------- types
// engine-observable triggers, all ANDed. Unknown/NaN fields make the whole
// condition false (fail-closed), and a `when` with no finite field never matches.
export interface PhaseWhen {
  clockAfterMs?: number;      // duel clock has passed this point
  ownSealsBelow?: number;     // the boss has lost enough Seals — desperation
  foeSealsBelow?: number;     // the Clerk is bleeding — press
  ownClaimsAtLeast?: number;  // the boss has claimed enough territory
  ownInkAtLeast?: number;     // the boss has set enough true ink
}

// tempo/skill deltas — RELATIVE to the duel's base profile so a boss script
// scales with Standing instead of pinning absolute numbers.
//   paceFactor multiplies both placeDelayMs entries (clamped to the envelope);
//   the adds shift mistakeRate / singlesSkill / aggression (envelope-clamped).
export interface PhasePatch {
  paceFactor?: number;
  mistakeAdd?: number;
  skillAdd?: number;
  aggressionAdd?: number;
}

// a one-shot rite at phase entry. Targeting: augur aims into the boss's most
// nearly complete unit; quarantine onto the Clerk's. Everything else casts bare.
export interface PhaseSignature {
  id: AbilityId;
}

export interface PhaseRule {
  when: PhaseWhen;       // ignored for phases[0] (the entry phase)
  patch?: PhasePatch;
  signature?: PhaseSignature[];
}

export interface BossScript {
  id: string;
  phases: PhaseRule[];   // ladder order; phases[0] is the entry phase
}

// per-duel mutable state — the caller owns it, exactly like TutorialScriptState
export interface BossScriptState {
  phaseIdx: number;
  pendingSig: PhaseSignature[] | null; // signatures of the currently entered phase
}

export const newBossScriptState = (): BossScriptState => ({ phaseIdx: 0, pendingSig: null });

const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

// ---------------------------------------------------------------- conditions
export const phaseMatches = (when: PhaseWhen | undefined, st: DuelState, me: PlayerId): boolean => {
  const w = (when && typeof when === 'object' ? when : {}) as PhaseWhen;
  const mine = st?.players?.[me];
  const foe = st?.players?.[me === 0 ? 1 : 0];
  if (!mine || !foe) return false;
  // at least one finite condition must be expressed — an empty/garbage `when`
  // never matches (fail-closed against hand-built scripts)
  const hasAny =
    finite(w.clockAfterMs) || finite(w.ownSealsBelow) || finite(w.foeSealsBelow) ||
    finite(w.ownClaimsAtLeast) || finite(w.ownInkAtLeast);
  if (!hasAny) return false;
  if (finite(w.clockAfterMs) && !(Number(st.clockMs) >= w.clockAfterMs)) return false;
  if (finite(w.ownSealsBelow) && !(mine.seals < w.ownSealsBelow)) return false;
  if (finite(w.foeSealsBelow) && !(foe.seals < w.foeSealsBelow)) return false;
  if (finite(w.ownClaimsAtLeast) && !((mine.claimed?.length ?? 0) >= w.ownClaimsAtLeast)) return false;
  if (finite(w.ownInkAtLeast) && !((mine.progress ?? 0) >= w.ownInkAtLeast)) return false;
  return true;
};

// monotonic scan: from the current phase, advance while the NEXT rule matches.
// Never regresses; never evaluates the entry phase's `when`; consumes no rng.
export const advancePhase = (
  script: BossScript,
  sst: BossScriptState,
  st: DuelState,
  me: PlayerId,
): number => {
  const phases = Array.isArray(script?.phases) ? script.phases : [];
  if (!phases.length) return 0;
  let idx = Number.isFinite(sst.phaseIdx) ? Math.floor(sst.phaseIdx) : 0;
  idx = Math.max(0, Math.min(idx, phases.length - 1));
  while (idx + 1 < phases.length && phaseMatches(phases[idx + 1]?.when, st, me)) {
    idx++;
    const sig = phases[idx]?.signature;
    sst.pendingSig = Array.isArray(sig) ? sig.filter((s) => s && typeof s.id === 'string') : null;
  }
  sst.phaseIdx = idx;
  return idx;
};

// ---------------------------------------------------------------- profile patch
const clampFactor = (f: unknown): number => (finite(f) && f > 0 && f <= 4 ? f : 1);
const clampAdd = (a: unknown): number => (finite(a) ? Math.max(-0.5, Math.min(0.5, a)) : 0);

export const patchProfile = (base: ShadeProfile, patch: PhasePatch | undefined): ShadeProfile => {
  if (!patch || typeof patch !== 'object') return base;
  const f = clampFactor(patch.paceFactor);
  return clampProfile({
    ...base,
    placeDelayMs: [base.placeDelayMs[0] * f, base.placeDelayMs[1] * f],
    mistakeRate: base.mistakeRate + clampAdd(patch.mistakeAdd),
    singlesSkill: base.singlesSkill + clampAdd(patch.skillAdd),
    aggression: base.aggression + clampAdd(patch.aggressionAdd),
  });
};

// ---------------------------------------------------------------- signatures
// legality-checked against the LIVE duel: the rite must belong to the boss's
// CURRENT Order (Orsolo may have swapped it away mid-duel), be off cooldown and
// have uses left. A refused signature stays pending — it fires on the first wake
// where it is legal, and never blocks normal play (the wake falls through).
const resolveSignature = (
  sig: PhaseSignature | undefined,
  st: DuelState,
  me: PlayerId,
): ShadeAction | null => {
  if (!sig || typeof sig.id !== 'string') return null;
  const p = st.players[me];
  const rt = p.abilities?.[sig.id];
  if (!rt) return null;                              // foreign Order (post-swap) — skip this wake
  if (rt.cdLeftMs > 0 || rt.usesLeft === 0) return null; // not ready — retry next wake
  if (sig.id === 'quarantine') {
    const foeBoard = st.players[me === 0 ? 1 : 0].board;
    const unit = mostCompleteUnit(foeBoard, st.unitOwner);
    return unit ? { kind: 'ability', id: sig.id, unit } : null;
  }
  if (sig.id === 'augur') {
    const best = mostCompleteUnit(p.board, st.unitOwner);
    if (best) {
      const empties = UNIT_CELLS[best].filter((c) => p.board[c] === 0);
      if (empties.length) return { kind: 'ability', id: sig.id, cell: empties[0] };
    }
    return null;
  }
  return { kind: 'ability', id: sig.id };
};

// ---------------------------------------------------------------- the acting loop
export function bossAct(
  script: BossScript,
  sst: BossScriptState,
  st: DuelState,
  me: PlayerId,
  baseProfile: ShadeProfile,
  rand: () => number,
  nowRealMs: number,
): ShadeAction {
  if (!st || st.phase !== 'live') return { kind: 'wait', untilMs: nowRealMs + 500 };

  const phases = Array.isArray(script?.phases) ? script.phases : [];
  const idx = phases.length ? advancePhase(script, sst, st, me) : -1;

  // one-shot signature: dispatch the head when it is legal, then fall through
  // to normal play with the phase profile (so a pending rite never stalls the boss)
  if (sst.pendingSig && sst.pendingSig.length) {
    const act = resolveSignature(sst.pendingSig[0], st, me);
    if (act) {
      sst.pendingSig.shift();
      return act;
    }
  }

  const base = patchProfile(baseProfile, idx >= 0 ? phases[idx]?.patch : undefined);
  return shadeAct(st, me, base, rand, nowRealMs);
}

// ---------------------------------------------------------------- the nine arcs
// Named, terse, and readable in the balance doc: every Magistrate duels with an
// arc. Entry-phase patches (Marchetti's hoarding, Nox's burial pace) shape the
// whole opening; desperation phases key off ownSealsBelow so the trigger is the
// live duel, not the calendar.
export const BOSS_SCRIPTS: Record<string, BossScript> = {
  // Halbrecht the Headsman: claims territory, then closes his grip.
  'the-grip': { id: 'the-grip', phases: [
    { when: {} },
    { when: { ownClaimsAtLeast: 2 }, patch: { aggressionAdd: 0.15 }, signature: [{ id: 'hush' }] },
    { when: { ownSealsBelow: 4 }, patch: { paceFactor: 0.82, mistakeAdd: -0.02 }, signature: [{ id: 'sever' }] },
  ] },
  // Mother Vael: the drip — poison thickens as her ink spreads.
  'the-drip': { id: 'the-drip', phases: [
    { when: {} },
    { when: { ownInkAtLeast: 6 }, patch: { aggressionAdd: 0.18 }, signature: [{ id: 'smudge' }] },
    { when: { ownInkAtLeast: 14 }, patch: { aggressionAdd: 0.3 }, signature: [{ id: 'miasma' }] },
  ] },
  // Cantor Ilse: the peals — bursts of bell-fast ink that quicken by the clock.
  'the-peal': { id: 'the-peal', phases: [
    { when: {} },
    { when: { clockAfterMs: 150_000 }, patch: { paceFactor: 0.72, mistakeAdd: 0.02 }, signature: [{ id: 'hush' }] },
    { when: { clockAfterMs: 300_000 }, patch: { paceFactor: 0.55, aggressionAdd: 0.12 }, signature: [{ id: 'reckoning' }] },
  ] },
  // Brother Anselm: the lantern — holds his wall, opens only under your pressure.
  'the-lantern': { id: 'the-lantern', phases: [
    { when: {} },
    { when: { foeSealsBelow: 5 }, patch: { aggressionAdd: 0.1 }, signature: [{ id: 'ward' }] },
    { when: { ownSealsBelow: 4 }, patch: { paceFactor: 0.85 }, signature: [{ id: 'mirror' }] },
  ] },
  // Dame Corvane: the map — draws her lines, then seals yours shut.
  'the-map': { id: 'the-map', phases: [
    { when: {} },
    { when: { ownClaimsAtLeast: 3 }, patch: { aggressionAdd: 0.2 }, signature: [{ id: 'quarantine' }] },
    { when: { ownSealsBelow: 4 }, patch: { aggressionAdd: 0.15 }, signature: [{ id: 'mirror' }] },
  ] },
  // Tobias Quill: the forgery — studies your hand, then copies it better.
  'the-forgery': { id: 'the-forgery', phases: [
    { when: {} },
    { when: { ownInkAtLeast: 10 }, patch: { skillAdd: 0.07 }, signature: [{ id: 'fairCopy' }] },
    { when: { ownSealsBelow: 4 }, patch: { skillAdd: 0.05, paceFactor: 0.9 }, signature: [{ id: 'augur' }] },
  ] },
  // Lord Marchetti: the ledger — hoards every rite, then spends it all at once.
  'the-ledger': { id: 'the-ledger', phases: [
    { when: {}, patch: { aggressionAdd: -0.12 } },
    { when: { ownSealsBelow: 5 }, patch: { aggressionAdd: 0.4 }, signature: [{ id: 'sever' }, { id: 'hush' }] },
    { when: { ownSealsBelow: 3 }, patch: { aggressionAdd: 0.15 } },
  ] },
  // Old Nox: the exhumation — buries the opening slow, digs the endgame fast.
  'the-exhumation': { id: 'the-exhumation', phases: [
    { when: {}, patch: { paceFactor: 1.12 } },
    { when: { ownInkAtLeast: 8 }, patch: { paceFactor: 0.85 }, signature: [{ id: 'smudge' }] },
    { when: { ownSealsBelow: 4 }, patch: { paceFactor: 0.6, aggressionAdd: 0.25 }, signature: [{ id: 'miasma' }] },
  ] },
  // Orsolo, the Ninth Seal: probes, punishes, and spends everything when the
  // ninth Seal cracks — his T4 adaptive swap rides on top of this arc.
  'the-ninth': { id: 'the-ninth', phases: [
    { when: {} },
    { when: { ownInkAtLeast: 12 }, patch: { skillAdd: 0.06 } },
    { when: { ownSealsBelow: 5 }, patch: { paceFactor: 0.85, aggressionAdd: 0.28 }, signature: [{ id: 'fairCopy' }] },
  ] },
};
