// Pins the M1 tutorial-note latch (docs/TUTORIAL_OPTIMIZATION_PLAN.md G1/G2).
//
// The old tutorialNote() was a pure function of live state re-read on every render,
// which made the banner glitch on screen:
//   · G1 — the screen granted the free Augur on the note's FIRST frame, and the
//     grant flipped the note straight to 'end': the augur lesson self-destructed
//     before it could be read.
//   · G2 — the mistake clause ranked above pencil/claim in the raw chain, so any
//     mistake after those steps yanked the banner BACKWARDS to the Seal note and
//     forward again — visible flicker.
// The latch makes the lesson forward-only: no note shows twice, the banner never
// steps back, the once-shown Seal note holds until the player's next forward
// action, and the free Augur lands only via the 2.5 s note timer (TutorialCoach)
// or the first Augur-tile tap (LocalDuel.ability).
//
// The lesson-state fields the note reads (progress, mistakes, pencilUsedOnce,
// claimedOnce) are driven with REAL placements; `safeEmptyCell()` picks cells that
// cannot complete a unit, so an accidental claim can never skew the expectations.
// The latch — not the engine — is the unit under test here.
import { describe, expect, it } from 'vitest';
import { LocalDuel, TUTORIAL_NOTE_ORDER } from '@/game/localDuel';
import { CELL_UNITS, UNIT_CELLS, type Digit } from '@shared/config';

function tutorialDuel() {
  return new LocalDuel({
    mode: 'tutorial', seed: 'note-latch-seed', tier: 'Easy',
    orders: ['scholar', 'executioner'], names: ['You', 'Shade of Orsolo'],
  });
}

/** An empty cell that cannot complete ANY of its units on this placement. */
function safeEmptyCell(duel: LocalDuel): number {
  const board = duel.state.players[0].board;
  for (let cell = 0; cell < 81; cell++) {
    if (board[cell] !== 0) continue;
    if (CELL_UNITS(cell).every((u) => UNIT_CELLS[u].filter((c) => board[c] === 0).length >= 3)) {
      return cell;
    }
  }
  throw new Error('no safe empty cell — the picker assumes a givens-heavy Easy board');
}

const solution = (duel: LocalDuel, cell: number): Digit => duel.state.solution![cell] as Digit;
/** A guaranteed-wrong digit for an empty cell. */
const wrongDigit = (duel: LocalDuel, cell: number): Digit => ((solution(duel, cell) % 9) + 1) as Digit;

describe('LocalDuel · the tutorial note latch (M1 G1/G2)', () => {
  it('NOTE-1 (G1) the augur note holds until granted — it no longer self-destructs', () => {
    const duel = tutorialDuel();
    // walk the lesson to the augur step: two correct digits, then pencil + claim
    duel.tutorialNote(); // select
    const a = safeEmptyCell(duel);
    expect(duel.place(a, solution(duel, a)).correct).toBe(true);
    expect(duel.tutorialNote()).toBe('place');
    const b = safeEmptyCell(duel);
    expect(duel.place(b, solution(duel, b)).correct).toBe(true);
    duel.pencilUsedOnce = true;
    duel.claimedOnce = true;
    expect(duel.tutorialNote()).toBe('augur');
    expect(duel.freeAugurGranted).toBe(false);
    // the note stays up across repeated reads (renders) — no self-cancel
    for (let i = 0; i < 50; i++) expect(duel.tutorialNote()).toBe('augur');
    expect(duel.freeAugurGranted).toBe(false);
    // the grant — and only the grant — ends the note
    duel.grantFreeAugur();
    expect(duel.tutorialNote()).toBe('end');
    expect(duel.state.players[0].abilities.augur.cdLeftMs).toBe(0);
    // idempotent: a late second grant must never re-zero a POST-cast cooldown
    duel.state.players[0].abilities.augur.cdLeftMs = 12_345;
    duel.grantFreeAugur();
    expect(duel.state.players[0].abilities.augur.cdLeftMs).toBe(12_345);
    duel.destroy();
  });

  it('NOTE-2 (G1) the first Augur-tile tap during the note grants AND casts the rite', () => {
    const duel = tutorialDuel();
    const a = safeEmptyCell(duel);
    duel.place(a, solution(duel, a));
    const b = safeEmptyCell(duel);
    duel.place(b, solution(duel, b));
    duel.pencilUsedOnce = true;
    duel.claimedOnce = true;
    expect(duel.tutorialNote()).toBe('augur');
    // the player taps the Augur tile with a cell selected — before any 2.5 s timer
    const target = safeEmptyCell(duel);
    const res = duel.ability('augur', { cell: target });
    expect(res.ok).toBe(true);
    expect(duel.freeAugurGranted).toBe(true);
    // the cast really went through: the reveal landed and the POST-cast cooldown ran
    expect(Object.keys(duel.state.players[0].augurRevealed).length).toBeGreaterThan(0);
    expect(duel.state.players[0].abilities.augur.cdLeftMs).toBeGreaterThan(0);
    // the grant moves the lesson on
    expect(duel.tutorialNote()).toBe('end');
    duel.destroy();
  });

  it('NOTE-3 (G1) an Augur-tile tap BEFORE the augur step is a normal cast, not the free grant', () => {
    const duel = tutorialDuel();
    expect(duel.tutorialNote()).toBe('select');
    const target = safeEmptyCell(duel);
    const res = duel.ability('augur', { cell: target });
    expect(res.ok).toBe(true); // the rite itself is simply ready (cooldowns start at 0)…
    expect(duel.freeAugurGranted).toBe(false); // …but the FREE grant did not land…
    expect(duel.state.players[0].abilities.augur.cdLeftMs).toBeGreaterThan(0); // …and a normal post-cast cd runs
    expect(duel.tutorialNote()).toBe('select'); // the lesson did not jump ahead
    duel.destroy();
  });

  it('NOTE-4 (G2) a mistake after the pencil/claim steps never yanks the banner back', () => {
    const duel = tutorialDuel();
    duel.tutorialNote(); // select
    const a = safeEmptyCell(duel);
    duel.place(a, solution(duel, a));
    const b = safeEmptyCell(duel);
    duel.place(b, solution(duel, b));
    duel.pencilUsedOnce = true;
    expect(duel.tutorialNote()).toBe('claim');
    // first mistake while the claim lesson is up: the banner HOLDS — no regression
    const c = safeEmptyCell(duel);
    expect(duel.place(c, wrongDigit(duel, c)).correct).toBe(false);
    expect(duel.state.players[0].mistakes).toBe(1);
    expect(duel.tutorialNote()).toBe('claim');
    // a further read: still 'claim' — the banner never flickers to the Seal note
    expect(duel.tutorialNote()).toBe('claim');
    // the lesson still resumes forward once the claim lands
    duel.claimedOnce = true;
    expect(duel.tutorialNote()).toBe('augur');
    duel.destroy();
  });

  it('NOTE-5 (G2) the Seal note shows once, stays readable, and yields on the next forward action', () => {
    const duel = tutorialDuel();
    expect(duel.tutorialNote()).toBe('select');
    const a = safeEmptyCell(duel);
    duel.place(a, solution(duel, a));
    expect(duel.tutorialNote()).toBe('place');
    // second correct digit then a mistake with NO read in between — the worst case
    // for the old raw derivation, and the Seal note legitimately wins (it sits after
    // 'place' in the order)
    const b = safeEmptyCell(duel);
    duel.place(b, solution(duel, b));
    const c = safeEmptyCell(duel);
    duel.place(c, wrongDigit(duel, c));
    expect(duel.tutorialNote()).toBe('mistake');
    expect(duel.seenNotes.has('mistake')).toBe(true);
    // idle reads: the Seal note HOLDS (readable — not a one-frame flash)
    expect(duel.tutorialNote()).toBe('mistake');
    expect(duel.tutorialNote()).toBe('mistake');
    // further mistakes while held: still the same once-only note, never re-fired
    const d = safeEmptyCell(duel);
    duel.place(d, wrongDigit(duel, d));
    expect(duel.state.players[0].mistakes).toBe(2);
    expect(duel.tutorialNote()).toBe('mistake');
    // the NEXT forward action (a correct placement) yields the lesson
    const e = safeEmptyCell(duel);
    duel.place(e, solution(duel, e));
    expect(duel.tutorialNote()).toBe('pencil');
    // and the Seal note is gone for good
    const f = safeEmptyCell(duel);
    duel.place(f, wrongDigit(duel, f));
    expect(duel.state.players[0].mistakes).toBe(3);
    expect(duel.tutorialNote()).toBe('pencil');
    duel.destroy();
  });

  it('NOTE-6 (G2) the pencil yields a held Seal note too', () => {
    const duel = tutorialDuel();
    duel.tutorialNote(); // select
    const a = safeEmptyCell(duel);
    duel.place(a, solution(duel, a));
    const b = safeEmptyCell(duel);
    duel.place(b, solution(duel, b));
    const c = safeEmptyCell(duel);
    duel.place(c, wrongDigit(duel, c));
    expect(duel.tutorialNote()).toBe('mistake');
    // the player reaches for the quill — exactly what the next lesson step teaches
    duel.toggleNote(c, 5);
    expect(duel.tutorialNote()).toBe('claim'); // pencil used → the lesson resumes past the Seal note
    duel.destroy();
  });

  it('NOTE-7 the latch is monotonic: no play sequence ever steps the banner backwards', () => {
    const duel = tutorialDuel();
    let highWater = -1;
    const read = () => {
      const note = duel.tutorialNote();
      expect(note).not.toBeNull();
      const idx = TUTORIAL_NOTE_ORDER.indexOf(note!);
      expect(idx).toBeGreaterThanOrEqual(highWater);
      highWater = idx;
    };
    read(); // select
    const a = safeEmptyCell(duel);
    duel.place(a, solution(duel, a));
    read(); // place
    const b = safeEmptyCell(duel);
    duel.place(b, wrongDigit(duel, b)); // an early mistake
    read(); // holds 'place' (progress is still 1)
    const c = safeEmptyCell(duel);
    duel.place(c, solution(duel, c));
    read(); // → mistake (first one, legitimately next in the order)
    duel.toggleNote(c, 5);
    read(); // → claim (pencil used)
    const d = safeEmptyCell(duel);
    duel.place(d, wrongDigit(duel, d)); // mistake AFTER pencil — must hold
    read(); // still claim
    duel.claimedOnce = true;
    read(); // → augur
    duel.grantFreeAugur();
    read(); // → end
    expect(TUTORIAL_NOTE_ORDER[highWater]).toBe('end');
    duel.destroy();
  });
});
