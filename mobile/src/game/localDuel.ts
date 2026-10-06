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
import { bossAct, newBossScriptState, type BossScript, type BossScriptState } from '@shared/phaseScript';
import { adaptiveSwapTarget } from '@shared/orders';
import {
  validateReplay, ReplayDriver, newReplayRecorder, recordAction, buildReplay,
  type DuelReplay, type ReplayRecorder, type ReplayAction,
} from '@shared/replay';
import { Rng } from '@shared/rng';
import { CONFIG, type AbilityId, type Digit, type OrderId, type PlayerId, type Tier } from '@shared/config';
import { generatePuzzle } from '@shared/sudoku';
import { audio } from '@/platform/audio';
import { haptics } from '@/platform/haptics';
import type { LocalDuelOpts, DuelRuntime, DuelRuntimeOpts } from './duelRuntime';

export type { LocalDuelOpts };

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
      this.listeners.forEach((l) => l());
    }
  }

  getSnapshot = () => this.version;
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
    cancelAnimationFrame(this.raf);
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
    const res = place(this.state, 0, cell, digit);
    // t is rounded: the engine clock is continuous (rAF deltas), the replay contract is integer ms
    if (res.ok) recordAction(this.recorder, { t: Math.round(this.state.clockMs), kind: 'place', cell, digit }); // echo: mistakes replay too
    if (!res.ok) { if (res.reason === 'hushed' || res.reason === 'chained') audio.error(); return res; }
    if (res.correct) {
      audio.place();
      haptics.tick();
      this.autoCleanNotes(cell, digit);
      this.lastWrong = null;
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
    this.bump();
  }

  toggleNote(cell: number, d: number) {
    this.pencilUsedOnce = true;
    const set = this.notes.get(cell) ?? new Set<number>();
    if (set.has(d)) set.delete(d); else set.add(d);
    if (!set.size) this.notes.delete(cell); else this.notes.set(cell, set);
    audio.pencil();
    this.bump();
  }

  ability(id: AbilityId, arg: { cell?: number; unit?: string } = {}) {
    if (this.ended) return { ok: false, reason: 'ended' as const };
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
      ? tutorialAct(this.script, this.state, 1, this.state.players[0].progress, this.scriptRng, performance.now())
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
      if (swapOrder(this.state, 1, act.to)) {
        this.swapFlash = { from: this.state.players[1].order, to: act.to };
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

  tutorialNote(): string | null {
    if (this.opts.mode !== 'tutorial') return null;
    const p = this.state.players[0];
    if (p.progress === 0) return 'select';
    if (p.progress === 1) return 'place';
    if (p.mistakes > 0 && !this.freeAugurGranted) return 'mistake';
    if (!this.pencilUsedOnce) return 'pencil';
    if (!this.claimedOnce) return 'claim';
    if (!this.freeAugurGranted) return 'augur';
    return 'end';
  }

  grantFreeAugur() {
    const rt = this.state.players[0].abilities.augur;
    rt.cdLeftMs = 0;
    this.freeAugurGranted = true;
    this.bump();
  }

  /** The seat-0 perspective every screen renders (ServerDuel mirrors it). */
  get me(): PlayerStateView { return this.state.players[0] as PlayerStateView; }
  get foe(): PlayerStateView { return this.state.players[1] as PlayerStateView; }
}

type PlayerStateView = DuelState['players'][number];

/** Re-exported for screens that build a spec without importing @shared directly. */
export { CONFIG };
export type { RuleMods, ShadeProfile, Tier, PlayerId, AbilityId, Digit, OrderId };
