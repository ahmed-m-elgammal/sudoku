// tutorialDirector.ts — the M2 rebuild's phase machine (docs/TUTORIAL_OPTIMIZATION_PLAN.md
// §5.1–5.2, §6.1). Pure, React-free, RN-free; pinned by __tests__/tutorialDirector.test.ts.
//
// The M1 banner derived its lesson from LIVE duel state every render — that derivation
// is what flickered, regressed and self-cancelled (G1/G2/G12). The director is the
// opposite law: an explicit, MONOTONIC finite state machine advanced by gates and duel
// events. The phase index only ever increases; an event that belongs to an earlier
// phase is ignored, so the lesson can never walk backwards.
//
//   t0 prologue   two story cards (canon lines, first render of story.json's prologue)
//   t1 welcome    spotlight the Tablet; board-only room
//   t2 the rule   ghost demo: a row fills 1→9; the one rule of sudoku
//   t3 select     spotlight one prepared empty cell; gate: tap it
//   t4 place      spotlight the digit; gate: place the true digit there
//   t5 mistakes   invite a deliberate wrong digit; the strike teaches, nothing is lost
//   t6 pencil     gate: quill on → two notes → one erased
//   t7 claims     claim demo, then gate: the Clerk completes the prepared unit
//   t8 augur      spotlight the Eye; gate: the free rite is cast
//   t9 the race   the director arms the v2 Shade script; ambient banner; gate: win
//   t10 graduate  the graduation card → the hall (the save's graduation law owns the Ink)
//
// The clock law is unchanged from v1: the engine clock runs during teaching (the
// strike-clear and cooldowns stay live); the SHADE is what freezes — the v2 script
// waits until the director arms the race at t9.

export const TUTORIAL_PHASES = [
  't0', 't1', 't2', 't3', 't4', 't5', 't6', 't7', 't8', 't9', 't10',
] as const;
export type TutorialPhase = (typeof TUTORIAL_PHASES)[number];

export const PHASE_INDEX: Record<TutorialPhase, number> = TUTORIAL_PHASES.reduce(
  (acc, p, i) => ({ ...acc, [p]: i }),
  {} as Record<TutorialPhase, number>,
);

/** The coach's progress dots: t1–t9 are the nine taught steps. */
export const STEP_TOTAL = 9;
export function phaseStep(phase: TutorialPhase): number {
  const i = PHASE_INDEX[phase];
  return i >= 1 && i <= 9 ? i : 0;
}

export interface TutorialDirectorState {
  phase: TutorialPhase;
  /** notes the coach has SHOWN (a phase's copy latches; nothing re-fires) */
  readonly seenNotes: Set<TutorialPhase>;
  // ---- t6 sub-gates: quill on → two notes placed → one erased
  pencilArmed: boolean;
  peakNotes: number;
  lastNotes: number;
}

export const newTutorialDirector = (skipPrologue: boolean): TutorialDirectorState => ({
  phase: skipPrologue ? 't1' : 't0',
  seenNotes: new Set(),
  pencilArmed: false,
  peakNotes: 0,
  lastNotes: 0,
});

/** The banner CTAs the screen may fire; everything else advances through duel events. */
export type TutorialGate = 'prologueDone' | 'continue' | 'tryIt';

export type TutorialDuelEvent =
  | { kind: 'gate'; gate: TutorialGate }
  | { kind: 'select'; cell: number }
  | { kind: 'place'; correct: boolean; claimed: boolean }
  | { kind: 'pencil'; on: boolean }
  | { kind: 'notes'; count: number }
  | { kind: 'ability'; id: string; ok: boolean }
  | { kind: 'duelEnd'; winner: 0 | 1 | 'draw' };

/**
 * Advance the machine. Mutates `s` in place (the runtime owns it, like the v1 script
 * state) and returns it for chaining. Forward-only: every transition goes through
 * `to()`, which refuses to move backwards.
 */
export function advanceDirector(s: TutorialDirectorState, e: TutorialDuelEvent): TutorialDirectorState {
  s.seenNotes.add(s.phase);
  switch (e.kind) {
    case 'gate':
      if (s.phase === 't0' && e.gate === 'prologueDone') to(s, 't1');
      else if (s.phase === 't1' && e.gate === 'continue') to(s, 't2');
      else if (s.phase === 't2' && e.gate === 'tryIt') to(s, 't3');
      break;
    case 'select':
      // t3's gate is the spotlighted cell itself; the scrim only lets that cell
      // through, so ANY select that reaches the machine here is the taught one.
      if (s.phase === 't3') to(s, 't4');
      break;
    case 'place':
      if (s.phase === 't4' && e.correct) to(s, 't5');
      // t5 invites a deliberate mistake; a correct one still cannot stall the lesson —
      // the gate is "one placement", the copy explains what they just did (§5.2 T5).
      else if (s.phase === 't5') to(s, 't6');
      else if (s.phase === 't7' && e.claimed) to(s, 't8');
      break;
    case 'pencil':
      if (s.phase === 't6') {
        s.pencilArmed = s.pencilArmed || e.on;
        tryT6Exit(s);
      }
      break;
    case 'notes':
      // notes only count once the quill is armed — the pad places notes in pencil mode
      // only, so a stray setNotes before the t6 lesson cannot pre-satisfy its gate
      if (s.phase === 't6' && s.pencilArmed) {
        s.lastNotes = e.count;
        s.peakNotes = Math.max(s.peakNotes, e.count);
        tryT6Exit(s);
      }
      break;
    case 'ability':
      if (s.phase === 't8' && e.ok && e.id === 'augur') to(s, 't9');
      break;
    case 'duelEnd':
      if (s.phase === 't9' && e.winner === 0) to(s, 't10');
      break;
  }
  return s;
}

/** The t6 lesson's sub-step: quill → notes → erase. Drives the banner + spotlight. */
export type T6SubStep = 'quill' | 'notes' | 'erase';
export function t6SubStep(s: TutorialDirectorState): T6SubStep {
  if (!s.pencilArmed) return 'quill';
  if (s.peakNotes < 2) return 'notes';
  if (s.lastNotes >= s.peakNotes) return 'erase';
  return 'notes';
}

/** t5 has run its course once its placement landed (any outcome). */
export const isTeachingPhase = (p: TutorialPhase): boolean => {
  const i = PHASE_INDEX[p];
  return i >= PHASE_INDEX.t1 && i <= PHASE_INDEX.t8;
};

/** The t6 exit gate (§5.2 T6): quill on, two notes placed, one erased → the claim lesson. */
function tryT6Exit(s: TutorialDirectorState): void {
  if (s.pencilArmed && s.peakNotes >= 2 && s.lastNotes < s.peakNotes) to(s, 't7');
}

function to(s: TutorialDirectorState, next: TutorialPhase): void {
  if (PHASE_INDEX[next] > PHASE_INDEX[s.phase]) s.phase = next;
}
