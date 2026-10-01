// Local duel runtime — runs the shared engine in the browser for M0 tutorial, M1 campaign,
// M3 daily, M5 practice and offline Shade duels (spec §3; the server runs it for M2/M4).
'use client';
import {
  createDuel, place, useAbility, tick, resign, cellFlags, swapOrder,
  type DuelState, type DuelEvent, type PlaceResult,
} from '@shared/engine';
import { shadeAct, profileForStanding, type ShadeProfile } from '@shared/shade';
import { tutorialAct, newTutorialScript, type TutorialScriptState } from '@shared/tutorial';
import { adaptiveSwapTarget } from '@shared/orders';
import { Rng } from '@shared/rng';
import { CONFIG, type AbilityId, type Digit, type OrderId, type PlayerId, type Tier } from '@shared/config';
import { generatePuzzle } from '@shared/sudoku';
import { synth } from '@/audio/synth';

export interface LocalDuelOpts {
  seed: string;
  tier: Tier;
  orders: [OrderId, OrderId];
  names: [string, string];
  seals?: [number, number];
  foeProfile?: ShadeProfile;
  mode: 'tutorial' | 'campaign' | 'daily' | 'practice' | 'shade';
  adaptive?: boolean;             // T4: the Ninth swaps Orders when he falls to 4 Seals
  settingsHaptics?: () => boolean;
  onEnd?: (r: { winner: PlayerId | 'draw'; reason: string }) => void;
  onEvent?: (e: DuelEvent) => void;
}

export class LocalDuel {
  state: DuelState;
  opts: LocalDuelOpts;
  notes = new Map<number, Set<number>>();
  selected: number | null = null;
  pencil = false;
  lastWrong: number | null = null;
  lastWrongCell = -1;
  lastWrongDigit = 0;
  lastWrongClearAt = 0;
  wrongVariant = 0;
  select(cell: number | null) {
    this.selected = cell;
    synth.uiTap();
    this.bump();
  }
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
  // must carry the same surface so DuelScreen renders both identically.
  disconnect = null;
  selfOffline = false;
  bumpPublic() { this.bump(); }
  tutorialStep = 0;
  freeAugurGranted = false;
  // T4 state — the swap happens once, mid-duel, when the adaptive foe drops to
  // CONFIG.seals.adaptiveSwapAtSeals; the banner window is real-time (keeps running
  // while the engine clock is paused) so the callout never freezes mid-animation.
  private adaptiveDone = false;
  private swapFlash: { from: OrderId; to: OrderId } | null = null;
  private swapFlashAt = 0;

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
    });
    this.state.events = [];
  }

  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; };
  // version bumps every call; listener notification is throttled to ~15fps — cooldown
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

  start() {
    this.lastFrame = performance.now();
    const loop = (t: number) => {
      const dt = Math.min(1000, t - this.lastFrame);
      this.lastFrame = t;
      if (!this.ended && !this.paused) {
        tick(this.state, dt);
        this.checkAdaptive();
        synth.tickMusic(this.tension());
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

  // T4 — Orsolo's adaptive swap (FOLIOS[8].duels[2].adaptive). Checked on the frame
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
      synth.orderSwap();
      if (this.opts.settingsHaptics?.() ?? true) navigator.vibrate?.([40, 70, 110]);
      this.bump(true);
    }
  }

  // DuelScreen reads this each render; truthy for ~4.2s after the swap (real time).
  swapBanner(): { from: OrderId; to: OrderId } | null {
    if (!this.swapFlash) return null;
    return performance.now() - this.swapFlashAt < 4200 ? this.swapFlash : null;
  }

  private drainEvents() {
    void this.state.events; // events are read by the UI directly; sfx hooked below
  }

  private finish() {
    if (this.ended) return;
    this.ended = true;
    const w = this.state.winner;
    if (w === 'draw') synth.draw();
    else if (w === 0) synth.victory();
    else synth.defeat();
    this.opts.onEnd?.({ winner: w ?? 'draw', reason: this.state.winReason ?? '' });
  }

  // ------------------------------------------------------------------ actions
  place(cell: number, digit: Digit): PlaceResult {
    if (this.ended) return { ok: false, reason: 'ended' };
    const before = this.state.players[0].seals;
    const res = place(this.state, 0, cell, digit);
    if (!res.ok) { if (res.reason === 'hushed' || res.reason === 'chained') synth.error(); return res; }
    if (res.correct) {
      synth.place();
      this.autoCleanNotes(cell, digit);
      this.lastWrong = null;
      // tutorial pacing: mark the first claim
      const st = this.state;
      for (const u of ['r', 'c', 'b'] as const) {
        const id = `${u}${u === 'r' ? Math.floor(cell / 9) : u === 'c' ? cell % 9 : Math.floor(cell / 27) * 3 + Math.floor((cell % 9) / 3)}`;
        if (st.unitOwner[id] === 0) { this.claimedOnce = true; break; }
      }
    } else {
      synth.wrong();
      this.wrongVariant++;
      this.lastWrong = cell;
      this.lastWrongCell = cell;
      this.lastWrongDigit = digit;
      this.lastWrongClearAt = this.state.clockMs + 1000; // digit clears after 1.0s
      if (this.opts.settingsHaptics?.() ?? true) navigator.vibrate?.(60);
    }
    void before;
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
    synth.pencil();
    this.bump();
  }

  ability(id: AbilityId, arg: { cell?: number; unit?: string } = {}) {
    if (this.ended) return { ok: false, reason: 'ended' as const };
    const a = arg.cell !== undefined ? arg : this.selected !== null ? { ...arg, cell: this.selected } : arg;
    const res = useAbility(this.state, 0, id, a);
    if (res.ok) {
      synth.cast(Object.keys(this.state.players[0].abilities).indexOf(id));
      this.opts.onEvent?.({ seq: -1, atMs: this.state.clockMs, kind: 'ability', player: 0, ability: id });
    } else synth.error();
    this.bump();
    return res;
  }

  concede() { resign(this.state, 0); this.finish(); }
  flags() { return cellFlags(this.state, 0); }

  // ------------------------------------------------------------------ shade
  private scheduleShade(delay: number) {
    if (this.shadeTimer) clearTimeout(this.shadeTimer);
    this.shadeTimer = setTimeout(() => this.shadeWake(), delay);
  }
  private shadeWake() {
    if (this.ended) return;
    const prof = this.opts.foeProfile ?? profileForStanding(1000);
    // T3: the tutorial Shade is fully scripted (deterministic hand-loses-the-race);
    // every other mode keeps the calibrated Shade bot.
    const act = this.opts.mode === 'tutorial'
      ? tutorialAct(this.script, this.state, 1, this.state.players[0].progress, this.scriptRng, performance.now())
      : shadeAct(this.state, 1, prof, () => this.rng.next(), performance.now());
    if (act.kind === 'place') {
      const res = place(this.state, 1, act.cell, act.digit);
      if (res.ok && res.correct) synth.pencil();
      if (res.ok && !res.correct) { /* foe mistake: no sfx for the foe */ }
      if (this.state.phase === 'ended') { this.finish(); return; }
    } else if (act.kind === 'ability') {
      useAbility(this.state, 1, act.id, { cell: act.cell, unit: act.unit });
    }
    this.scheduleShade(act.kind === 'wait' ? Math.max(400, act.untilMs - performance.now()) : 900);
    this.bump();
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
  pencilUsedOnce = false;
  claimedOnce = false;
  grantFreeAugur() {
    const rt = this.state.players[0].abilities.augur;
    rt.cdLeftMs = 0;
    this.freeAugurGranted = true;
    this.bump();
  }
}
