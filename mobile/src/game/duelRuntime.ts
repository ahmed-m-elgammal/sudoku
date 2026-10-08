// The duel runtime contract.
//
// The web build's central structural invariant (src/game/useDuelSession.ts:40):
//
//     export type AnyDuel = LocalDuel | ServerDuel;
//
// ...and DuelScreen renders BOTH through one JSX tree. That is why LocalDuel and
// ServerDuel were written to be structurally identical. A single `switch (screen)`
// screen tree plus one `AnyDuel` union means the UI never learns which runtime it is
// talking to.
//
// This file freezes that union as an INTERFACE so the UI can be written against the
// contract while the two runtime classes are being implemented in parallel. Any
// member added here is a member both classes must provide — keep it minimal, and
// keep it a superset of what the web build's screens actually touch.
//
// Cross-checked against src/app/game/{DuelScreen,Board,NumPad,AbilityBar,HudHeader,
// HudBits}.tsx and src/game/{localDuel,serverDuel}.ts.
import type { AbilityId, Digit, OrderId, PlayerId, Tier } from '@shared/config';
import type { DuelEvent, DuelState, PlaceResult, AbilityResult } from '@shared/engine';
import type { ShadeProfile } from '@shared/shade';
import type { DuelReplay } from '@shared/replay';

export type { AbilityId, Digit, OrderId, PlayerId, Tier, DuelEvent };

/** The status view the board renders. Mirrors `cellFlags()` in shared/engine. */
export interface CellFlags {
  chained: Set<number>;
  smudged: Set<number>;
  hushed: boolean;
  miasma: boolean;
  quarantinedUnits: Set<string>;
}

/** The T4/T20 "He adapts." callout — truthy for ~4.2 s, then null. */
export interface SwapBanner {
  from: OrderId;
  to: OrderId;
}

/**
 * M2 (docs/TUTORIAL_OPTIMIZATION_PLAN.md §5.2, §6.1) — what the spotlight coach aims
 * at during a teaching phase. `board` = the whole Tablet; `toolbar` indexes the four
 * tool buttons (0 = the quill). The spotlight geometry itself is pure UI law
 * (ui/duel/tutorial/spotlight.ts); the runtime only names the target.
 */
export type TutorialSpotTarget =
  | { kind: 'board' }
  | { kind: 'cell'; cell: number }
  | { kind: 'digit'; digit: Digit }
  | { kind: 'toolbar'; index: number }
  | { kind: 'erase' }
  | { kind: 'ability'; id: AbilityId }
  | null;

/** A pending Shade claim the coach announces ("The Shade eyes Row 3…"). */
export interface TutorialTelegraph {
  unit: 'row' | 'col' | 'box';
  n: number; // 1-based
}

/** S08: the peer dropped and the server-ticked grace is draining. */
export interface DisconnectState {
  secondsLeft: number;
  graceS: number;
  who: string;
}

/** The option surface every runtime shares — the only part a screen may read. */
export interface DuelRuntimeOpts {
  /**
   * Assigned by the screen AFTER construction. LocalDuel.finish() calls it
   * synchronously, one frame before the events effect paints the verdict — which is
   * why the screen delays its own finish by SLOW_INK_MS (the J3 slow-ink beat).
   */
  onEnd?: (r: { winner: PlayerId | 'draw'; reason: string }) => void;
}

/**
 * Everything a screen may touch on a duel, local or server-authoritative.
 * Both runtimes implement this exactly.
 */
export interface DuelRuntime {
  // ---- state
  readonly state: DuelState;
  /** Bumped on every mutation; screens read it to build memo keys. */
  readonly version: number;

  // ---- local player input surface
  readonly notes: Map<number, Set<number>>;
  readonly selected: number | null;
  pencil: boolean;
  /** the cell whose wrong digit is still being struck through */
  readonly lastWrong: number | null;
  readonly lastWrongCell: number;
  readonly lastWrongDigit: number;
  /** engine-clock ms at which the wrong digit's strike clears */
  readonly lastWrongClearAt: number;
  /** 0,1,2 — which of the three strike-1/2/3 assets to show */
  readonly wrongVariant: number;
  paused: boolean;
  ended: boolean;

  // ---- PvP-only surfaces (null / inert for local duels — the parity contract)
  readonly disconnect: DisconnectState | null;
  readonly selfOffline: boolean;

  // ---- tutorial-only surfaces (inert for every other mode)
  tutorialStep: number;
  pencilUsedOnce: boolean;
  claimedOnce: boolean;
  freeAugurGranted: boolean;

  // ---- store subscription (drives useSyncExternalStore; throttled to ~15 fps)
  subscribe(fn: () => void): () => void;
  getSnapshot(): number;
  /** Force a notify — used when a screen mutates `pencil` directly. */
  bumpPublic(): void;

  // ---- actions
  start(): void;
  destroy(): void;
  select(cell: number | null): void;
  place(cell: number, digit: Digit): PlaceResult | { ok: boolean; reason?: string; correct?: boolean };
  ability(id: AbilityId, arg?: { cell?: number; unit?: string }): AbilityResult | { ok: boolean; applied?: boolean };
  setNotes(cell: number, digits: number[]): void;
  toggleNote(cell: number, digit: number): void;
  concede(): void;
  setPaused(paused: boolean): void;
  togglePencil(): void;
  setOnEnd(fn: (r: { winner: PlayerId | 'draw'; reason: string }) => void): void;
  flags(): CellFlags;
  swapBanner(): SwapBanner | null;

  // ---- tutorial hooks (local only; ServerDuel returns inert values)
  tutorialNote(): string | null;
  grantFreeAugur(): void;

  // ---- M2 tutorial-director surface (OPTIONAL members: ServerDuel stays inert and
  //      untouched; only LocalDuel implements them, and only in v2 mode)
  tutorialPhase?(): string | null;
  tutorialTarget?(): TutorialSpotTarget;
  tutorialTelegraph?(): TutorialTelegraph | null;
  tutorialAdvance?(gate: 'prologueDone' | 'continue' | 'tryIt'): void;

  // ---- the options bag the runtime was constructed with, plus the end hook the
  //      screen assigns AFTER construction.
  //      `DuelRuntimeOpts` is deliberately minimal: it is the intersection every
  //      runtime shares. Each class keeps its own richer options type (LocalDuelOpts
  //      etc.) and widens it when it implements this interface, so a screen that only
  //      knows DuelRuntime can still read `onEnd` without importing a class.
  opts: DuelRuntimeOpts;
}

/** Options a caller passes to construct a local duel. Mirrors LocalDuelOpts. */
export interface LocalDuelOpts {
  seed: string;
  tier: Tier;
  orders: [OrderId, OrderId];
  names: [string, string];
  seals?: [number, number];
  foeProfile?: ShadeProfile;
  mode: 'tutorial' | 'campaign' | 'daily' | 'practice' | 'shade' | 'replay' | 'endless' | 'weekly';
  adaptive?: boolean;
  foeScript?: unknown;
  mods?: DuelState['rules'];
  replay?: DuelReplay;
  settingsHaptics?: () => boolean;
  onEnd?: (r: { winner: PlayerId | 'draw'; reason: string }) => void;
  onEvent?: (e: DuelEvent) => void;
  onPhase?: (phaseIdx: number) => void;
  /**
   * M2 — the tutorial Shade script selection. 'v1' (default) keeps the shipped
   * teaching race; 'v2' is the plan's §5.4 rebuild: frozen until the director arms
   * the race at t9, paced 8–12 s, telegraphed claims, no early slips. The flag is
   * the documented rollback path (flip specFromUi's one line).
   */
  tutorialScript?: 'v1' | 'v2';
  /** M2 — a graduated replay skips the prologue cards and enters at t1. */
  tutorialSkipPrologue?: boolean;
  /** the recorded human log of THIS duel (validated; null if illegal) */
  toReplay?: (outcome: { winner: 0 | 1 | 'draw'; reason: string }) => DuelReplay | null;
  /** visible degradation when a stored echo fails validation */
  replayDegraded?: boolean;
}

/** What the screen builds to launch a duel. Mirrors DuelSessionSpec. */
export interface DuelSessionSpec {
  mode: LocalDuelOpts['mode'];
  seed: string;
  tier: Tier;
  orders: [OrderId, OrderId];
  names: [string, string];
  seals?: [number, number];
  foeProfile?: ShadeProfile;
  adaptive?: boolean;
  foeScript?: unknown;
  mods?: DuelState['rules'];
  replay?: DuelReplay;
  /** M2 — see LocalDuelOpts.tutorialScript */
  tutorialScript?: 'v1' | 'v2';
  /** M2 — see LocalDuelOpts.tutorialSkipPrologue */
  tutorialSkipPrologue?: boolean;
}
