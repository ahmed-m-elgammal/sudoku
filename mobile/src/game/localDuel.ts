// LocalDuel — the solo duel runtime.
//
// PORT of ../src/game/localDuel.ts (Phase A; the runtimes agent owns the hardening
// pass and ServerDuel). It runs the shared engine on the device for the M0 tutorial,
// M1 campaign, M3 daily, M5 practice, the Endless ladder, the Weekly Assize and every
// offline Shade duel. The server runs the same engine for M2/M4 (see serverDuel.ts).
//
// What changed in the port, and nothing else:
//   1. `navigator.vibrate(...)`  x3  -> the `haptics` seam (semantics, not patterns)
//   2. `synth.*`                  -> the `audio` seam (identical 18-method surface)
//   3. `'use client'`                 -> dropped (a Next.js directive, meaningless here)
//   4. the class now satisfies the `DuelRuntime` interface from ./duelRuntime
//
// What did NOT change, on purpose:
//   - the frame loop (requestAnimationFrame, dt clamped to 1000 ms, tick then drain)
//   - the ~66 ms notify throttle: RN's reconciler is slower than the DOM's, so this
//     throttle is load-bearing here, not incidental
//   - the Shade cadence law (900 ms default; a mined profile carries its own)
//   - `performance.now()` for the swap banner and Shade timing (the wall clock, NOT
//     the engine clock, so the banner never freezes when the duel pauses)
//   - every engine call. `shared/` is untouched.
import {
  createDuel, place, useAbility as engineUseAbility, tick, resign, cellFlags, swapOrder,
  type DuelState, type RuleMods,
} from '@shared/engine';
import { shadeAct, profileForStanding, type ShadeProfile } from '@shared/shade';
import { tutorialAct, newTutorialScript, type TutorialScriptState } from '@shared/tutorial';
import {
  tutorialV2Act, newTutorialV2Script, armTutorialRace, tutorialV2Telegraph,
  type TutorialV2State,
} from '@shared/tutorialV2';
import {
  advanceDirector, newTutorialDirector, t6SubStep,
  type TutorialDirectorState, type TutorialDuelEvent,
} from './tutorialDirector';
import type {
  LocalDuelOpts, DuelRuntime, DuelRuntimeOpts, TutorialSpotTarget, TutorialTelegraph,
} from './duelRuntime';
import { bossAct, newBossScriptState, type BossScript, type BossScriptState } from '@shared/phaseScript';
import { adaptiveSwapTarget } from '@shared/orders';
import {
  validateReplay, ReplayDriver, newReplayRecorder, recordAction, buildReplay,
  type DuelReplay, type ReplayRecorder, type ReplayAction,
} from '@shared/replay';
import { Rng } from '@shared/rng';
import { CONFIG, CELL_UNITS, UNIT_CELLS, type AbilityId, type Digit, type OrderId, type PlayerId, type Tier } from '@shared/config';
import { generatePuzzle } from '@shared/sudoku';
import { audio } from '@/platform/audio';
import { haptics } from '@/platform/haptics';

export type { LocalDuelOpts };

// ------------------------------------------------------------------ tutorial
// The teaching sequence in the only order the notes may ever appear. The latch in
// tutorialNote() guarantees the banner walks this list FORWARD only.
export const TUTORIAL_NOTE_ORDER = [
  'select', 'place', 'mistake', 'pencil', 'claim', 'augur', 'end',
] as const;
export type TutorialNoteId = (typeof TUTORIAL_NOTE_ORDER)[number];

/** The Shade's re-check cadence while it holds at the tutorial floor (G9/G10). */
const TUTORIAL_FLOOR_HOLD_MS = 700;

export class LocalDuel implements DuelRuntime {
  state: DuelState;
  /**
   * The construction options, widened to accept the screen-assigned `onEnd`. Kept as
   * a mutable public field because the screen assigns `duel.opts.onEnd` after the fact.
   */
  opts: LocalDuelOpts & DuelRuntimeOpts;
  notes = new Map<number, Set<number>>();
  selected: number | null = null;
  pencil = false;
  lastWrong: number | null = null;
  lastWrongCell = -1;
  lastWrongDigit = 0;
  lastWrongClearAt = 0;
  wrongVariant = 0;

  private raf = 0;
  private lastFrame = 0;
  private shadeTimer: ReturnType<typeof setTimeout> | null = null;
  private rng: Rng;
  private scriptRng: Rng;
  private script: TutorialScriptState;
  private listeners = new Set<() => void>();
  private lastNotifyAt = 0;
  version = 0;
  /**
   * The value `getSnapshot()` serves React. `version` advances on EVERY mutation AND
   * every rAF frame (~60/s), while listeners are notified at ~15fps. useSyncExternalStore
   * re-checks the snapshot in a passive effect after EVERY commit and force-re-renders
   * when it moved — so a raw-version snapshot chains render → stale → force-render →
   * stale → … as fast as React can loop. On a desktop that spiral usually settles inside
   * one 16ms frame; on a phone it pegs the JS thread and touch handlers starve, which
   * reads as “the whole duel ignores taps”. The snapshot therefore advances ONLY when
   * listeners fire: stable between notifications, fresh on each one. Data is never stale
   * — every render reads the live `duel.state` objects directly; `version` remains the
   * fine-grained counter for the fx/memo layers (Board's useMemo deps).
   */
  private notifiedVersion = 0;
  ended = false;
  paused = false;

  // S08 parity with ServerDuel: solo duels never disconnect, but the union type
  // must carry the same surface so the screens render both identically.
  disconnect = null;
  selfOffline = false;

  tutorialStep = 0;
  freeAugurGranted = false;
  pencilUsedOnce = false;
  claimedOnce = false;

  // M1 hotfix (docs/TUTORIAL_OPTIMIZATION_PLAN.md G1/G2) — the note latch.
  // `tutorialNote()` is read on every render, and the raw state underneath it
  // flickers: any mistake re-fires 'mistake' long after the lesson moved on (G2),
  // and the augur note used to be cancelled by its own grant the frame it appeared
  // (G1). `seenNotes` records every note the player has been shown (each note is a
  // one-time lesson) and `noteLatch` holds the note currently on screen, so the
  // banner only ever steps FORWARD through TUTORIAL_NOTE_ORDER.
  readonly seenNotes = new Set<TutorialNoteId>();
  private noteLatch: TutorialNoteId | null = null;
  // G2 — while the Seal note is up it HOLDS until the player's next forward action
  // (a correct placement or the pencil), so the once-only mistake lesson is actually
  // readable instead of flashing for the single frame before raw moves past it.
  private mistakeNoteHold = false;

  // M2 rebuild (docs/TUTORIAL_OPTIMIZATION_PLAN.md §5–§6, amended §11) — the v2
  // teaching machine. `director` owns WHICH lesson is live (t0–t10, forward-only);
  // `scriptV2` owns the Shade (frozen until the director arms the race at t9).
  // `tutorialScript: 'v1'` (the default) keeps the entire v1 path below untouched.
  private readonly v2: boolean;
  private director: TutorialDirectorState | null = null;
  private scriptV2: TutorialV2State | null = null;
  // the teaching targets, latched the first time their phase asks (stable while the
  // phase is live — the scrim makes everything else untappable)
  private teachCell: number | null = null;
  private teachCell2: number | null = null;
  private claimCell: number | null = null;

  // T7 - replay Shades: the foe is driven by a stored human log instead of shadeAct.
  // A replay that fails validation degrades VISIBLY (replayDegraded) to a normal Shade
  // rather than crashing the duel screen.
  private echo: ReplayDriver | null = null;
  replayDegraded = false;
  private recorder: ReplayRecorder = newReplayRecorder();

  // T4 state - the swap happens once, mid-duel, when the adaptive foe drops to
  // CONFIG.seals.adaptiveSwapAtSeals; the banner window is real-time (keeps running
  // while the engine clock is paused) so the callout never freezes mid-animation.
  private adaptiveDone = false;
  private swapFlash: { from: OrderId; to: OrderId } | null = null;
  private swapFlashAt = 0;

  // T18 - the boss's PhaseScript state (phase ladder + pending signature), owned
  // here like the tutorial's script state; present only when opts.foeScript is set.
  private bossState: BossScriptState | null = null;

  constructor(opts: LocalDuelOpts) {
    this.opts = opts;
    const puz = generatePuzzle(opts.seed, opts.tier);
    this.rng = new Rng(`${opts.seed}-shade`);
    this.scriptRng = new Rng(`${opts.seed}-script`);
    this.v2 = opts.mode === 'tutorial' && opts.tutorialScript === 'v2';
    if (this.v2) {
      this.director = newTutorialDirector(!!opts.tutorialSkipPrologue);
      this.scriptV2 = newTutorialV2Script();
    }
    this.script = newTutorialScript();
    this.state = createDuel({
      seed: opts.seed,
      givens: Uint8Array.from(puz.givens),
      solution: Uint8Array.from(puz.solution),
      names: opts.names,
      orders: opts.orders,
      magistrateSeals: opts.seals,
      mods: opts.mods,
    });
    this.state.events = [];
    if (opts.mode === 'replay' && opts.replay) {
      const validated = validateReplay(opts.replay);
      if (validated) this.echo = new ReplayDriver(validated, 1);
      else this.replayDegraded = true;
    }
    if (opts.foeScript) this.bossState = newBossScriptState();
  }

  select(cell: number | null) {
    this.selected = cell;
    audio.uiTap();
    if (this.v2 && cell !== null) this.directorEvent({ kind: 'select', cell });
    this.bump();
  }

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  };

  // version bumps every call; listener notification is throttled to ~15fps - cooldown
  // rings and the clock stay smooth without re-rendering the whole duel tree at 60fps.
  private bump(immediate = false) {
    this.version++;
    const now = performance.now();
    if (immediate || now - this.lastNotifyAt >= 66) {
      this.lastNotifyAt = now;
      this.notifiedVersion = this.version;
      this.listeners.forEach((l) => l());
    }
  }

  getSnapshot = () => this.notifiedVersion;
  bumpPublic() { this.bump(); }

  start() {
    this.lastFrame = performance.now();
    const loop = (t: number) => {
      const dt = Math.min(1000, t - this.lastFrame);
      this.lastFrame = t;
      if (!this.ended && !this.paused) {
        tick(this.state, dt);
        this.checkAdaptive();
        audio.tickMusic(this.tension());
        this.drainEvents();
        if (this.state.phase === 'ended') this.finish();
      }
      this.bump();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
    this.scheduleShade(600);
  }

  destroy() {
    if (this.raf) cancelAnimationFrame(this.raf);
    if (this.shadeTimer) clearTimeout(this.shadeTimer);
    this.listeners.clear();
  }

  private tension(): number {
    const me = this.state.players[0];
    const foe = this.state.players[1];
    const low = Math.min(me.seals, foe.seals);
    return low <= 3 ? (4 - low) / 3 : 0;
  }

  // T4 - Orsolo's adaptive swap (FOLIOS[8].duels[2].adaptive). Checked on the frame
  // loop so the trigger catches Seals lost to any source (claims, Reckoning bonus,
  // Last Rites) the instant they land. One swap per duel; never after the duel ends.
  private checkAdaptive() {
    if (!this.opts.adaptive || this.adaptiveDone) return;
    if (this.state.phase !== 'live') return;
    if (this.state.players[1].seals > CONFIG.seals.adaptiveSwapAtSeals) return;
    this.adaptiveDone = true;
    const me = this.state.players[0];
    const foe = this.state.players[1];
    const from = foe.order;
    const to = adaptiveSwapTarget(me.order, foe.order);
    if (swapOrder(this.state, 1, to)) {
      this.swapFlash = { from, to };
      this.swapFlashAt = performance.now();
      audio.orderSwap();
      if (this.opts.settingsHaptics?.() ?? true) haptics.orderSwap();
      this.bump(true);
    }
  }

  // The screen reads this each render; truthy for ~4.2s after the swap (real time).
  swapBanner(): { from: OrderId; to: OrderId } | null {
    if (!this.swapFlash) return null;
    return performance.now() - this.swapFlashAt < 4200 ? this.swapFlash : null;
  }

  private drainEvents() {
    void this.state.events; // events are read by the UI directly; sfx hooked in useDuelSession
  }

  private finish() {
    if (this.ended) return;
    this.ended = true;
    this.recorder.sealed = true; // no posthumous ink in the echo
    const w = this.state.winner;
    if (this.v2) this.directorEvent({ kind: 'duelEnd', winner: w ?? 'draw' });
    if (w === 'draw') audio.draw();
    else if (w === 0) { audio.victory(); haptics.impact(); }
    else { audio.defeat(); haptics.impact(); }
    this.opts.onEnd?.({ winner: w ?? 'draw', reason: this.state.winReason ?? '' });
  }

  /** The recorded human log of THIS duel (validated; null if illegal). */
  toReplay(outcome: { winner: 0 | 1 | 'draw'; reason: string }): DuelReplay | null {
    return buildReplay(this.recorder, {
      seed: this.opts.seed,
      tier: this.opts.tier,
      orders: this.opts.orders,
      names: this.opts.names,
      seals: this.opts.seals,
      durationMs: this.state.durationMs,
      outcome,
    });
  }

  // ------------------------------------------------------------------ actions
  place(cell: number, digit: Digit) {
    if (this.ended) return { ok: false, reason: 'ended' as const };
    // G9 — the tutorial cannot cost Seals on a mistake. The sanitized mods surface
    // clamps wrongSealCost to >= 1 (T21 sanitizer, shared/ and not ours to touch), so
    // forgiveness is re-armed instead: the scholar's Marginalia passive is reset
    // before every tutorial placement, which routes EVERY tutorial mistake through
    // the engine's own forgiven path — no Seal loss, no seal death — while the
    // strike, the flinch and the haptic still teach. The tutorial spec is
    // scholar-owned (useDuelSession.specFromUi), which this relies on.
    if (this.opts.mode === 'tutorial') this.state.players[0].marginaliaUsed = false;
    // M2 — the units this cell sits in, BEFORE the ink (a new owner = the placement
    // claimed). Only read when the v2 relay needs it.
    const ownersBefore = this.v2 ? CELL_UNITS(cell).map((u) => this.state.unitOwner[u]) : null;
    const res = place(this.state, 0, cell, digit);
    // t is rounded: the engine clock is continuous (rAF deltas), the replay contract is integer ms
    if (res.ok) recordAction(this.recorder, { t: Math.round(this.state.clockMs), kind: 'place', cell, digit }); // echo: mistakes replay too
    if (!res.ok) { if (res.reason === 'hushed' || res.reason === 'chained') audio.error(); return res; }
    if (res.correct) {
      audio.place();
      haptics.tick();
      this.autoCleanNotes(cell, digit);
      this.lastWrong = null;
      this.mistakeNoteHold = false; // G2 — a correct placement yields the held Seal note
      // tutorial pacing: mark the first claim
      const st = this.state;
      for (const u of ['r', 'c', 'b'] as const) {
        const id = `${u}${u === 'r' ? Math.floor(cell / 9) : u === 'c' ? cell % 9 : Math.floor(cell / 27) * 3 + Math.floor((cell % 9) / 3)}`;
        if (st.unitOwner[id] === 0) { this.claimedOnce = true; break; }
      }
    } else {
      audio.wrong();
      this.wrongVariant++;
      this.lastWrong = cell;
      this.lastWrongCell = cell;
      this.lastWrongDigit = digit;
      this.lastWrongClearAt = this.state.clockMs + 1000; // digit clears after 1.0s
      if (this.opts.settingsHaptics?.() ?? true) haptics.mistake();
    }
    this.opts.onEvent?.({ seq: -1, atMs: this.state.clockMs, kind: res.correct ? 'placed' : 'mistake', player: 0, cell, digit });
    // tutorial pacing hooks
    if (this.opts.mode === 'tutorial') this.advanceTutorial(!!res.correct);
    // M2 — the director learns every settled placement (correct, wrong, claimed)
    if (this.v2 && res.ok) {
      const claimed = !!res.correct && ownersBefore!.some((o, i) => o === undefined && this.state.unitOwner[CELL_UNITS(cell)[i]] === 0);
      this.directorEvent({ kind: 'place', correct: !!res.correct, claimed });
    }
    return res;
  }

  private autoCleanNotes(cell: number, digit: number) {
    if (!this.notes.size) return;
    const boxOf = (c: number) => Math.floor(c / 27) * 3 + Math.floor((c % 9) / 3);
    const unitsOf = (c: number) => [Math.floor(c / 9), 9 + (c % 9), 18 + boxOf(c)];
    const placedUnits = unitsOf(cell);
    for (const [c, set] of [...this.notes.entries()]) {
      if (c === cell) { this.notes.delete(c); continue; }
      if (unitsOf(c).some((u) => placedUnits.includes(u))) {
        set.delete(digit);
        if (!set.size) this.notes.delete(c);
      }
    }
  }

  setNotes(cell: number, digits: number[]) {
    if (digits.length === 0) this.notes.delete(cell);
    else this.notes.set(cell, new Set(digits));
    if (this.v2) this.directorEvent({ kind: 'notes', count: this.noteDigitCount() });
    this.bump();
  }

  toggleNote(cell: number, d: number) {
    this.pencilUsedOnce = true;
    this.mistakeNoteHold = false; // G2 — the pencil is the way past the held Seal note
    const set = this.notes.get(cell) ?? new Set<number>();
    if (set.has(d)) set.delete(d); else set.add(d);
    if (!set.size) this.notes.delete(cell); else this.notes.set(cell, set);
    audio.pencil();
    if (this.v2) this.directorEvent({ kind: 'notes', count: this.noteDigitCount() });
    this.bump();
  }

  /** The t6 gate counts pencil MARKS, not cells — the lesson teaches two digits into
   *  one cell, so two marks in the same cell must satisfy it (§5.2 T6). */
  private noteDigitCount(): number {
    let n = 0;
    for (const s of this.notes.values()) n += s.size;
    return n;
  }

  ability(id: AbilityId, arg: { cell?: number; unit?: string } = {}) {
    if (this.ended) return { ok: false, reason: 'ended' as const };
    // G1 — the free Augur is also granted by the FIRST Augur-tile tap while its
    // note is up: "freely given" must not depend on waiting out the note timer.
    // Taps before the augur lesson step keep the rite's normal cooldown.
    if (this.opts.mode === 'tutorial' && id === 'augur' && !this.freeAugurGranted
      && (this.v2 ? this.director?.phase === 't8' : this.tutorialNote() === 'augur')) {
      this.grantFreeAugur();
    }
    const a = arg.cell !== undefined ? arg : this.selected !== null ? { ...arg, cell: this.selected } : arg;
    const res = engineUseAbility(this.state, 0, id, a);
    if (res.ok) {
      recordAction(this.recorder, {
        t: Math.round(this.state.clockMs), kind: 'ability', id,
        ...(a.cell !== undefined ? { cell: a.cell } : {}),
        ...(a.unit !== undefined ? { unit: a.unit } : {}),
      });
      audio.cast(Object.keys(this.state.players[0].abilities).indexOf(id));
      this.opts.onEvent?.({ seq: -1, atMs: this.state.clockMs, kind: 'ability', player: 0, ability: id });
    } else audio.error();
    if (this.v2) this.directorEvent({ kind: 'ability', id, ok: !!res.ok });
    this.bump();
    return res;
  }

  concede() {
    if (!this.ended) recordAction(this.recorder, { t: Math.round(this.state.clockMs), kind: 'resign' });
    resign(this.state, 0);
    this.finish();
  }

  setPaused(paused: boolean) {
    this.paused = paused;
    this.bump();
  }

  togglePencil() {
    this.pencil = !this.pencil;
    if (this.v2) this.directorEvent({ kind: 'pencil', on: this.pencil });
    this.bumpPublic();
  }

  setOnEnd(fn: (r: { winner: PlayerId | 'draw'; reason: string }) => void) {
    this.opts.onEnd = fn;
  }

  flags() { return cellFlags(this.state, 0); }

  // ------------------------------------------------------------------ shade
  private scheduleShade(delay: number) {
    if (this.shadeTimer) clearTimeout(this.shadeTimer);
    this.shadeTimer = setTimeout(() => this.shadeWake(), delay);
  }

  private shadeWake() {
    if (this.ended) return;
    // G9/G10 — the tutorial floor: with the Clerk at 1 Seal the Shade holds its hand
    // ENTIRELY, so no claim can ever land the killing wound and the lesson can never
    // be lost. Unreachable while every tutorial mistake is forgiven (see place()) —
    // this is the belt under that brace.
    if (this.opts.mode === 'tutorial' && this.state.players[0].seals <= 1) {
      this.scheduleShade(TUTORIAL_FLOOR_HOLD_MS);
      this.bump();
      return;
    }
    // T7: a replay duel's foe is the ink-echo - recorded human actions applied when
    // the engine clock reaches them. An exhausted or degraded echo falls back to the
    // calibrated Shade bot.
    if (this.echo) {
      for (const a of this.echo.due(this.state)) {
        this.applyEchoAction(a);
        if (this.state.phase === 'ended') break;
      }
      if (this.state.phase === 'ended') { this.finish(); return; }
      const nextT = this.echo.nextT();
      this.scheduleShade(nextT === null ? 1500 : Math.max(400, Math.min(nextT - this.state.clockMs, 10_000)));
      this.bump();
      return;
    }
    const prof = this.opts.foeProfile ?? profileForStanding(1000);
    // T3: the tutorial Shade is fully scripted (deterministic hand-loses-the-race);
    // T18: a PhaseScript boss advances its arc, casts signature rites, and otherwise
    // acts through the same calibrated Shade (phase-patched); every other mode keeps
    // the plain calibrated Shade bot.
    const prevPhase = this.bossState ? this.bossState.phaseIdx : -1;
    const act = this.opts.mode === 'tutorial'
      ? this.v2 && this.scriptV2
        ? tutorialV2Act(this.scriptV2, this.state, 1, this.scriptRng, performance.now())
        : tutorialAct(this.script, this.state, 1, this.state.players[0].progress, this.scriptRng, performance.now())
      : this.bossState && this.opts.foeScript
        ? bossAct(this.opts.foeScript as BossScript, this.bossState, this.state, 1, prof, () => this.rng.next(), performance.now())
        : shadeAct(this.state, 1, prof, () => this.rng.next(), performance.now());
    // J2 - the arc ADVANCED this wake: the court learns it before the rite lands.
    // Fires once per advancing wake even if the monotonic scan crossed several rungs.
    if (this.bossState && this.opts.onPhase && this.bossState.phaseIdx > prevPhase) {
      this.opts.onPhase(this.bossState.phaseIdx);
    }
    if (act.kind === 'place') {
      const res = place(this.state, 1, act.cell, act.digit);
      if (res.ok && res.correct) audio.pencil();
      if (this.state.phase === 'ended') { this.finish(); return; }
    } else if (act.kind === 'ability') {
      engineUseAbility(this.state, 1, act.id, { cell: act.cell, unit: act.unit });
    } else if (act.kind === 'swap') {
      // T20 - a cross-Order boss phase: the arc sets one Order aside mid-duel.
      // The engine's swapOrder is the same atomic primitive T4 proved; the brass
      // callout, sting and haptics are the T4 presentation, reused verbatim.
      const from = this.state.players[1].order;
      if (swapOrder(this.state, 1, act.to)) {
        this.swapFlash = { from, to: act.to };
        this.swapFlashAt = performance.now();
        audio.orderSwap();
        if (this.opts.settingsHaptics?.() ?? true) haptics.orderSwap();
        this.bump(true);
      }
    }
    // post-action cadence: shipped bots reschedule at a fixed 900 ms; a T17 mined
    // profile carries its own ink cadence so your Shade paces ink at YOUR tempo
    const cadence = prof.placeCadenceMs;
    this.scheduleShade(act.kind === 'wait' ? Math.max(400, act.untilMs - performance.now()) : Math.max(400, cadence ?? 900));
    this.bump();
  }

  // T7 - one recorded action through the shared engine on the echo's own tablet.
  // Refused actions (the live duel's statuses differ from the original's) simply
  // fizzle: an ink-echo stutters where the ink was disturbed.
  private applyEchoAction(a: ReplayAction) {
    if (this.state.phase !== 'live') return;
    if (a.kind === 'place') {
      place(this.state, 1, a.cell, a.digit as Digit);
    } else if (a.kind === 'ability') {
      engineUseAbility(this.state, 1, a.id, { cell: a.cell, unit: a.unit });
    } else if (a.kind === 'resign') {
      resign(this.state, 1);
    }
  }

  // ------------------------------------------------------------------ tutorial
  private advanceTutorial(correct: boolean) {
    if (correct) this.tutorialStep++;
    this.bump();
  }

  tutorialNote(): TutorialNoteId | null {
    if (this.opts.mode !== 'tutorial' || this.v2) return null;
    // G2 — the held Seal note: shown once, readable until the player moves forward.
    if (this.noteLatch === 'mistake' && this.mistakeNoteHold) return 'mistake';
    const raw = this.rawTutorialNote();
    // G2 — forward-only: a raw state that sits BEFORE the note on screen (a fresh
    // mistake after the pencil/claim steps) never pulls the banner backwards; the
    // current note holds until the lesson genuinely moves past it.
    const note: TutorialNoteId =
      this.noteLatch && TUTORIAL_NOTE_ORDER.indexOf(raw) < TUTORIAL_NOTE_ORDER.indexOf(this.noteLatch)
        ? this.noteLatch
        : raw;
    // A raw note the latch SUPPRESSES is consumed: it never fires again, because the
    // lesson decided not to teach it (a first mistake after the pencil/claim steps is
    // the only note that can ever sit below the banner). Without this, the unseen
    // mistake clause would fire on every later read and pin the lesson where it is.
    if (note !== raw) this.seenNotes.add(raw);
    // Latch on display: the mistake note is a one-time lesson (G2), and seenNotes
    // records the lesson the player has actually been shown.
    this.seenNotes.add(note);
    this.noteLatch = note;
    if (note === 'mistake') this.mistakeNoteHold = true;
    return note;
  }

  /** The raw, unlatched lesson state — the web build's derivation, minus the
   *  once-only mistake clause: a shown Seal note never fires again (G2). */
  private rawTutorialNote(): TutorialNoteId {
    const p = this.state.players[0];
    if (p.progress === 0) return 'select';
    if (p.progress === 1) return 'place';
    if (p.mistakes > 0 && !this.freeAugurGranted && !this.seenNotes.has('mistake')) return 'mistake';
    if (!this.pencilUsedOnce) return 'pencil';
    if (!this.claimedOnce) return 'claim';
    if (!this.freeAugurGranted) return 'augur';
    return 'end';
  }

  grantFreeAugur() {
    // G1 — idempotent: the screen's 2.5 s note timer and the tile-tap path both
    // call this, and a late timer fire must never re-zero a POST-cast cooldown.
    if (this.freeAugurGranted) return;
    const rt = this.state.players[0].abilities.augur;
    rt.cdLeftMs = 0;
    this.freeAugurGranted = true;
    this.bump();
  }

  // ------------------------------------------------------------------ M2 director
  // The v2 tutorial surface (DuelRuntime's optional members). Everything here is
  // inert unless opts.tutorialScript === 'v2' — ServerDuel never sees this code.

  /** The live lesson phase, 't0'…'t10'; null outside the v2 tutorial. */
  tutorialPhase(): string | null {
    return this.v2 ? this.director!.phase : null;
  }

  /** What the spotlight coach aims at during the current phase. */
  tutorialTarget(): TutorialSpotTarget {
    if (!this.v2 || !this.director) return null;
    switch (this.director.phase) {
      case 't1':
        return { kind: 'board' };
      case 't3':
        return { kind: 'cell', cell: this.latchTeachCell() };
      case 't4':
        return { kind: 'digit', digit: this.state.solution![this.latchTeachCell()] as Digit };
      case 't5':
        return { kind: 'cell', cell: this.latchTeachCell2() };
      case 't6': {
        const sub = t6SubStep(this.director);
        if (sub === 'quill') return { kind: 'toolbar', index: 0 };
        if (sub === 'notes') return { kind: 'cell', cell: this.latchTeachCell() };
        return { kind: 'erase' };
      }
      case 't7':
        return { kind: 'cell', cell: this.latchClaimCell() };
      case 't8':
        return { kind: 'ability', id: 'augur' };
      default:
        return null; // t0 (cards cover the room), t2 (ghost demo), t9/t10 (open room)
    }
  }

  /** The pending Shade claim, for the coach's telegraph line; null when none. */
  tutorialTelegraph(): TutorialTelegraph | null {
    if (!this.v2 || !this.scriptV2) return null;
    const u = tutorialV2Telegraph(this.scriptV2);
    if (!u) return null;
    const n = parseInt(u.slice(1), 10) + 1;
    if (!Number.isFinite(n)) return null;
    if (u.startsWith('r')) return { unit: 'row', n };
    if (u.startsWith('c')) return { unit: 'col', n };
    return { unit: 'box', n };
  }

  /** A banner CTA: the prologue's last tap, t1's Continue, t2's Try it. */
  tutorialAdvance(gate: 'prologueDone' | 'continue' | 'tryIt'): void {
    this.directorEvent({ kind: 'gate', gate });
  }

  private directorEvent(e: TutorialDuelEvent) {
    if (!this.director) return;
    advanceDirector(this.director, e);
    // t9 — the race wakes exactly here, once (§5.4: the director owns the pacing)
    if (this.director.phase === 't9' && this.scriptV2 && !this.scriptV2.raceArmed) {
      armTutorialRace(this.scriptV2);
    }
    this.bump();
  }

  private latchTeachCell(): number {
    if (this.teachCell === null) {
      const board = this.state.players[0].board;
      for (let c = 0; c < 81; c++) if (board[c] === 0) { this.teachCell = c; break; }
      if (this.teachCell === null) this.teachCell = 0; // a full tablet cannot be taught; fail visible
    }
    return this.teachCell;
  }

  private latchTeachCell2(): number {
    if (this.teachCell2 === null) {
      const board = this.state.players[0].board;
      for (let c = this.latchTeachCell() + 1; c < 81; c++) if (board[c] === 0) { this.teachCell2 = c; break; }
      if (this.teachCell2 === null) this.teachCell2 = this.latchTeachCell();
    }
    return this.teachCell2;
  }

  /** A cell whose true digit completes a not-yet-owned unit — the claim lesson's mark. */
  private latchClaimCell(): number {
    if (this.claimCell === null) {
      const board = this.state.players[0].board;
      for (let c = 0; c < 81; c++) {
        if (board[c] !== 0) continue;
        const digit = this.state.solution ? this.state.solution[c] : 0;
        if (!digit) continue;
        const completes = CELL_UNITS(c).some((u) =>
          this.state.unitOwner[u] === undefined
          && UNIT_CELLS[u].every((cc) => (cc === c ? true : this.state.players[0].board[cc] !== 0)));
        if (completes) { this.claimCell = c; break; }
      }
      // no one-away unit (hostile save): any empty cell — the gate is the claim event,
      // not this mark, and the v2 Shade can never steal it before t9
      if (this.claimCell === null) this.claimCell = this.latchTeachCell();
    }
    return this.claimCell;
  }

  /** The seat-0 perspective every screen renders (ServerDuel mirrors it). */
  get me(): PlayerStateView { return this.state.players[0] as PlayerStateView; }
  get foe(): PlayerStateView { return this.state.players[1] as PlayerStateView; }
}

type PlayerStateView = DuelState['players'][number];

/** Re-exported for screens that build a spec without importing @shared directly. */
export { CONFIG };
export type { RuleMods, ShadeProfile, Tier, PlayerId, AbilityId, Digit, OrderId };
