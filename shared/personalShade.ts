// ASSIZE T17 — "Your Shade": mine a stored ink-echo (T7 DuelReplay) into a personal
// ShadeProfile. The fiction's strongest hook — dueling your own ink-echo — is one
// data transform away: the recorder already stores seed, tier and every action, and
// generatePuzzle(seed, tier) is deterministic, so the miner can reconstruct the exact
// tablet the human faced and measure their REAL wrong-ink rate, pace and rite rhythm.
//
// Fail-closed like everything else in the T7 lineage:
//   · validateReplay first — hostile shapes never reach the mining math;
//   · too-faint echoes (under MIN_INK placements) yield null → the caller falls back
//     to the calibrated standing profile, visibly;
//   · every output field passes through clampProfile() — no NaN, no Infinity, no
//     zero-delay gods, no 30-second statues, whatever the log contains;
//   · a wrong-ink rate above UNRELIABLE_WRONG_RATE means the log cannot be a real
//     duel on this tablet (Seals would have died long before) → reconstruction is
//     untrustworthy → null;
//   · pure: no clock, no randomness, no mutation of the input — the same echo always
//     mines to the byte-identical profile.
import { generatePuzzle } from './sudoku';
import { validateReplay, type DuelReplay } from './replay';
import { clampProfile, type ShadeProfile } from './shade';
import type { Digit } from './config';

export const MIN_INK = 8;              // placements required before an echo is mineable
export const GAP_FLOOR_MS = 250;       // burst taps are one decision, not ten
export const GAP_CAP_MS = 30_000;      // an idle minute is not thinking time
export const PACE_FLOOR_LO_MS = 1500;  // the fair floor: your Shade is fast, not instant
export const PACE_FLOOR_HI_MS = 2400;
export const UNRELIABLE_WRONG_RATE = 0.5;

export interface EchoTelemetry {
  placements: number;
  correct: number;
  wrong: number;
  fizzled: number;      // recorded placements that hit a filled cell (hostile/dup logs)
  casts: number;
  resigned: boolean;
  medianGapMs: number;
  durationMs: number;
}

const median = (xs: number[]): number => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

// Reconstruct the duel on the echo's own tablet: which recorded placements were
// true ink, which were burns. Deterministic — same seed+tier, same puzzle.
const reconstruct = (
  replay: DuelReplay,
): { telemetry: EchoTelemetry; wrongRate: number; paceMs: number } => {
  const puzzle = generatePuzzle(replay.seed, replay.tier);
  const solution = puzzle.solution;
  const board = new Uint8Array(81);
  board.set(puzzle.givens);

  let correct = 0;
  let wrong = 0;
  let fizzled = 0;
  let casts = 0;
  let resigned = false;
  const placeTs: number[] = [];

  for (const a of replay.actions) {
    if (a.kind === 'ability') { casts++; continue; }
    if (a.kind === 'resign') { resigned = true; continue; }
    if (board[a.cell] !== 0) { fizzled++; continue; } // refuted log — the engine would have refused it
    if (solution[a.cell] === a.digit) {
      correct++;
      board[a.cell] = a.digit as Digit;
    } else {
      wrong++; // burned ink: the board is untouched after a mistake
    }
    placeTs.push(a.t);
  }

  const gaps: number[] = [];
  for (let i = 1; i < placeTs.length; i++) {
    const g = placeTs[i] - placeTs[i - 1];
    if (Number.isFinite(g)) gaps.push(Math.min(GAP_CAP_MS, Math.max(GAP_FLOOR_MS, g)));
  }
  const paceMs = median(gaps);
  const placements = correct + wrong;
  const wrongRate = placements > 0 ? wrong / placements : 0;
  return {
    telemetry: {
      placements, correct, wrong, fizzled, casts, resigned,
      medianGapMs: paceMs,
      durationMs: replay.durationMs,
    },
    wrongRate,
    paceMs,
  };
};

export interface MinedShade {
  profile: ShadeProfile;
  telemetry: EchoTelemetry;
}

// unknown in, null-or-valid out. Never throws.
export function minePersonalShade(raw: unknown): MinedShade | null {
  const clean = validateReplay(raw);
  if (!clean) return null;
  const { telemetry, wrongRate, paceMs } = reconstruct(clean);
  if (telemetry.placements < MIN_INK) return null;           // too faint to read
  if (wrongRate > UNRELIABLE_WRONG_RATE) return null;        // not a plausible duel on this tablet

  const placements = telemetry.placements;
  const castRate = telemetry.casts / placements;
  const won = clean.outcome?.winner === 0;
  const lost = clean.outcome?.winner === 1;

  // pace: median thinking time → delay band around it, floored to the fair floor
  const lo = Math.max(PACE_FLOOR_LO_MS, paceMs * 0.8);
  const hi = Math.max(PACE_FLOOR_HI_MS, paceMs * 1.35);

  // skill: outcome + how clean the ink was — floored in-miner (the envelope floor
  // is 0 so the practice Tablet can stay inert; your Shade is always a real player)
  const singlesSkill = Math.min(0.95, Math.max(0.45, 0.72 + (won ? 0.14 : lost ? -0.06 : 0) - wrongRate * 0.45));

  // rites: cast density maps onto the calibrated aggression curve (0.05→0.46, 0.2→0.79)
  const aggression = Math.min(0.85, Math.max(0.15, 0.35 + castRate * 2.2));

  // techniques: what the tier demands, one rung up for a flawless win
  const tierBase = clean.tier === 'Expert' ? 3 : clean.tier === 'Hard' ? 2 : clean.tier === 'Medium' ? 2 : 1;
  const techniques = tierBase + (won && wrongRate <= 0.05 ? 1 : 0);

  const profile = clampProfile({
    name: `Shade of ${clean.names[0]}`,
    order: clean.orders[0],
    placeDelayMs: [lo, hi],
    mistakeRate: wrongRate,                    // clampProfile floors at 0.02-equivalent envelope
    abilityCadenceMs: [clean.durationMs / Math.max(1, telemetry.casts), clean.durationMs / Math.max(1, telemetry.casts)],
    aggression,
    singlesSkill,
    techniques: Math.max(1, techniques) as 1 | 2 | 3,
    // T17: the echo's real ink rhythm becomes the Shade's post-placement cadence —
    // this is what makes the echo pace ink at YOUR tempo (placeDelayMs is only
    // stuck-thinking time). Floored to the fair floor, capped at a statue-proof 12 s.
    placeCadenceMs: Math.min(12_000, Math.max(PACE_FLOOR_LO_MS, paceMs)),
  });

  return { profile, telemetry };
}
